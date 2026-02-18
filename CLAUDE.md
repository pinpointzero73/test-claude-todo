# CLAUDE.md — `<todo-list>` Web Component

## Project Identity

A **standalone, zero-dependency** `<todo-list>` native Web Component. No framework required — it registers itself via `customElements.define()` and works in any HTML page with a `<script>` tag.

Built with patterns that mirror **DommaJS** conventions (Model pub/sub, StorageAdapter, DommaElement lifecycle) to enable low-friction Domma integration in the future. This is **not** a Domma project — do not use `$()`, `S.get()`, `H.get()`, or any other Domma APIs here.

---

## Architecture Layers

```
constants.js           → Frozen STATUS / PRIORITY enums (no deps)
storage-adapter.js     → Namespaced localStorage wrapper (no deps)
todo-model.js          → Single-item reactive model (depends on constants)
todo-collection.js     → Map-based list manager + persistence (depends on model + storage)
todo-list.component.js → <todo-list> Web Component + Shadow DOM (depends on all above)
index.js               → Entry point: customElements.define + re-exports
```

---

## Key Conventions

### Data Fields (snake_case — backend-compatible)
All model fields use snake_case to mirror Symfony/Laravel conventions:
`id`, `detail`, `owner`, `status`, `priority`, `due_at`, `tags`, `sort_order`,
`is_archived`, `added_at`, `amended_at`, `completed_at`

### Status Acronyms (3-letter, immutable)
| Code | Label           | Terminal? |
|------|-----------------|-----------|
| NYS  | Not Yet Started | No        |
| INP  | In Progress     | No        |
| INR  | In Review       | No        |
| BLK  | Blocked         | No        |
| CMP  | Complete        | Yes       |
| CAN  | Cancelled       | Yes       |
| DEF  | Deferred        | No        |

Terminal statuses auto-set `completed_at` and should not allow further transition without explicit reactivation.

### Priority Acronyms
`LOW`, `MED`, `HIGH`, `CRIT`

### HTML Attribute Selectors (data-*)
All component internals are targeted by `data-*` attributes — never by class name.

**Add form:** `[data-input-detail]`, `[data-input-status]`, `[data-input-owner]`, `[data-input-priority]`, `[data-add-submit]`

**Item actions:** `[data-status-badge]`, `[data-status-option="XXX"]`, `[data-priority-badge]`, `[data-priority-option="XXX"]`, `[data-delete]`, `[data-edit-detail]`, `[data-inline-edit-input]`

**Layout:** `[data-toggle]`, `[data-filter="XXX"]`, `[data-body]`, `[data-list]`

**Archive panel:** `[data-archive-card]`, `[data-archive-toggle]`, `[data-archive-body]`, `[data-archive-list]`, `[data-archive-count]`, `[data-restore]`, `[data-purge]`, `[data-clear-archive]`

### XSS Prevention
All user-supplied strings and config values rendered into the DOM **must** pass through `esc()`.
This is defined in `todo-list.component.js` and escapes `& < > " '` to their HTML entities.
Never assign raw user values to element content directly. A pre-commit security hook enforces
this — if it fires, look for unescaped dynamic values being written to the DOM.

---

## Archive Panel Design

The archive panel is a **separate card** below `.todo-wrapper` (not inside it). This is intentional:
- The main body collapse (`[data-body]`) does not affect the archive visibility
- The archive's `overflow: hidden` on its body is always safe — no dropdowns inside it
- Archive shows items where `TERMINAL_STATUSES.includes(status) || is_archived === true`

**Delete is soft-delete**: clicking the trash icon sets `is_archived = true` via `model.set()`, not `collection.remove()`. Hard-delete (purge) is only available from the archive panel (`[data-purge]`).

**Restore logic**: sets `is_archived = false`. If the item's status is terminal, also resets status to `NYS` and clears `completed_at`.

**Priority picker** mirrors the status picker pattern exactly: a badge button opens a dropdown with all PRIORITY options. `.todo-priority-picker` / `.todo-priority-dropdown` CSS classes share the same positioning rules as the status equivalents. `_closeAllDropdowns()` closes both status AND priority dropdowns.

**Main list shows active tasks only**: `!TERMINAL_STATUSES.includes(status) && !is_archived`. The "All" filter respects this — terminal/archived items are never shown in the main list.

---

## Shadow DOM Gotchas (Critical)

### overflow: hidden clips absolutely-positioned dropdowns
`.todo-body` must NOT have `overflow: hidden` in its base CSS rule. The status dropdown
(`position: absolute`) escapes `.todo-status-picker` (its `position: relative` parent),
but it cannot escape an `overflow: hidden` ancestor.

**The fix**: `overflow: hidden` on `.todo-body` is JS-managed, tied to animation lifecycle:
- **Collapsing**: set `overflow = 'hidden'` immediately before removing `max-height`
- **Expanding**: set `overflow = 'hidden'` during animation, clear it on `transitionend`
- **Collapsed state**: CSS `.todo-body.is-collapsed { overflow: hidden }` handles it statically

This means Playwright tests for dropdown clipping **must** check `boundingBox()` on individual
options — Playwright finds elements by DOM presence, not visual rendering, so a test can pass
even when the dropdown is visually clipped.

