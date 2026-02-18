import {
  STATUS,
  STATUS_LABELS,
  STATUS_COLOURS,
  PRIORITY,
  PRIORITY_LABELS,
  PRIORITY_COLOURS,
  TERMINAL_STATUSES
} from './constants.js';
import { StorageAdapter } from './storage-adapter.js';
import { TodoCollection } from './todo-collection.js';
import styles from '../css/todo-list.css';

// ─── SVG Icons (static, no user data) ────────────────────────────────────────
const ICON_EYE = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
</svg>`;

const ICON_EYE_OFF = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
</svg>`;

const ICON_TRASH = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
</svg>`;

const DEFAULT_CONFIG = {
  storage: { namespace: 'todo', version: 1 },
  defaults: { owner: '', status: STATUS.NYS, priority: PRIORITY.MED },
  statuses: { enabled: Object.values(STATUS), terminal: TERMINAL_STATUSES },
  ui: { showOwner: true, confirmOnDelete: true, dateFormat: 'DD/MM/YYYY HH:mm' }
};

/** Encode HTML entities. Applied to all user-supplied and config-sourced strings. */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * `<todo-list>` web component.
 *
 * Attributes:
 *   config-url  - Path to todo.config.json (default: './todo.config.json')
 *   owner       - Default owner name override
 *   collapsed   - Start collapsed (boolean attribute)
 *
 * Public API:
 *   addItem(data), removeItem(id), getItems(), clearCompleted()
 *
 * Custom events (composed, bubbles):
 *   todo:add, todo:update, todo:remove
 */
export class TodoListComponent extends HTMLElement {
  static get observedAttributes() {
    return ['collapsed', 'owner'];
  }

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
    this._config = null;
    this._collection = null;
    this._activeFilter = 'ALL';
    this._collapsed = false;
    this._unsubscribe = null;
    this._outsideClickHandler = null;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async connectedCallback() {
    this._collapsed = this.hasAttribute('collapsed');
    await this._loadConfig();
    this._initCollection();
    this._render();
    this._bindEvents();
    this._refreshList();
  }

  disconnectedCallback() {
    this._cleanup();
  }

  attributeChangedCallback(name, _old, value) {
    if (!this._collection) return;
    if (name === 'collapsed') {
      this._collapsed = value !== null;
      this._syncCollapseState();
    }
    if (name === 'owner') {
      this._config.defaults.owner = value || '';
    }
  }

  // ─── Initialisation ────────────────────────────────────────────────────────

  async _loadConfig() {
    const url = this.getAttribute('config-url') || './todo.config.json';
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const userConfig = await resp.json();
      this._config = this._mergeConfig(DEFAULT_CONFIG, userConfig);
    } catch {
      this._config = { ...DEFAULT_CONFIG };
    }

    if (this.hasAttribute('owner')) {
      this._config.defaults.owner = this.getAttribute('owner') || '';
    }
  }

  _mergeConfig(base, override) {
    return {
      storage: { ...base.storage, ...override.storage },
      defaults: { ...base.defaults, ...override.defaults },
      statuses: { ...base.statuses, ...override.statuses },
      ui: { ...base.ui, ...override.ui }
    };
  }

  _initCollection() {
    const { namespace, version } = this._config.storage;
    const adapter = new StorageAdapter(namespace, version);
    this._collection = new TodoCollection(adapter);

    this._unsubscribe = this._collection.onChange((event, model) => {
      this._refreshList();
      this._updateCount();
      if (event !== 'clear') {
        this._emit(`todo:${event}`, { item: model?.toJSON() });
      }
    });
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  _injectStyles() {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this._shadow.adoptedStyleSheets = [sheet];
  }

  /**
   * Build the initial scaffold. All dynamic string values passed to innerHTML
   * are run through esc() to prevent XSS. STATUS_LABELS/PRIORITY_LABELS values
   * come from frozen string constants and contain no HTML, but are escaped too
   * for defence-in-depth.
   */
  _render() {
    this._injectStyles();

    const cfg = this._config;
    const enabledStatuses = cfg.statuses.enabled;
    const defaultOwner = esc(cfg.defaults.owner || '');

    // Build filter buttons — values from frozen STATUS_LABELS constants
    const filterBtns = enabledStatuses
      .map(s => `<button class="todo-filter-btn" data-filter="${esc(s)}">${esc(STATUS_LABELS[s])}</button>`)
      .join('');

    // Build priority options — values from frozen PRIORITY / PRIORITY_LABELS constants
    const priorityOptions = Object.values(PRIORITY)
      .map(p => `<option value="${esc(p)}"${p === cfg.defaults.priority ? ' selected' : ''}>${esc(PRIORITY_LABELS[p])}</option>`)
      .join('');

    const ownerField = cfg.ui.showOwner ? `
      <div class="todo-field">
        <label for="todo-owner-input">Owner</label>
        <input
          id="todo-owner-input"
          class="todo-input"
          type="text"
          name="owner"
          placeholder="${defaultOwner || 'Owner'}"
          value="${defaultOwner}"
          autocomplete="off"
          data-input-owner
        />
      </div>
    ` : '';

    // Static structural HTML — no user data at this point
    this._shadow.innerHTML = `
      <div class="todo-wrapper" part="wrapper">
        <div class="todo-header">
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <h2 class="todo-header__title">Tasks</h2>
            <span class="todo-header__count" data-count>0</span>
          </div>
          <div class="todo-header__actions">
            <button class="todo-toggle-btn" data-toggle title="Toggle visibility" aria-label="Toggle todo list">
              ${this._collapsed ? ICON_EYE_OFF : ICON_EYE}
            </button>
          </div>
        </div>

        <div class="todo-body${this._collapsed ? ' is-collapsed' : ''}" data-body>
          <div class="todo-filters" data-filters>
            <button class="todo-filter-btn is-active" data-filter="ALL">All</button>
            ${filterBtns}
          </div>

          <form class="todo-add-form" data-add-form novalidate>
            <div class="todo-add-form__row">
              <div class="todo-add-form__fields">
                <div class="todo-field todo-field--detail">
                  <label for="todo-detail-input">Task</label>
                  <input
                    id="todo-detail-input"
                    class="todo-input"
                    type="text"
                    name="detail"
                    placeholder="Add a new task&#x2026;"
                    maxlength="500"
                    autocomplete="off"
                    data-input-detail
                  />
                </div>
                ${ownerField}
                <div class="todo-field">
                  <label for="todo-priority-select">Priority</label>
                  <select id="todo-priority-select" class="todo-select" name="priority" data-input-priority>
                    ${priorityOptions}
                  </select>
                </div>
              </div>
              <button type="submit" class="todo-btn todo-btn--primary" data-add-submit>Add</button>
            </div>
          </form>

          <ul class="todo-list" data-list role="list"></ul>

          <div class="todo-footer">
            <span data-footer-text>0 items</span>
            <button class="todo-footer__clear" data-clear-completed>Clear completed</button>
          </div>
        </div>
      </div>
    `;

    const body = this._shadow.querySelector('[data-body]');
    if (!this._collapsed) {
      body.style.maxHeight = '2000px';
    }
  }

  _refreshList() {
    const list = this._shadow.querySelector('[data-list]');
    if (!list) return;

    const items = this._activeFilter === 'ALL'
      ? this._collection.getAll()
      : this._collection.filterByStatus(this._activeFilter);

    // Non-terminal first, then newest-first within each group
    items.sort((a, b) => {
      const aT = TERMINAL_STATUSES.includes(a.get('status'));
      const bT = TERMINAL_STATUSES.includes(b.get('status'));
      if (aT !== bT) return aT ? 1 : -1;
      return new Date(b.get('added_at')) - new Date(a.get('added_at'));
    });

    if (items.length === 0) {
      const li = document.createElement('li');
      const empty = document.createElement('div');
      empty.className = 'todo-empty';

      const icon = document.createElement('div');
      icon.className = 'todo-empty__icon';
      icon.textContent = '✓';

      const text = document.createElement('div');
      text.className = 'todo-empty__text';
      text.textContent = this._activeFilter === 'ALL'
        ? 'No tasks yet. Add one above.'
        : 'No tasks with this status.';

      empty.appendChild(icon);
      empty.appendChild(text);
      li.appendChild(empty);
      list.replaceChildren(li);
    } else {
      // Build item HTML — all user data escaped via esc()
      list.innerHTML = items.map(m => this._renderItem(m)).join('');
    }

    this._updateCount();
  }

  /**
   * Render a single item row.
   * All user-supplied fields (detail, owner, due_at) go through esc().
   * Enum values from frozen constants (STATUS_LABELS, PRIORITY_LABELS) are
   * also escaped for defence-in-depth.
   */
  _renderItem(model) {
    const data = model.toJSON();
    const isTerminal = TERMINAL_STATUSES.includes(data.status);
    const colour = STATUS_COLOURS[data.status] || 'grey';
    const priColour = PRIORITY_COLOURS[data.priority] || 'slate';
    const cfg = this._config;

    // ── meta row pieces (user data → esc()) ──────────────────────────────
    let metaHtml = '';
    if (cfg.ui.showOwner && data.owner) {
      metaHtml += `<span class="todo-item__owner">${esc(data.owner)}</span>`;
    }
    if (data.due_at) {
      const overdue = !isTerminal && new Date(data.due_at) < new Date();
      metaHtml += `<span class="todo-item__due${overdue ? ' is-overdue' : ''}">${esc(this._formatDate(data.due_at))}</span>`;
    }
    if (data.priority && data.priority !== PRIORITY.MED) {
      metaHtml += `<span class="todo-badge todo-badge--${esc(priColour)}" style="cursor:default">${esc(PRIORITY_LABELS[data.priority])}</span>`;
    }

    // ── status dropdown (enum values from frozen constants → esc()) ──────
    const enabledStatuses = cfg.statuses.enabled;
    const dropdownOptions = enabledStatuses.map(s => `
      <div class="todo-status-option${s === data.status ? ' is-current' : ''}"
           data-status-option="${esc(s)}"
           data-item-id="${esc(data.id)}">
        <span class="todo-badge todo-badge--${esc(STATUS_COLOURS[s])}">${esc(STATUS_LABELS[s])}</span>
      </div>
    `).join('');

    return `
      <li class="todo-item${data.is_archived ? ' is-archived' : ''}" data-item-id="${esc(data.id)}">
        <div class="todo-item__body">
          <div class="todo-item__detail${isTerminal ? ' is-terminal' : ''}">${esc(data.detail)}</div>
          ${metaHtml ? `<div class="todo-item__meta">${metaHtml}</div>` : ''}
        </div>
        <div class="todo-item__actions">
          <div class="todo-status-picker" data-status-picker>
            <button
              class="todo-badge todo-badge--${esc(colour)}"
              data-status-badge="${esc(data.id)}"
              aria-label="Change status: ${esc(STATUS_LABELS[data.status])}"
            >${esc(STATUS_LABELS[data.status])}</button>
            <div class="todo-status-dropdown" data-status-dropdown="${esc(data.id)}">
              ${dropdownOptions}
            </div>
          </div>
          <button class="todo-delete-btn" data-delete="${esc(data.id)}" aria-label="Delete task" title="Delete">
            ${ICON_TRASH}
          </button>
        </div>
      </li>
    `;
  }

  _updateCount() {
    const all = this._collection.getAll();
    const active = all.filter(m => !TERMINAL_STATUSES.includes(m.get('status')));

    const countEl = this._shadow.querySelector('[data-count]');
    if (countEl) countEl.textContent = all.length;

    const footerEl = this._shadow.querySelector('[data-footer-text]');
    if (footerEl) {
      footerEl.textContent = `${active.length} active · ${all.length} total`;
    }
  }

  _syncCollapseState() {
    const body = this._shadow.querySelector('[data-body]');
    const btn = this._shadow.querySelector('[data-toggle]');
    if (!body || !btn) return;

    if (this._collapsed) {
      body.classList.add('is-collapsed');
      btn.innerHTML = ICON_EYE_OFF;
      btn.title = 'Show list';
    } else {
      body.style.maxHeight = '2000px';
      body.classList.remove('is-collapsed');
      btn.innerHTML = ICON_EYE;
      btn.title = 'Hide list';
    }
  }

  // ─── Event Binding ─────────────────────────────────────────────────────────

  _bindEvents() {
    const root = this._shadow;

    root.querySelector('[data-toggle]')?.addEventListener('click', () => {
      this._collapsed = !this._collapsed;
      this._syncCollapseState();
    });

    root.querySelector('[data-add-form]')?.addEventListener('submit', e => {
      e.preventDefault();
      this._handleAdd();
    });

    root.querySelector('[data-filters]')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      this._activeFilter = btn.dataset.filter;
      root.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      this._refreshList();
    });

    root.querySelector('[data-list]')?.addEventListener('click', e => this._handleListClick(e));

    // composedPath() traverses shadow root boundaries — check if the host
    // appears anywhere in the path to determine if click is inside the component
    this._outsideClickHandler = e => {
      if (!e.composedPath().includes(this._shadow.host)) {
        this._closeAllDropdowns();
      }
    };
    document.addEventListener('click', this._outsideClickHandler);

    root.querySelector('[data-clear-completed]')?.addEventListener('click', () => {
      this._collection.clearCompleted();
    });
  }

  _handleAdd() {
    const detailInput = this._shadow.querySelector('[data-input-detail]');
    const ownerInput = this._shadow.querySelector('[data-input-owner]');
    const priorityInput = this._shadow.querySelector('[data-input-priority]');

    const detail = detailInput?.value.trim();
    if (!detail) {
      detailInput?.focus();
      return;
    }

    try {
      this._collection.add({
        detail,
        owner: ownerInput?.value.trim() || this._config.defaults.owner || '',
        priority: priorityInput?.value || this._config.defaults.priority,
        status: this._config.defaults.status
      });

      if (detailInput) detailInput.value = '';
      detailInput?.focus();
    } catch (err) {
      if (__DEBUG__) console.warn('[TodoList] Add failed:', err.message);
    }
  }

  _handleListClick(e) {
    const badge = e.target.closest('[data-status-badge]');
    if (badge) {
      const id = badge.dataset.statusBadge;
      const dropdown = this._shadow.querySelector(`[data-status-dropdown="${CSS.escape(id)}"]`);
      if (dropdown) {
        this._closeAllDropdowns(dropdown);
        dropdown.classList.toggle('is-open');
      }
      return;
    }

    const option = e.target.closest('[data-status-option]');
    if (option) {
      const { statusOption, itemId } = option.dataset;
      const model = this._collection.get(itemId);
      if (model) model.set('status', statusOption);
      this._closeAllDropdowns();
      return;
    }

    const deleteBtn = e.target.closest('[data-delete]');
    if (deleteBtn) {
      this._handleDelete(deleteBtn.dataset.delete);
    }
  }

  async _handleDelete(id) {
    if (this._config.ui.confirmOnDelete) {
      const confirmed = window.confirm('Delete this task?');
      if (!confirmed) return;
    }

    const item = this._shadow.querySelector(`[data-item-id="${CSS.escape(id)}"]`);
    if (item) {
      item.classList.add('is-removing');
      await new Promise(r => setTimeout(r, 200));
    }

    this._collection.remove(id);
  }

  _closeAllDropdowns(except = null) {
    this._shadow.querySelectorAll('.todo-status-dropdown.is-open').forEach(d => {
      if (d !== except) d.classList.remove('is-open');
    });
  }

  _cleanup() {
    if (this._unsubscribe) this._unsubscribe();
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler);
    }
  }

  // ─── Custom Events ──────────────────────────────────────────────────────────

  _emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, {
      detail,
      bubbles: true,
      composed: true
    }));
  }

  // ─── Utility ───────────────────────────────────────────────────────────────

  _formatDate(iso) {
    try {
      return new Date(iso).toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** @param {Partial<Record<string,*>>} data */
  addItem(data) {
    return this._collection.add(data);
  }

  /** @param {string} id */
  removeItem(id) {
    return this._collection.remove(id);
  }

  /** @returns {Array<Record<string,*>>} */
  getItems() {
    return this._collection.getAll().map(m => m.toJSON());
  }

  clearCompleted() {
    this._collection.clearCompleted();
  }
}
