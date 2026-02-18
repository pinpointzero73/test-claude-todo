import { TERMINAL_STATUSES } from './constants.js';
import { TodoModel } from './todo-model.js';
import { StorageAdapter } from './storage-adapter.js';

const STORAGE_KEY = 'items';

/**
 * List manager wrapping Map<id, TodoModel>.
 * Auto-persists every mutation to localStorage via StorageAdapter.
 * Fires pub/sub events for collection-level changes.
 */
export class TodoCollection {
  /**
   * @param {StorageAdapter} storageAdapter
   */
  constructor(storageAdapter) {
    this._storage = storageAdapter;
    this._items = new Map();
    this._listeners = [];
    this._load();
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  _load() {
    const raw = this._storage.get(STORAGE_KEY, []);
    if (Array.isArray(raw)) {
      raw.forEach(data => {
        const model = new TodoModel(data);
        this._items.set(model.get('id'), model);
        // Register the same listener that add() wires — without this,
        // model.set() on a loaded item fires no collection event and the UI never updates.
        model.onChange(() => {
          this._save();
          this._notify('update', model);
        });
      });
    }
  }

  _save() {
    this._storage.set(STORAGE_KEY, this.getAll().map(m => m.toJSON()));
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  /**
   * Add a new todo item.
   * @param {Partial<Record<string,*>>} data
   * @returns {TodoModel}
   */
  add(data) {
    const model = new TodoModel(data);
    const { valid, errors } = model.validate();
    if (!valid) {
      throw new Error(`Invalid todo: ${JSON.stringify(errors)}`);
    }
    this._items.set(model.get('id'), model);

    // Re-persist when any field on this item changes
    model.onChange(() => {
      this._save();
      this._notify('update', model);
    });

    this._save();
    this._notify('add', model);
    return model;
  }

  /**
   * Remove a todo item by id.
   * @param {string} id
   * @returns {boolean}
   */
  remove(id) {
    const model = this._items.get(id);
    if (!model) return false;
    this._items.delete(id);
    this._save();
    this._notify('remove', model);
    return true;
  }

  /**
   * Get a single item by id.
   * @param {string} id
   * @returns {TodoModel|undefined}
   */
  get(id) {
    return this._items.get(id);
  }

  /** @returns {TodoModel[]} All items in insertion order */
  getAll() {
    return [...this._items.values()];
  }

  /**
   * Filter items with a predicate.
   * @param {function(TodoModel): boolean} predicate
   * @returns {TodoModel[]}
   */
  filter(predicate) {
    return this.getAll().filter(predicate);
  }

  /**
   * @param {string|string[]} status - One or multiple STATUS values
   * @returns {TodoModel[]}
   */
  filterByStatus(status) {
    const statuses = Array.isArray(status) ? status : [status];
    return this.filter(m => statuses.includes(m.get('status')));
  }

  /**
   * @param {string} owner
   * @returns {TodoModel[]}
   */
  filterByOwner(owner) {
    return this.filter(m => m.get('owner') === owner);
  }

  /** Permanently remove all terminal-status and is_archived items */
  clearArchive() {
    this.filter(m => TERMINAL_STATUSES.includes(m.get('status')) || m.get('is_archived'))
      .forEach(m => this.remove(m.get('id')));
  }

  /** Wipe all items from memory and storage */
  clear() {
    this._items.clear();
    this._storage.remove(STORAGE_KEY);
    this._notify('clear', null);
  }

  /** @returns {number} */
  get size() {
    return this._items.size;
  }

  // ─── Pub/Sub ───────────────────────────────────────────────────────────────

  _notify(event, model) {
    this._listeners.forEach(fn => fn(event, model));
  }

  /**
   * Subscribe to collection-level events (add / update / remove / clear).
   * @param {function(event: string, model: TodoModel|null): void} callback
   * @returns {function} Unsubscribe function
   */
  onChange(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(fn => fn !== callback);
    };
  }
}
