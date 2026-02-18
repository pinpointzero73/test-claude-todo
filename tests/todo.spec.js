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

test('add form has a status selector and respects chosen status', async ({ page }) => {
  const statusSelect = todo(page).locator('[data-input-status]');
  await expect(statusSelect).toBeVisible();

  // Select "In Progress" before adding
  await statusSelect.selectOption('INP');
  await todo(page).locator('[data-input-detail]').fill('Already in progress');
  await todo(page).locator('[data-add-submit]').click();

  // Badge should reflect the selected status, not default NYS
  await expect(todo(page).locator('[data-status-badge]').first()).toContainText('In Progress');
});

// ─── 3a. Status change — dropdown is visible (not clipped by overflow:hidden) ─
test('status dropdown options are visible and not clipped after adding a task', async ({ page }) => {
  await todo(page).locator('[data-input-detail]').fill('Overflow test');
  await todo(page).locator('[data-add-submit]').click();

  const badge = todo(page).locator('[data-status-badge]').first();
  await badge.click();

  // Dropdown must be visible (not display:none or clipped by overflow:hidden)
  const dropdown = todo(page).locator('.todo-status-dropdown.is-open').first();
  await expect(dropdown).toBeVisible();

  // Every status option inside the open dropdown must have a non-zero bounding box,
  // proving overflow:hidden on .todo-body is not clipping them
  const options = todo(page).locator('.todo-status-dropdown.is-open .todo-status-option');
  const count = await options.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const box = await options.nth(i).boundingBox();
    expect(box, `Status option ${i} has no bounding box — likely clipped`).not.toBeNull();
    expect(box.height, `Status option ${i} height is zero — likely clipped`).toBeGreaterThan(0);
    expect(box.width, `Status option ${i} width is zero — likely clipped`).toBeGreaterThan(0);
  }
});

// ─── 3b. Status change via badge dropdown ─────────────────────────────────────
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

// ─── 9. Archive: completed tasks move out of main list ────────────────────────
test('completed tasks move to archive and can be cleared', async ({ page }) => {
  await todo(page).locator('[data-input-detail]').fill('Complete me');
  await todo(page).locator('[data-add-submit]').click();

  // Mark as Complete — item should leave the main list immediately
  await todo(page).locator('[data-status-badge]').first().click();
  await todo(page).locator('[data-status-option="CMP"]').first().click();

  // Main list is now empty
  await expect(todo(page).locator('.todo-empty__text')).toBeVisible();

  // Archive panel shows the completed item — expand it first
  await page.locator('todo-list').first().locator('[data-archive-toggle]').click();
  await expect(page.locator('todo-list').first().locator('[data-archive-list] .todo-archive__row').first()).toBeVisible();

  // Clear archive
  await page.locator('todo-list').first().locator('[data-clear-archive]').click();
  await expect(page.locator('todo-list').first().locator('[data-archive-list] .todo-archive__empty')).toBeVisible();
});

// ─── 10. Inline edit ──────────────────────────────────────────────────────────
test('edits task detail inline on click', async ({ page }) => {
  await todo(page).locator('[data-input-detail]').fill('Original text');
  await todo(page).locator('[data-add-submit]').click();

  // Click the detail text to enter edit mode
  await todo(page).locator('[data-edit-detail]').first().click();

  // Input should appear with current value
  const inlineInput = todo(page).locator('[data-inline-edit-input]').first();
  await expect(inlineInput).toBeVisible();
  await expect(inlineInput).toHaveValue('Original text');

  // Type new value and press Enter to save
  await inlineInput.fill('Updated text');
  await inlineInput.press('Enter');

  // Detail should reflect the new value
  await expect(todo(page).locator('.todo-item__detail').first()).toContainText('Updated text');
});

// ─── 11. Priority badge ───────────────────────────────────────────────────────
test('priority badge is visible and can be changed via dropdown', async ({ page }) => {
  await todo(page).locator('[data-input-detail]').fill('Priority test');
  await todo(page).locator('[data-add-submit]').click();

  // Default priority badge should be visible
  const priorityBadge = todo(page).locator('[data-priority-badge]').first();
  await expect(priorityBadge).toBeVisible();
  await expect(priorityBadge).toContainText('Medium');

  // Click badge to open dropdown
  await priorityBadge.click();
  const priorityDropdown = todo(page).locator('.todo-priority-dropdown.is-open').first();
  await expect(priorityDropdown).toBeVisible();

  // Select High
  await todo(page).locator('[data-priority-option="HIGH"]').first().click();
  await expect(priorityBadge).toContainText('High');
});

// ─── 12. Archive: delete (soft) and restore ───────────────────────────────────
test('deleted task moves to archive and can be restored', async ({ page }) => {
  await todo(page).locator('[data-input-detail]').fill('To be archived');
  await todo(page).locator('[data-add-submit]').click();

  // Delete (soft) — accepts the confirm dialog
  page.once('dialog', d => d.accept());
  await todo(page).locator('[data-delete]').first().click();

  // Main list shows empty state
  await expect(todo(page).locator('.todo-empty__text')).toBeVisible();

  // Archive panel contains the item
  await page.locator('todo-list').first().locator('[data-archive-toggle]').click();
  await expect(page.locator('todo-list').first().locator('[data-archive-list] .todo-archive__row').first()).toBeVisible();

  // Restore it
  await page.locator('todo-list').first().locator('[data-restore]').first().click();

  // Back in the main list
  await expect(todo(page).locator('.todo-item__detail').first()).toContainText('To be archived');
});

// ─── 13. Regression: loaded items remain reactive after page reload ───────────
// Regression for _load() not registering model.onChange() — model.set() on a
// persisted item updated internal data silently but fired no collection events,
// so _refreshList() was never called and the UI never reflected the change.
test('priority and status changes persist and reflect in UI after page reload', async ({ page }) => {
  // Add a task, then reload — the item is now loaded via _load(), not add()
  await todo(page).locator('[data-input-detail]').fill('Reload reactivity test');
  await todo(page).locator('[data-add-submit]').click();
  await expect(todo(page).locator('.todo-item__detail').first()).toContainText('Reload reactivity test');
  await page.reload();
  await page.waitForLoadState('networkidle');

  const item = todo(page).locator('.todo-item').first();

  // Change priority on a loaded item — must update badge in UI (not just in memory)
  await item.locator('[data-priority-badge]').click();
  await item.locator('[data-priority-option="HIGH"]').click();
  await expect(item.locator('[data-priority-badge]')).toContainText('High');

  // Change status on a loaded item — must update badge in UI
  await item.locator('[data-status-badge]').click();
  await item.locator('[data-status-option="INP"]').click();
  await expect(item.locator('[data-status-badge]')).toContainText('In Progress');
});

// ─── 14. Public API ───────────────────────────────────────────────────────────
test('addItem() public API works', async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector('todo-list').addItem({ detail: 'Added via API' });
  });

  await expect(todo(page).locator('.todo-item__detail').first()).toContainText('Added via API');
});
