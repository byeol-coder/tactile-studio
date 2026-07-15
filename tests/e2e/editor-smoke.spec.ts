import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

test('editor boots without horizontal overflow or serious accessibility violations', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  const results = await new AxeBuilder({ page })
    .disableRules(['color-contrast']) // separately enforced by scripts/check-contrast.mjs
    .analyze();
  expect(results.violations.filter(v => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual([]);
  expect(errors).toEqual([]);
});

test('keyboard focus is visible and undo/save shortcuts do not crash', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).not.toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+s');
  expect(errors).toEqual([]);
});
