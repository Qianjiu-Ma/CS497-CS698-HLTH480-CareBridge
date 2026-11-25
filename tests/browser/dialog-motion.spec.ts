import { expect, test } from '@playwright/test';

test('the resident sheet keeps its content and backdrop as it exits', async ({ page }) => {
  await page.setViewportSize({ width: 499, height: 927 });
  await page.goto('/');
  await page.evaluate(() => document.documentElement.style.setProperty('--cb-motion-layer', '600ms'));
  const trigger = page.getByRole('button', { name: /Choose resident/ });
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: 'Choose resident' });
  await sheet.getByRole('button', { name: /106.*Mr\. F/ }).click();
  const exiting = page.locator('dialog[open][data-cb-closing]');
  await expect(exiting).toContainText('Mr. F');
  await expect(exiting).toHaveCSS('animation-name', 'cb-dialog-out');
  expect(await exiting.evaluate((element) => getComputedStyle(element, '::backdrop').animationName)).toBe('cb-dialog-backdrop-out');
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator('.cb-resident-title')).toContainText('106');
});

test('Escape animates a native detail and reduced motion closes immediately', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.documentElement.style.setProperty('--cb-motion-layer', '600ms'));
  await page.locator('[data-tab=incoming]').click();
  const concern = page.locator('.concern').first();
  await concern.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open][data-cb-closing]')).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(concern).toBeFocused();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await concern.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByRole('dialog').evaluate((dialog: HTMLDialogElement) => {
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    return dialog.open;
  })).toBe(false);
  await expect(concern).toBeFocused();
});
