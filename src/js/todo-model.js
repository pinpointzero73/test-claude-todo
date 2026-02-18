import { STATUS, PRIORITY, TERMINAL_STATUSES } from './constants.js';

/** @returns {string} UUID v4 with fallback for older environments */
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** @returns {string} Current time as ISO 8601 string */
const now = () => new Date().toISOString();

/**
 * Frozen schema defining every field's type, defaults, and validation rules.
 * Mirrors Domma's M.create() blueprint for 1:1 future integration.
 */
export const TODO_SCHEMA = Object.freeze({
  id: {
    type: 'string',
    required: true,
    default: () => generateId()
  },
  detail: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 500,
    default: null,
    validate: v => typeof v === 'string' && v.trim().length >= 1 && v.length <= 500
  },
  owner: {
    type: 'string',
    required: false,
    default: ''
  },
  status: {
    type: 'string',
    required: true,
    default: STATUS.NYS,
    validate: v => Object.values(STATUS).includes(v)
  },
  priority: {
    type: 'string',
    required: false,
    default: PRIORITY.MED,
    validate: v => Object.values(PRIORITY).includes(v)
  },
  due_at: {
    type: 'string',
    required: false,
    default: null,
    validate: v => v === null || !isNaN(Date.parse(v))
  },
  tags: {
    type: 'array',
    required: false,
    default: () => []
  },
  sort_order: {
    type: 'number',
    required: false,
    default: 0
  },
  is_archived: {
    type: 'boolean',
    required: false,
    default: false
  },
  added_at: {
    type: 'string',
    required: true,
    default: () => now()
  },
  amended_at: {
    type: 'string',
    required: true,
    default: () => now()
  },
  completed_at: {
    type: 'string',
    required: false,
    default: null
  }
});

/**
 * Single-item reactive model.
 * Auto-manages timestamps and completed_at based on status transitions.
 * Mirrors Domma's Model class for low-friction future integration.
 */
export class TodoModel {
  /**
   * @param {Partial<Record<keyof typeof TODO_SCHEMA, *>>} [data={}]
   */
  constructor(data = {}) {
    this._data = {};
    this._listeners = [];
    this._fieldListeners = {};

    // Initialise with schema defaults, then overlay provided data
    for (const [field, schema] of Object.entries(TODO_SCHEMA)) {
      const defaultVal = typeof schema.default === 'function'
        ? schema.default()
        : schema.default;
      this._data[field] = Object.prototype.hasOwnProperty.call(data, field)
        ? data[field]
        : defaultVal;
    }
  }

  /**
   * Get a field value, or all data if no key provided.
   * @param {string} [key]
   * @returns {*}
   */
  get(key) {
    return key ? this._data[key] : { ...this._data };
  }

  /**
   * Set one or more fields. Auto-updates `amended_at` and manages `completed_at`.
   * @param {string|Record<string,*>} keyOrObject
   * @param {*} [value]
   */
  set(keyOrObject, value) {
    const updates = typeof keyOrObject === 'string'
      ? { [keyOrObject]: value }
      : keyOrObject;

    const prev = { ...this._data };

    for (const [field, val] of Object.entries(updates)) {
      if (field in TODO_SCHEMA) {
        this._data[field] = val;
      }
    }

    // Auto-update amended_at unless it's the field being set
    if (!('amended_at' in updates)) {
      this._data.amended_at = now();
    }

    // Auto-manage completed_at on status transition
    if ('status' in updates) {
      const isTerminal = TERMINAL_STATUSES.includes(updates.status);
      const wasTerminal = TERMINAL_STATUSES.includes(prev.status);
      if (isTerminal && !wasTerminal) {
        this._data.completed_at = now();
      } else if (!isTerminal && wasTerminal) {
        this._data.completed_at = null;
      }
    }

    // Notify listeners
    this._listeners.forEach(fn => fn(this._data, prev));
    for (const [field] of Object.entries(updates)) {
      if (this._fieldListeners[field]) {
        this._fieldListeners[field].forEach(fn => fn(this._data[field], prev[field]));
      }
    }
  }

  /**
   * Validate all fields against their schema rules.
   * @returns {{ valid: boolean, errors: Record<string, string> }}
   */
  validate() {
    const errors = {};

    for (const [field, schema] of Object.entries(TODO_SCHEMA)) {
      const val = this._data[field];

      if (schema.required && (val === null || val === undefined || val === '')) {
        errors[field] = `${field} is required`;
        continue;
      }

      if (val !== null && val !== undefined) {
        if (schema.minLength !== undefined && typeof val === 'string' && val.length < schema.minLength) {
          errors[field] = `${field} must be at least ${schema.minLength} characters`;
        } else if (schema.maxLength !== undefined && typeof val === 'string' && val.length > schema.maxLength) {
          errors[field] = `${field} must be at most ${schema.maxLength} characters`;
        } else if (schema.validate && !schema.validate(val)) {
          errors[field] = `${field} has an invalid value`;
        }
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  /**
   * Subscribe to any change on this model.
   * @param {function(data: object, prev: object): void} callback
   * @returns {function} Unsubscribe function
   */
  onChange(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(fn => fn !== callback);
    };
  }

  /**
   * Subscribe to changes on a specific field.
   * @param {string} field
   * @param {function(newVal: *, oldVal: *): void} callback
   * @returns {function} Unsubscribe function
   */
  onFieldChange(field, callback) {
    if (!this._fieldListeners[field]) this._fieldListeners[field] = [];
    this._fieldListeners[field].push(callback);
    return () => {
      this._fieldListeners[field] = this._fieldListeners[field].filter(fn => fn !== callback);
    };
  }

  /** @returns {Record<string, *>} Plain serialisable snapshot */
  toJSON() {
    return { ...this._data };
  }
}
