/**
 * Namespaced localStorage adapter.
 * Class-based so multiple instances can coexist with different namespaces.
 * Mirrors Domma's storage.js pattern for low-friction future integration.
 *
 * Key format: `{namespace}:v{version}:{key}`
 */
export class StorageAdapter {
  /**
   * @param {string} namespace  - e.g. "todo"
   * @param {number} version    - e.g. 1 → produces prefix "todo:v1:"
   */
  constructor(namespace, version = 1) {
    this._prefix = `${namespace}:v${version}:`;
  }

  _key(key) {
    return `${this._prefix}${key}`;
  }

  /**
   * Retrieve a parsed value, or `defaultValue` if absent / unparseable.
   * @template T
   * @param {string} key
   * @param {T} [defaultValue=null]
   * @returns {T}
   */
  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(this._key(key));
      return raw === null ? defaultValue : JSON.parse(raw);
    } catch {
      return defaultValue;
    }
  }

  /**
   * Serialise and store a value.
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    localStorage.setItem(this._key(key), JSON.stringify(value));
  }

  /** @param {string} key */
  remove(key) {
    localStorage.removeItem(this._key(key));
  }

  /** @param {string} key @returns {boolean} */
  has(key) {
    return localStorage.getItem(this._key(key)) !== null;
  }

  /** @returns {string[]} Unprefixed keys belonging to this adapter */
  keys() {
    return Object.keys(localStorage)
      .filter(k => k.startsWith(this._prefix))
      .map(k => k.slice(this._prefix.length));
  }

  /** @returns {Record<string, *>} All key/value pairs for this namespace */
  getAll() {
    return this.keys().reduce((acc, key) => {
      acc[key] = this.get(key);
      return acc;
    }, {});
  }

  /** Remove all keys belonging to this adapter */
  clear() {
    this.keys().forEach(key => this.remove(key));
  }
}
