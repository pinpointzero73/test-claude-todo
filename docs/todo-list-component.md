# `<todo-list>` Web Component

A standalone, zero-dependency todo list implemented as a native Web Component. No framework required — drop a `<script>` tag into any page and use `<todo-list>` as a standard HTML element.

Built as a POC that deliberately mirrors DommaJS patterns (`DommaElement` lifecycle, `M.create()` schema style, `S.get()`/`S.set()` storage API) so that migration to a full Domma integration is mechanical rather than a rewrite.

---

## Table of Contents

1. [Installation](#installation)
2. [Running the development server](#running-the-development-server)
3. [Building for production](#building-for-production)
4. [Running tests](#running-tests)
5. [Embedding the component](#embedding-the-component)
6. [HTML attributes](#html-attributes)
7. [Public JavaScript API](#public-javascript-api)
8. [Soft-delete and archive panel](#soft-delete-and-archive-panel)
9. [Custom events](#custom-events)
10. [Runtime configuration — `todo.config.json`](#runtime-configuration--todoconfigjson)
11. [CSS design tokens](#css-design-tokens)
12. [Architecture overview](#architecture-overview)
13. [Data model — fields and schema](#data-model--fields-and-schema)
14. [Status and priority enumerations](#status-and-priority-enumerations)
15. [Storage layer — `StorageAdapter`](#storage-layer--storageadapter)
16. [Model layer — `TodoModel`](#model-layer--todomodel)
17. [Collection layer — `TodoCollection`](#collection-layer--todocollection)
18. [Component lifecycle](#component-lifecycle)
19. [Adding, updating, and removing items programmatically](#adding-updating-and-removing-items-programmatically)
20. [Extending the schema](#extending-the-schema)
21. [Domma integration path](#domma-integration-path)
22. [Directory layout](#directory-layout)
23. [Environment variables](#environment-variables)
24. [Known constraints and gotchas](#known-constraints-and-gotchas)

---

## Installation

**Prerequisites:** Node.js 18 or later.

```bash
git clone <repo-url> todo-component
cd todo-component
npm install
```

After installation, copy the environment template:

```bash
cp .env.example .env
```

The defaults in `.env.example` are suitable for local development.

---

## Running the development server

```bash
npm run dev
```

This runs two processes in parallel:

| Process | What it does |
|---------|-------------|
| `rollup --watch` | Rebuilds `dist/` on every source change |
| `live-server dist` | Serves `dist/` on `http://localhost:3100` with hot reload |

The port is configured via `DEV_PORT` in `.env` (default `3100`). Open the URL in a browser to see the component in action. Changes to any file under `src/` trigger an automatic rebuild and browser refresh.

---

## Building for production

**Development build** (includes source maps):
```bash
npm run build
```

**Production build** (minified, no source maps):
```bash
npm run build:prod
```

Both commands write two output files to `dist/`:

| File | Format | Use case |
|------|--------|----------|
| `dist/todo-list.iife.js` | IIFE (`window.TodoList`) | Plain `<script>` tag |
| `dist/todo-list.esm.js` | ES module | `import` / bundler |

The build also copies `src/html/index.html` → `dist/index.html` and `todo.config.json` → `dist/todo.config.json`.

---

## Running tests

Install the Playwright browser once (Chromium only is sufficient for local work):

```bash
npx playwright install chromium
```

Run all 28 tests:

```bash
npm test
```

Run with Playwright's interactive UI:

```bash
npm run test:ui
```

**What the tests cover:**

- Empty state rendering
- Adding a task (default status and explicit status via form selector)
- Status change via badge dropdown — including a bounding-box check to catch `overflow:hidden` clipping regressions
- Delete with confirmation dialog
- Filter by status
- Persistence across page reload (localStorage round-trip)
- Toggle collapse/expand animation
- Custom event emission (`todo:add`)
- Archive panel (completed/archived tasks with Restore and Purge actions)
- Priority badge visible and changeable via dropdown
- Soft-delete: deleted tasks move to archive; restore returns them to the main list
- Post-reload reactivity regression (loaded items remain fully reactive after page refresh)
- Inline edit of task detail
- Public API (`addItem()`)
- Model unit tests via `page.evaluate()` (schema validation, UUID generation, timestamp automation, pub/sub, `StorageAdapter` namespace isolation)

Tests use `live-server dist` as the web server, started automatically by Playwright's `webServer` config. A production `npm run build` must have been run at least once before the first test run.

---

## Embedding the component

### Via `<script>` tag (IIFE)

```html
<script src="path/to/todo-list.iife.js"></script>

<todo-list config-url="./todo.config.json"></todo-list>
```

The IIFE build calls `customElements.define('todo-list', TodoListComponent)` automatically and exposes `window.TodoList` with all exported classes.

### Via ES module import

```html
<script type="module">
  import { TodoListComponent } from './todo-list.esm.js';
  customElements.define('todo-list', TodoListComponent);
</script>

<todo-list config-url="./todo.config.json"></todo-list>
```

### Via a bundler (Vite, Webpack, etc.)

```js
import { TodoListComponent } from 'todo-list-component';
customElements.define('todo-list', TodoListComponent);
```

---

## HTML attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `config-url` | string | `./todo.config.json` | Path to the runtime config file, resolved relative to the page |
| `owner` | string | `""` | Overrides `defaults.owner` from config; pre-fills the Owner field |
| `collapsed` | boolean | absent = expanded | Present → starts collapsed |

**Examples:**

```html
<!-- Custom config path -->
<todo-list config-url="/static/my-todo.config.json"></todo-list>

<!-- Start collapsed with a default owner -->
<todo-list owner="alice" collapsed></todo-list>
```

Changing `owner` or `collapsed` after the component has connected triggers `attributeChangedCallback` and updates the component reactively.

---

## Public JavaScript API

Accessible on any `<todo-list>` element reference:

```js
const el = document.querySelector('todo-list');
```

### `el.addItem(data)` → `TodoModel`

Adds a new item programmatically. The `detail` field is required; all others are optional and fall back to schema defaults.

```js
const model = el.addItem({
  detail:   'Deploy to staging',
  owner:    'alice',
  status:   'INP',
  priority: 'HIGH'
});

console.log(model.get('id')); // UUID
```

### `el.removeItem(id)` → `boolean`

Removes the item with the given UUID. Returns `true` if found and removed.

```js
el.removeItem('276c06c1-12e5-4f56-8af4-79f39532f7e0');
```

### `el.getItems()` → `Array<object>`

Returns a plain-object snapshot of all current items (not `TodoModel` instances).

```js
const items = el.getItems();
items.forEach(item => console.log(item.detail, item.status));
```

### `el.clearCompleted()`

Hard-deletes all items that are in a terminal status (`CMP` or `CAN`) **or** have `is_archived: true`. This is equivalent to emptying the archive panel entirely.

```js
el.clearCompleted();
```

### `el.archiveItem(id)` → `boolean`

Soft-deletes an item by setting `is_archived: true` and moving it to the archive panel. The item remains in storage and can be restored. Returns `true` if found, `false` if the ID does not exist.

```js
el.archiveItem('276c06c1-12e5-4f56-8af4-79f39532f7e0');
```

---

## Soft-delete and archive panel

### Delete is soft-delete

Clicking the trash icon on a task does **not** immediately remove it from storage. Instead it sets `is_archived: true` on the model via `model.set()`. The item disappears from the main list and reappears in the archive panel below.

Hard-delete (permanent removal) is only available from the archive panel via the **Purge** button on each row, or by calling `el.clearCompleted()` / `collection.clearArchive()`.

### Archive panel

The archive panel is a collapsible card rendered below the main `.todo-wrapper`. It is independent of the main body collapse — toggling the main list open/closed does not affect the archive panel's state.

Items appear in the archive when either condition is true:
- `TERMINAL_STATUSES.includes(status)` — i.e. `CMP` or `CAN`
- `is_archived === true` — soft-deleted via the trash button

Each archive row has two actions:

| Button | Behaviour |
|--------|-----------|
| **Restore** | Sets `is_archived: false`. If the item's status is terminal, also resets `status` to `NYS` and clears `completed_at`, so the item re-enters the main list in an active state. |
| **Purge** | Calls `collection.remove(id)` — a permanent hard-delete. The item is removed from storage. |

A **Clear archive** button in the panel footer calls `clearArchive()`, which hard-deletes all archived and terminal-status items in one operation.

### Priority picker

Every task item displays a clickable priority badge in the actions area (between the status badge and the delete button). Clicking it opens a dropdown listing all four priority values (`LOW`, `MED`, `HIGH`, `CRIT`). Selecting a value calls `model.set('priority', value)` and immediately updates the badge.

This mirrors the status picker pattern exactly — the same dropdown positioning rules and `_closeAllDropdowns()` handling apply to both.

---

## Custom events

All events bubble and are composed, meaning they cross Shadow DOM boundaries and are observable anywhere in the document tree.

```js
document.addEventListener('todo:add',    e => console.log('Added:',   e.detail.item));
document.addEventListener('todo:update', e => console.log('Updated:', e.detail.item));
document.addEventListener('todo:remove', e => console.log('Removed:', e.detail.item));
```

`e.detail.item` is a plain-object snapshot of the affected `TodoModel` at the time the event fired.

---

## Runtime configuration — `todo.config.json`

Fetched at component initialisation from `config-url`. If the fetch fails (file missing, network error, wrong status code), the component falls back to built-in defaults and continues working.

```json
{
  "storage": {
    "namespace": "todo",
    "version":   1
  },
  "defaults": {
    "owner":    "",
    "status":   "NYS",
    "priority": "MED"
  },
  "statuses": {
    "enabled":  ["NYS", "INP", "INR", "BLK", "CMP", "CAN", "DEF"],
    "terminal": ["CMP", "CAN"]
  },
  "ui": {
    "showOwner":       true,
    "confirmOnDelete": true,
    "dateFormat":      "DD/MM/YYYY HH:mm"
  }
}
```

### Configuration reference

| Key | Type | Description |
|-----|------|-------------|
| `storage.namespace` | string | Prefix for localStorage keys. Two instances with different namespaces are fully isolated. |
| `storage.version` | number | Included in the key prefix (`namespace:vN:`). Increment to start with a clean slate on schema changes. |
| `defaults.owner` | string | Pre-filled value for the Owner field on the add form. |
| `defaults.status` | STATUS acronym | Default status selected in the add form. |
| `defaults.priority` | PRIORITY acronym | Default priority selected in the add form. |
| `statuses.enabled` | string[] | Which STATUS values appear in the filter bar, add form, and status dropdown. |
| `statuses.terminal` | string[] | Statuses that auto-set `completed_at` and style the item with strikethrough. |
| `ui.showOwner` | boolean | Show or hide the Owner field everywhere. |
| `ui.confirmOnDelete` | boolean | Prompt `window.confirm` before deleting an item. |
| `ui.dateFormat` | string | Display format for `due_at` dates (informational — the component uses `toLocaleString('en-GB')`). |

### Restricting visible statuses

To show only a subset of statuses in a specific instance, override `statuses.enabled`:

```json
{
  "statuses": {
    "enabled":  ["NYS", "INP", "CMP"],
    "terminal": ["CMP"]
  }
}
```

This affects the filter bar, the add form selector, and the status badge dropdown for all items in that instance.

---

## CSS design tokens

The component exposes CSS custom properties on `:host`. Override them from the page to theme the component without touching Shadow DOM internals.

```css
todo-list {
  --todo-primary:       #6366f1;  /* Accent colour for buttons, focus rings */
  --todo-primary-hover: #4f46e5;
  --todo-bg:            #ffffff;  /* Card background */
  --todo-bg-alt:        #f8fafc;  /* Header / footer / hover background */
  --todo-border:        #e2e8f0;  /* All borders */
  --todo-border-focus:  #6366f1;  /* Input focus ring */
  --todo-text:          #1e293b;
  --todo-text-muted:    #64748b;
  --todo-radius:        0.5rem;
  --todo-radius-sm:     0.25rem;
  --todo-danger:        #ef4444;
  --todo-danger-hover:  #dc2626;
}
```

Badge colours for each status and priority are also exposed as pairs (`--badge-{colour}-bg` / `--badge-{colour}-text`). See `src/css/todo-list.css` for the complete token list.

---

## Architecture overview

The component is structured in four layers, each with a single responsibility:

```
┌─────────────────────────────────────────────────────────┐
│  <todo-list> Web Component  (todo-list.component.js)    │
│  Shadow DOM · lifecycle · event delegation · rendering  │
└────────────────────────┬────────────────────────────────┘
                         │ creates / observes
┌────────────────────────▼────────────────────────────────┐
│  TodoCollection  (todo-collection.js)                   │
│  Map<id, TodoModel> · CRUD · pub/sub · auto-persist     │
└────────────────────────┬────────────────────────────────┘
                         │ wraps
┌────────────────────────▼────────────────────────────────┐
│  TodoModel  (todo-model.js)                             │
│  Single item · schema · validation · reactive set()     │
└────────────────────────┬────────────────────────────────┘
                         │ delegates storage to
┌────────────────────────▼────────────────────────────────┐
│  StorageAdapter  (storage-adapter.js)                   │
│  Namespaced localStorage · JSON serialisation           │
└─────────────────────────────────────────────────────────┘
```

**Data flow on mutation:**

1. User action (click / form submit) → component event handler
2. Handler calls `collection.add()` / `model.set()` / `collection.remove()`
3. Collection persists to `StorageAdapter` synchronously
4. Collection fires `onChange` pub/sub → component calls `_refreshList()`
5. Component rebuilds the list HTML and fires a composed custom event

All mutations are synchronous. There is no async path after the initial config fetch.

---

## Data model — fields and schema

Every todo item is a plain object with the following fields. The schema is defined in `src/js/todo-model.js` as `TODO_SCHEMA`.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `id` | string | yes | `crypto.randomUUID()` | UUID v4; immutable after creation |
| `detail` | string | yes | — | 1–500 chars; the task description |
| `owner` | string | no | `""` | Person responsible; hidden when `ui.showOwner: false` |
| `status` | string | yes | `NYS` | Must be a valid STATUS acronym |
| `priority` | string | no | `MED` | Must be a valid PRIORITY acronym |
| `due_at` | string | no | `null` | ISO 8601 datetime string |
| `tags` | array | no | `[]` | Array of string tags |
| `sort_order` | number | no | `0` | Manual sort position |
| `is_archived` | boolean | no | `false` | Soft delete flag |
| `added_at` | string | yes | auto | ISO 8601; set once on creation |
| `amended_at` | string | yes | auto | ISO 8601; updated on every `model.set()` call |
| `completed_at` | string | no | `null` | Auto-set when status transitions to a terminal value; auto-cleared when transitioning away |

### Automatic field management

The model handles three fields automatically and they should not be set manually:

- **`id`** — generated on construction; never changes
- **`amended_at`** — updated to `now()` on every `model.set()` call, unless `amended_at` itself is the field being set
- **`completed_at`** — set to `now()` when `status` transitions to `CMP` or `CAN`; cleared to `null` when transitioning away from those statuses

### Validation

Call `model.validate()` at any time to check all fields:

```js
const { valid, errors } = model.validate();
// errors: { detail: 'detail is required', status: 'status has an invalid value' }
```

The `TodoCollection.add()` method calls `validate()` before inserting and throws if invalid. Subsequent `model.set()` calls do not re-validate automatically — call `validate()` explicitly if needed.

---

## Status and priority enumerations

All valid values are defined in `src/js/constants.js` as frozen objects. The 3-letter acronyms are intentional — they map directly to database ENUM columns without transformation (Symfony/Laravel conventions).

### Status values

| Acronym | Label | Badge colour | Terminal? |
|---------|-------|-------------|-----------|
| `NYS` | Not Yet Started | Grey | — |
| `INP` | In Progress | Blue | — |
| `INR` | In Review | Amber | — |
| `BLK` | Blocked | Red | — |
| `CMP` | Complete | Green | ✓ |
| `CAN` | Cancelled | Muted | ✓ |
| `DEF` | Deferred | Purple | — |

Terminal statuses (`CMP`, `CAN`) auto-set `completed_at` and apply strikethrough styling to the task detail.

### Priority values

| Acronym | Label | Badge colour |
|---------|-------|-------------|
| `LOW` | Low | Slate |
| `MED` | Medium | Sky |
| `HIGH` | High | Orange |
| `CRIT` | Critical | Red |

`MED` is the default. Every item displays a priority badge in its actions row; clicking the badge opens a dropdown to change the value inline. See [Soft-delete and archive panel](#soft-delete-and-archive-panel) for more on the picker interaction.

### Adding a new status or priority

1. Add the acronym to the relevant frozen object in `src/js/constants.js`
2. Add its label to the corresponding `_LABELS` object
3. Add its colour token name to the `_COLOURS` object
4. Add a `.todo-badge--{colour}` CSS rule in `src/css/todo-list.css` if the colour is new
5. Update `statuses.enabled` in `todo.config.json` if the status should be visible by default

---

## Storage layer — `StorageAdapter`

`src/js/storage-adapter.js` — a thin wrapper around `localStorage` that namespaces all keys.

**Key format:** `{namespace}:v{version}:{key}`

Example with `namespace = "todo"`, `version = 1`: keys are stored as `todo:v1:items`.

```js
import { StorageAdapter } from './src/js/storage-adapter.js';

const store = new StorageAdapter('todo', 1);

store.set('items', [{ id: '...', detail: 'Hello' }]);
store.get('items');              // → [{ id: '...', detail: 'Hello' }]
store.has('items');              // → true
store.keys();                    // → ['items']
store.getAll();                  // → { items: [...] }
store.remove('items');
store.clear();                   // removes only keys with this adapter's prefix
```

**Version migration:** incrementing `storage.version` in `todo.config.json` effectively starts with an empty store, because the old keys (e.g. `todo:v1:items`) are no longer read. Old keys remain in `localStorage` until manually cleared or until the browser purges them.

Multiple `<todo-list>` instances on the same page can coexist without conflict as long as they use different `storage.namespace` values in their respective config files.

---

## Model layer — `TodoModel`

`src/js/todo-model.js` — represents a single item and manages reactive updates.

```js
import { TodoModel } from './src/js/todo-model.js';

// Create with partial data — schema defaults fill the rest
const model = new TodoModel({ detail: 'Write docs', priority: 'HIGH' });

// Read a single field
model.get('id');       // UUID string
model.get('status');   // 'NYS'

// Read all fields as a plain object
model.get();           // { id: '...', detail: 'Write docs', ... }

// Update one field
model.set('status', 'INP');

// Update multiple fields at once
model.set({ status: 'CMP', owner: 'alice' });

// Validate
const { valid, errors } = model.validate();

// Serialise (returns a plain object, safe to JSON.stringify)
const snapshot = model.toJSON();

// Subscribe to any change
const unsub = model.onChange((data, prev) => {
  console.log('changed from', prev.status, 'to', data.status);
});
unsub(); // unsubscribe

// Subscribe to a specific field
const unsubField = model.onFieldChange('status', (next, prev) => {
  console.log('status:', prev, '→', next);
});
unsubField();
```

---

## Collection layer — `TodoCollection`

`src/js/todo-collection.js` — manages a `Map<id, TodoModel>` with automatic persistence.

```js
import { StorageAdapter }  from './src/js/storage-adapter.js';
import { TodoCollection }  from './src/js/todo-collection.js';

const store      = new StorageAdapter('todo', 1);
const collection = new TodoCollection(store);

// Add — throws if model.validate() fails
const model = collection.add({ detail: 'Ship it', status: 'INP' });

// Retrieve
collection.get(model.get('id'));    // → TodoModel
collection.getAll();                // → TodoModel[]
collection.size;                    // → 1

// Filter
collection.filterByStatus('INP');                   // → TodoModel[]
collection.filterByStatus(['INP', 'INR']);           // multiple statuses
collection.filterByOwner('alice');                   // → TodoModel[]
collection.filter(m => m.get('priority') === 'CRIT'); // arbitrary predicate

// Mutate via the model directly — collection auto-persists
model.set('status', 'CMP');         // triggers save + 'update' event

// Remove
collection.remove(model.get('id')); // → true

// Bulk
collection.clearArchive();          // hard-deletes all terminal-status and is_archived items
collection.clear();                 // removes everything

// Subscribe to collection events: 'add' | 'update' | 'remove' | 'clear'
const unsub = collection.onChange((event, model) => {
  console.log(event, model?.get('id'));
});
unsub();
```

Every `add()`, `remove()`, `clearArchive()`, and `clear()` call persists to `localStorage` immediately. Every `model.set()` on a managed item also triggers a save automatically.

---

## Component lifecycle

The `<todo-list>` element follows a lifecycle that mirrors `DommaElement` conventions:

| Method | When called | What it does |
|--------|------------|-------------|
| `connectedCallback` | Element added to DOM | Fetches config, initialises collection, renders, binds events, populates list |
| `disconnectedCallback` | Element removed from DOM | Unsubscribes collection listener; removes document click handler |
| `attributeChangedCallback` | `collapsed` or `owner` attribute changes | Syncs collapse state or updates default owner |
| `_loadConfig()` | Inside `connectedCallback` | `fetch(config-url)`, falls back to `DEFAULT_CONFIG` on error |
| `_initCollection()` | After config loaded | Creates `StorageAdapter` + `TodoCollection`, registers `onChange` |
| `_injectStyles()` | Inside `_render()` | Adopts CSS stylesheet into Shadow root via `CSSStyleSheet.replaceSync()` |
| `_render()` | After init | Writes the full HTML scaffold into `shadowRoot.innerHTML` |
| `_bindEvents()` | After render | Attaches delegated listeners; stores `_outsideClickHandler` ref for cleanup |
| `_refreshList()` | On every collection change | Rebuilds `ul[data-list]` innerHTML; sorts items |
| `_syncCollapseState()` | On toggle or attribute change | Manages `is-collapsed` class and `overflow` style |
| `_cleanup()` | In `disconnectedCallback` | Calls unsubscribe functions; removes document listeners |

---

## Adding, updating, and removing items programmatically

### Adding via the public API

```js
const el = document.querySelector('todo-list');

el.addItem({
  detail:   'Review PR #42',
  owner:    'bob',
  status:   'INR',
  priority: 'HIGH',
  due_at:   '2025-06-01T17:00:00.000Z',
  tags:     ['review', 'urgent']
});
```

### Updating an existing item

Retrieve the underlying `TodoModel` through the collection (accessible via the IIFE bundle's `window.TodoList`), or listen for the `todo:add` event to capture the model reference:

```js
document.addEventListener('todo:add', e => {
  // e.detail.item is a plain snapshot, not the live model
  // To get the live model, access the element's internal collection:
  const el    = document.querySelector('todo-list');
  const model = el._collection.get(e.detail.item.id);

  // Update any field
  model.set('status',   'CMP');
  model.set('priority', 'LOW');

  // Or update multiple fields at once
  model.set({ status: 'CMP', owner: 'carol' });
});
```

Note that `_collection` is a private property. For clean external access, use `addItem()`, `removeItem()`, and the custom events rather than reaching into the internals.

### Removing

```js
el.removeItem('276c06c1-12e5-4f56-8af4-79f39532f7e0');
```

---

## Extending the schema

To add a new field (e.g. `estimated_hours`):

**1. Add to `TODO_SCHEMA` in `src/js/todo-model.js`:**

```js
estimated_hours: {
  type:     'number',
  required: false,
  default:  null,
  validate: v => v === null || (typeof v === 'number' && v > 0)
}
```

**2. Render the field in `_renderItem()` inside `src/js/todo-list.component.js`:**

```js
if (data.estimated_hours) {
  metaHtml += `<span class="todo-item__due">${esc(data.estimated_hours)}h</span>`;
}
```

**3. Expose it in the add form (optional):**
Add an `<input type="number">` with `data-input-estimated-hours` to the form in `_render()`, then read it in `_handleAdd()`.

**4. Increment `storage.version` in `todo.config.json`** to avoid conflicts with previously stored items that don't have the new field. The schema default (`null`) will be applied to any items loaded from the old version, so in practice a version bump is only strictly needed if the new field is `required`.

---

## Domma integration path

The component is designed so that migration to native Domma APIs requires changing approximately 30 lines. All patterns have intentional 1:1 equivalents:

| Current (standalone) | Domma equivalent | Effort |
|----------------------|-----------------|--------|
| `TodoListComponent extends HTMLElement` | `extends DommaElement` | Remove ~25 lines of boilerplate lifecycle code |
| `StorageAdapter.get/set()` | `S.get()` / `S.set()` | Keys become `domma:todo:items` |
| `TodoModel` schema + `set()` / `onChange()` | `M.create(blueprint)` | Blueprint format is compatible |
| CSS custom properties `--todo-*` | Map to `--dm-*` tokens | Rename tokens, inherit Domma theme |
| `F.create()` for the add form | Possible but `shadowRoot` target needed | Medium — Domma forms target light DOM by default |

The constraint to be aware of: Domma's `$()` selector does not pierce Shadow DOM boundaries. This is already the established pattern in Domma's own web components (toast, modal, badge all use `document.createElement()` internally). The `<todo-list>` component follows the same convention.

---

## Directory layout

```
todo-component/
├── .env                     # Local build config (gitignored)
├── .env.example             # Template — copy to .env
├── .gitignore
├── package.json
├── rollup.config.js         # Dual IIFE + ESM output; .env → replace plugin
├── todo.config.json         # Runtime config fetched by the component
│
├── src/
│   ├── css/
│   │   └── todo-list.css    # All styles; injected into Shadow DOM as adopted stylesheet
│   ├── html/
│   │   └── index.html       # Dev host page; copied to dist/ by the build
│   └── js/
│       ├── constants.js         # Frozen STATUS / PRIORITY enums
│       ├── storage-adapter.js   # Namespaced localStorage wrapper
│       ├── todo-model.js        # Single-item reactive model + TODO_SCHEMA
│       ├── todo-collection.js   # Map<id, TodoModel> with persistence
│       ├── todo-list.component.js  # <todo-list> custom element
│       └── index.js             # Entry point; customElements.define()
│
├── docs/
│   └── todo-list-component.md  # This file
│
├── tests/
│   ├── playwright.config.js    # Test runner config; starts live-server automatically
│   ├── todo.spec.js            # E2E tests (component behaviour)
│   └── model.unit.spec.js      # Unit tests (model / storage) via page.evaluate()
│
└── dist/                    # Build output (gitignored)
    ├── index.html
    ├── todo.config.json
    ├── todo-list.iife.js    (+ .map)
    └── todo-list.esm.js     (+ .map)
```

---

## Environment variables

Loaded from `.env` by `rollup.config.js` via `dotenv`. Baked into the bundle at build time via `@rollup/plugin-replace` — they are **not** read at runtime.

| Variable | Default | Effect |
|----------|---------|--------|
| `DEV_PORT` | `3100` | Port for `live-server` in `npm run dev` |
| `DEBUG_MODE` | `true` | Replaces `__DEBUG__` in source; enables `console.warn` in the component |
| `BUILD_TARGET` | `development` | Replaces `__BUILD_TARGET__` in source; informational |

Set `NODE_ENV=production` (not in `.env`) to enable minification via `@rollup/plugin-terser`.

---

## Known constraints and gotchas

### `overflow: hidden` clips absolutely-positioned descendants

Any ancestor with `overflow: hidden` will clip `position: absolute` children that extend beyond its bounds. The status dropdown is `position: absolute`, so it is invisible inside an `overflow: hidden` container even though it exists in the DOM — Playwright tests can still find and interact with it, masking this class of bug.

The component avoids `overflow: hidden` on all containers that the dropdown must escape (`.todo-wrapper`, `.todo-body`). `overflow: hidden` is applied to `.todo-body` only during the collapse/expand animation via JavaScript, then cleared on `transitionend`.

### Shadow DOM and `composedPath()`

The document-level `click` handler that closes open dropdowns must use `e.composedPath().includes(shadowHost)` rather than `shadowHost.contains(e.target)`. The `.contains()` method returns `false` for elements inside a shadow root, which would cause the dropdown to close immediately on every internal click.

### Shadow DOM and `CSS.escape()`

`CSS.escape()` is used when building `querySelector` attribute selectors for item IDs (UUIDs). UUIDs start with a hex digit, so `CSS.escape` escapes the first character. This is correct behaviour — attribute selector values with CSS escape sequences are interpreted correctly by `querySelector`.

### Playwright shadow DOM piercing

Playwright 1.14+ automatically pierces open shadow roots via chained `.locator()` calls. The `pierce/selector` prefix is **not** supported in modern Playwright and will throw a CSS parse error. Use `page.locator('todo-list').locator('[data-attr]')` or the `>>>` CSS combinator.

### Storage version migration

Incrementing `storage.version` in `todo.config.json` causes the component to start reading from a new key prefix. Old data is **not** deleted automatically. To wipe old data, call `storageAdapter.clear()` on the old version, or clear `localStorage` manually.
