import { expect, test } from '@playwright/test';

const SAMPLE_URL = 'http://127.0.0.1:4173/examples/sample-note.html';

test.describe('Antigravity Study Editor E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SAMPLE_URL);
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(page.locator('.se-doc-title')).toHaveValue('Active vs. Passive Voice');
  });

  test('toggles dark/light theme and updates computed CSS variables', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const darkBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim(),
    );
    expect(darkBg).toBe('#121316');

    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const lightBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim(),
    );
    expect(lightBg).toBe('#ffffff');
  });

  test('converts paragraph via Markdown shortcut (# ) and inserts Gutter Diff via / slash menu', async ({
    page,
  }) => {
    const emptyPara = page.locator('[data-block-row-id="b13"] [data-rich-editable="true"]');
    await emptyPara.click();
    await page.keyboard.type('# Converted Heading');

    const h1Row = page.locator('[data-block-row-id="b13"]');
    await expect(h1Row).toHaveAttribute('data-block-type', 'heading');
    await expect(h1Row.locator('.se-h1')).toContainText('Converted Heading');

    // Press Enter to create a new paragraph below and open slash menu with /diff
    await page.keyboard.press('Enter');
    await page.keyboard.type('/diff');
    const slashMenu = page.locator('.se-slash-menu');
    await expect(slashMenu).toBeVisible();
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-block-type="gutter-diff"]')).toHaveCount(2);
  });

  test('wraps selected text with floating toolbar color and micro-dot note', async ({ page }) => {
    const b1Editable = page.locator('[data-block-row-id="b1"] [data-rich-editable="true"]');
    await b1Editable.click();

    // Select the first text node ("Active voice ")
    await b1Editable.evaluate((el) => {
      const textNode = el.firstChild;
      if (!textNode) throw new Error('Missing text node');
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 6); // "Active"
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });

    const toolbar = page.locator('.se-floating-toolbar');
    await expect(toolbar).toBeVisible();

    // Apply blue color tag
    await toolbar.locator('[data-swatch="blue"]').click();
    await expect(b1Editable.locator('span[data-color="blue"]', { hasText: 'Active' })).toBeVisible();

    // Attach micro-dot note to the same selection
    await toolbar.getByRole('button', { name: 'Micro-dot note' }).click();
    const noteInput = toolbar.getByRole('textbox', { name: 'Micro-dot note text' });
    await noteInput.fill('test note');
    await toolbar.getByRole('button', { name: 'Apply' }).click();

    await expect(b1Editable.locator('span[data-note="test note"]')).toBeVisible();
  });

  test('supports CSS :has() Hover-to-Isolate, Step-to-Code Spotlight, and HTML5 popover Peek table', async ({
    page,
  }) => {
    // 1. Hover-to-Isolate: hovering data-bind="1" dims data-bind="2" to opacity 0.32
    const bind1 = page.locator('[data-block-row-id="b1"] [data-bind="1"]').first();
    const bind2 = page.locator('[data-block-row-id="b1"] [data-bind="2"]').first();

    await bind1.hover();
    await expect(bind2).toHaveCSS('opacity', '0.32');

    // 2. Step-to-Code Spotlight: clicking step 2 highlights line 5
    const spotlight = page.locator('[data-block-row-id="b5"]');
    await spotlight.locator('[data-step-id="s2"]').click();
    await expect(spotlight.locator('[data-line="5"]')).toHaveAttribute('data-highlighted', 'true');
    await expect(spotlight.locator('[data-line="2"]')).toHaveAttribute('data-highlighted', 'false');

    // 3. Native HTML5 Popover Peek reference table
    const peekTrigger = page.locator('[data-block-row-id="b6"] .se-peek-trigger');
    const peekPopover = page.locator('#peek-b6');
    await expect(peekPopover).not.toBeVisible();
    await peekTrigger.click();
    await expect(peekPopover).toBeVisible();
    await expect(peekPopover.locator('table')).toContainText('Simple Present');
  });

  test('copies canonical [NOTE SYNC] JSON patch to clipboard via Cmd/Ctrl+Shift+S', async ({
    page,
  }) => {
    const titleInput = page.locator('.se-doc-title');
    await titleInput.fill('Active vs. Passive Voice (Revised)');

    const syncPill = page.locator('.se-sync-pill');
    await expect(syncPill).toContainText('Unsynced:');

    // Trigger shortcut via platform modifier + Shift + S
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+Shift+S`);

    await expect(page.locator('.se-toast')).toContainText('Sync patch copied');

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain(
      '[NOTE SYNC: grammar-active-passive-01 | baseVersion: 1 -> targetVersion: 2]',
    );
    expect(clipboardText).toContain('"title": "Active vs. Passive Voice (Revised)"');
    expect(clipboardText).toContain('"targetVersion": 2');
  });
});