### Outside-click detection across Shadow DOM boundary
`element.contains(e.target)` returns `false` for clicks inside a shadow root because
`e.target` is retargeted to the host element. Use `composedPath()` instead:

```js
document.addEventListener('click', e => {
  if (!e.composedPath().includes(this._shadow.host)) closeDropdown();
});
```

### Custom events must use composed: true
Custom events fired from inside Shadow DOM must have `bubbles: true, composed: true` to
cross the shadow boundary and be observable on `document`.

---

## Runtime Config (`todo.config.json`)

This is the **only** runtime configuration surface. The component fetches it via `fetch(config-url)`.
Never hardcode config values in JS — read them from `this._config`.

```json
{
  "storage": { "namespace": "todo", "version": 1 },
  "defaults": { "owner": "", "status": "NYS", "priority": "MED" },
  "statuses": { "enabled": ["NYS","INP","INR","BLK","CMP","CAN","DEF"], "terminal": ["CMP","CAN"] },
  "ui": { "showOwner": true, "confirmOnDelete": true, "dateFormat": "DD/MM/YYYY HH:mm" }
}
```

Changing `storage.version` in the config creates a new storage prefix, effectively migrating
users to a clean slate (old data remains under the previous prefix key, orphaned).

---

## Build

```bash
npm run dev        # Rollup watch + live-server on port from $DEV_PORT (default 3100)
npm run build      # Development IIFE + ESM build
npm run build:prod # Minified production build
npm test           # Playwright E2E + unit tests (auto-starts live-server)
npm run test:ui    # Playwright UI mode
```

### Dual output
- `dist/todo-list.iife.js` — for `<script>` tags; exposes `window.TodoList`
- `dist/todo-list.esm.js` — for ES module `import`

`dist/index.html` and `dist/todo.config.json` are copied from source by the Rollup `copyAssets()` plugin.

### Environment variables (`.env`)
```
DEV_PORT=3100
DEBUG_MODE=true
BUILD_TARGET=development
```
Baked into the bundle at build time via `@rollup/plugin-replace`. Copy `.env.example` to `.env`.

---

## Testing

### Playwright Shadow DOM piercing
Use chained `.locator()` calls — Playwright 1.14+ pierces open shadow roots automatically.
Do **NOT** use `pierce/` prefix (invalid syntax, throws CSS selector error).

```js
// Correct
page.locator('todo-list').first().locator('[data-input-detail]')

// Wrong — throws: Unexpected token "/" while parsing css selector
page.locator('pierce/[data-input-detail]')
```

### Unit tests via page.evaluate()
Unit tests run in real browser context via `page.evaluate()`. Return a Promise to let
Playwright await async operations:

```js
const result = await page.evaluate(() =>
  new Promise(resolve => {
    document.addEventListener('todo:add', e => resolve(e.detail), { once: true });
  })
);
```

`window.TodoList` is exposed by the **IIFE** build only — the dev page must load
`todo-list.iife.js`, not the ESM module.

### Dropdown clipping regression test
The test "status dropdown options are visible and not clipped" uses `boundingBox()` on every
`.todo-status-option` element. This is intentional — it catches `overflow: hidden` regressions
that DOM-presence checks would miss.

---

## Domma Integration Path (Future)

When integrating into Domma, the migration is mechanical:

| Standalone             | Domma equivalent           | Effort |
|------------------------|----------------------------|--------|
| `TodoListComponent`    | Extend `DommaElement`      | Low    |
| `StorageAdapter`       | `S.get()` / `S.set()`      | Low    |
| `TodoModel`            | `M.create(blueprint)`      | Low    |
| `fetch()` config load  | `H.get(url)`               | Low    |
| `window.confirm()`     | `await E.confirm('Sure?')` | Low    |
| `TodoCollection`       | Keep as-is or use `M.list` | Medium |

The main constraint: `$()` does not reach into Shadow DOM. Domma's own web components
(toast, modal, badge) all use `document.createElement()` internally — this pattern is
already established in the Domma codebase.

---

## Directory Layout

```
todo-component/
├── CLAUDE.md                  ← This file
├── .env                       ← Local env vars (gitignored)
├── .env.example               ← Committed template
├── .gitignore
├── todo.config.json           ← Runtime config (fetched by component)
├── package.json
├── rollup.config.js
├── src/
│   ├── js/
│   │   ├── constants.js
│   │   ├── storage-adapter.js
│   │   ├── todo-model.js
│   │   ├── todo-collection.js
│   │   ├── todo-list.component.js
│   │   └── index.js
│   ├── css/
│   │   └── todo-list.css
│   └── html/
│       └── index.html         ← Dev host page (also copied to dist/)
├── dist/                      ← Build output (gitignored)
├── docs/
│   └── todo-list-component.md ← Full user-facing documentation
└── tests/
    ├── playwright.config.js
    ├── todo.spec.js           ← E2E tests (13 tests)
    └── model.unit.spec.js     ← Model unit tests (12 tests)
```

Note: `tests/playwright.config.js` lives inside `tests/` rather than at root. This is
non-standard (Playwright default expects root-level config) but works because the npm test
script passes `--config=tests/playwright.config.js` explicitly.
