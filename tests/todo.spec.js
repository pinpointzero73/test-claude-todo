/**
 * E2E tests for <todo-list> web component.
 *
 * Shadow DOM piercing: Playwright 1.14+ automatically pierces open shadow roots
 * when using chained locators (.locator() on a host element) or the >>> combinator.
 * No `pierce/` prefix needed.
 */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');

  // Clear localStorage and reload for clean state
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Wait for the custom element to be defined and connected
  await page.waitForFunction(() => customElements.get('todo-list') !== undefined);
  await page.waitForSelector('todo-list');
  // Brief pause for async connectedCallback (config fetch)
  await page.waitForTimeout(200);
});

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Returns a locator scoped to the first <todo-list> element.
 *  Chained .locator() calls pierce the Shadow root automatically. */
function todo(page) {
  return page.locator('todo-list').first();
}

// ─── 1. Empty state ────────────────────────────────────────────────────────────
test('renders empty state message', async ({ page }) => {
  await expect(todo(page).locator('.todo-empty__text')).toBeVisible();
  await expect(todo(page).locator('.todo-empty__text')).toContainText('No tasks yet');
});

// ─── 2. Add item ───────────────────────────────────────────────────────────────
test('adds a new task via the form', async ({ page }) => {
  await todo(page).locator('[data-input-detail]').fill('Write Playwright tests');
  await todo(page).locator('[data-add-submit]').click();

  await expect(todo(page).locator('.todo-item__detail').first()).toContainText('Write Playwright tests');
});

// ─── 3. Status change ─────────────────────────────────────────────────────────
test('changes status via badge dropdown', async ({ page }) => {
  await todo(page).locator('[data-input-detail]').fill('Test status change');
  await todo(page).locator('[data-add-submit]').click();

  const badge = todo(page).locator('[data-status-badge]').first();
  await badge.click();

  await todo(page).locator('[data-status-option="INP"]').first().click();

  await expect(badge).toContainText('In Progress');
});

// ─── 4. Delete item ────────────────────────────────────────────────────────────
test('deletes an item after confirmation', async ({ page }) => {
  await todo(page).locator('[data-input-detail]').fill('Item to delete');
  await todo(page).locator('[data-add-submit]').click();

  await expect(todo(page).locator('.todo-item').first()).toBeVisible();

  page.once('dialog', d => d.accept());
  await todo(page).locator('[data-delete]').first().click();

  await expect(todo(page).locator('.todo-empty__text')).toBeVisible();
});

// ─── 5. Filter by status ──────────────────────────────────────────────────────
test('filters items by status', async ({ page }) => {
  // Add two items
  await todo(page).locator('[data-input-detail]').fill('Task A');
  await todo(page).locator('[data-add-submit]').click();

  await todo(page).locator('[data-input-detail]').fill('Task B');
  await todo(page).locator('[data-add-submit]').click();

  // Component sorts newest-first — Task B (added second) is at index 0
  // Change Task B's status to INP
  await todo(page).locator('[data-status-badge]').first().click();
  await todo(page).locator('[data-status-option="INP"]').first().click();

  // Filter to NYS only — only Task A (still NYS) should remain
  await todo(page).locator('[data-filter="NYS"]').click();

  await expect(todo(page).locator('.todo-item')).toHaveCount(1);
  await expect(todo(page).locator('.todo-item__detail').first()).toContainText('Task A');
});

// ─── 6. Persistence across reload ─────────────────────────────────────────────
test('persists items across page reload', async ({ page }) => {
  await todo(page).locator('[data-input-detail]').fill('Persistent task');
  await todo(page).locator('[data-add-submit]').click();

  await expect(todo(page).locator('.todo-item__detail').first()).toContainText('Persistent task');

  await page.reload();
  await page.waitForFunction(() => customElements.get('todo-list') !== undefined);
  await page.waitForTimeout(200);

  await expect(todo(page).locator('.todo-item__detail').first()).toContainText('Persistent task');
});

// ─── 7. Toggle collapse ───────────────────────────────────────────────────────
test('toggles list visibility via eye icon', async ({ page }) => {
  const body = todo(page).locator('[data-body]');

  await expect(body).not.toHaveClass(/is-collapsed/);

  await todo(page).locator('[data-toggle]').click();
  await expect(body).toHaveClass(/is-collapsed/);

  await todo(page).locator('[data-toggle]').click();
  await expect(body).not.toHaveClass(/is-collapsed/);
});

// ─── 8. Custom event emission ─────────────────────────────────────────────────
test('emits todo:add custom event when item is added', async ({ page }) => {
  // Set up the listener first (page.evaluate returns a Promise that resolves
  // when the event fires — Playwright waits for it)
  const eventPromise = page.evaluate(() =>
    new Promise(resolve => {
      document.addEventListener('todo:add', e => resolve(e.detail?.item?.detail), { once: true });
    })
  );

  await todo(page).locator('[data-input-detail]').fill('Event emission test');
  await todo(page).locator('[data-add-submit]').click();

  const detail = await eventPromise;
  expect(detail).toBe('Event emission test');
});

// ─── 9. Clear completed ───────────────────────────────────────────────────────
test('clears completed items via footer button', async ({ page }) => {
  await todo(page).locator('[data-input-detail]').fill('Complete me');
  await todo(page).locator('[data-add-submit]').click();

  // Mark as Complete
  await todo(page).locator('[data-status-badge]').first().click();
  await todo(page).locator('[data-status-option="CMP"]').first().click();

  await expect(todo(page).locator('.todo-item').first()).toBeVisible();

  await todo(page).locator('[data-clear-completed]').click();

  await expect(todo(page).locator('.todo-empty__text')).toBeVisible();
});

// ─── 10. Public API ───────────────────────────────────────────────────────────
test('addItem() public API works', async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector('todo-list').addItem({ detail: 'Added via API' });
  });

  await expect(todo(page).locator('.todo-item__detail').first()).toContainText('Added via API');
});
