/**
 * Model unit tests executed via page.evaluate() in a real browser context.
 * The IIFE build exposes window.TodoList with all exported modules.
 *
 * page.evaluate() automatically waits for returned Promises, so async
 * operations (like setTimeout) work naturally.
 */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // IIFE build sets window.TodoList — wait until it's available
  await page.waitForFunction(() => typeof window.TodoList === 'object' && window.TodoList !== null);
});

// ─── Schema validation ─────────────────────────────────────────────────────────
test('model rejects missing required field (detail)', async ({ page }) => {
  const result = await page.evaluate(() => {
    const { TodoModel } = window.TodoList;
    const model = new TodoModel({});
    const { valid, errors } = model.validate();
    return { valid, hasDetailError: 'detail' in errors };
  });
  expect(result.valid).toBe(false);
  expect(result.hasDetailError).toBe(true);
});

test('model rejects invalid status', async ({ page }) => {
  const result = await page.evaluate(() => {
    const { TodoModel } = window.TodoList;
    const model = new TodoModel({ detail: 'test', status: 'INVALID' });
    const { valid, errors } = model.validate();
    return { valid, hasStatusError: 'status' in errors };
  });
  expect(result.valid).toBe(false);
  expect(result.hasStatusError).toBe(true);
});

test('model rejects invalid priority', async ({ page }) => {
  const result = await page.evaluate(() => {
    const { TodoModel } = window.TodoList;
    const model = new TodoModel({ detail: 'test', priority: 'ULTRA' });
    const { valid, errors } = model.validate();
    return { valid, hasPriorityError: 'priority' in errors };
  });
  expect(result.valid).toBe(false);
  expect(result.hasPriorityError).toBe(true);
});

test('model accepts valid data', async ({ page }) => {
  const result = await page.evaluate(() => {
    const { TodoModel } = window.TodoList;
    const model = new TodoModel({ detail: 'Valid task', status: 'NYS', priority: 'MED' });
    return model.validate();
  });
  expect(result.valid).toBe(true);
  expect(Object.keys(result.errors)).toHaveLength(0);
});

// ─── Auto-timestamps ───────────────────────────────────────────────────────────
test('model auto-generates UUID id on creation', async ({ page }) => {
  const id = await page.evaluate(() => {
    const { TodoModel } = window.TodoList;
    return new TodoModel({ detail: 'x' }).get('id');
  });
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('model auto-updates amended_at on set()', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { TodoModel } = window.TodoList;
    const model = new TodoModel({ detail: 'test' });
    const before = model.get('amended_at');
    await new Promise(r => setTimeout(r, 10));
    model.set('detail', 'updated');
    const after = model.get('amended_at');
    return { before, after, changed: before !== after };
  });
  expect(result.changed).toBe(true);
});

// ─── Terminal status management ────────────────────────────────────────────────
test('sets completed_at when status transitions to terminal (CMP)', async ({ page }) => {
  const result = await page.evaluate(() => {
    const { TodoModel } = window.TodoList;
    const model = new TodoModel({ detail: 'test', status: 'NYS' });
    const before = model.get('completed_at');
    model.set('status', 'CMP');
    return { before, after: model.get('completed_at') };
  });
  expect(result.before).toBeNull();
  expect(result.after).not.toBeNull();
});

test('clears completed_at when transitioning away from terminal status', async ({ page }) => {
  const result = await page.evaluate(() => {
    const { TodoModel } = window.TodoList;
    const model = new TodoModel({ detail: 'test', status: 'CMP' });
    model.set('status', 'INP');
    return model.get('completed_at');
  });
  expect(result).toBeNull();
});

// ─── onChange pub/sub ──────────────────────────────────────────────────────────
test('onChange callback fires on field change', async ({ page }) => {
  const callCount = await page.evaluate(() => {
    const { TodoModel } = window.TodoList;
    const model = new TodoModel({ detail: 'initial' });
    let count = 0;
    model.onChange(() => count++);
    model.set('detail', 'updated');
    return count;
  });
  expect(callCount).toBe(1);
});

test('onFieldChange fires only for watched field', async ({ page }) => {
  const result = await page.evaluate(() => {
    const { TodoModel } = window.TodoList;
    const model = new TodoModel({ detail: 'test' });
    let detailFired = 0;
    let statusFired = 0;
    model.onFieldChange('detail', () => detailFired++);
    model.onFieldChange('status', () => statusFired++);
    model.set('detail', 'new detail');
    return { detailFired, statusFired };
  });
  expect(result.detailFired).toBe(1);
  expect(result.statusFired).toBe(0);
});

// ─── StorageAdapter ────────────────────────────────────────────────────────────
test('StorageAdapter namespaces keys correctly', async ({ page }) => {
  const result = await page.evaluate(() => {
    const { StorageAdapter } = window.TodoList;
    const adapter = new StorageAdapter('test', 1);
    adapter.set('mykey', { foo: 'bar' });
    const rawKey = Object.keys(localStorage).find(k => k.includes('mykey'));
    const value = adapter.get('mykey');
    adapter.clear();
    return { rawKey, value };
  });
  expect(result.rawKey).toBe('test:v1:mykey');
  expect(result.value).toEqual({ foo: 'bar' });
});

test('StorageAdapter.clear() removes only its own namespace keys', async ({ page }) => {
  const result = await page.evaluate(() => {
    const { StorageAdapter } = window.TodoList;
    const a = new StorageAdapter('ns-a', 1);
    const b = new StorageAdapter('ns-b', 1);
    a.set('key1', 'aaa');
    b.set('key1', 'bbb');
    a.clear();
    return {
      aGone: a.has('key1'),
      bStillThere: b.has('key1'),
      bValue: b.get('key1')
    };
  });
  expect(result.aGone).toBe(false);
  expect(result.bStillThere).toBe(true);
  expect(result.bValue).toBe('bbb');
});
