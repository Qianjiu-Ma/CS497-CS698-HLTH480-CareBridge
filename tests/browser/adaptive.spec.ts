import { expect, test } from '@playwright/test';

const widths = [320, 360, 390, 600, 700, 701, 768, 1024, 1051, 1440];
const workspaces = ['handoff', 'nurse', 'incoming', 'emr', 'settings'];

for (const width of widths) {
  test(`all workspaces fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav).toHaveCSS('position', width <= 700 ? 'fixed' : 'static');
    for (const workspace of workspaces) {
      const tab = nav.locator(`[data-tab="${workspace}"]`);
      await tab.click();
      await expect(tab).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('main h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), workspace)
        .toBeLessThanOrEqual(1);
      if (width <= 700) {
        const target = await tab.boundingBox();
        expect(target?.height).toBeGreaterThanOrEqual(44);
        expect(target?.width).toBeGreaterThanOrEqual(44);
      }
    }
  });
}

test('compact resident chooser keeps keyboard focus and updates the existing handoff', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const picker = page.getByRole('button', { name: /Choose resident/ });
  await picker.focus();
  await page.keyboard.press('Enter');
  const roster = page.getByRole('dialog', { name: 'Choose resident' });
  await expect(roster).toBeVisible();
  await roster.getByRole('button', { name: /106.*Mr\. F/ }).click();
  await expect(roster).toBeHidden();
  await expect(picker).toBeFocused();
  await expect(page.locator('.cb-resident-title')).toContainText('106');
  await expect(page.getByRole('button', { name: /Report · Room 106/ })).toBeVisible();
  await picker.click();
  await page.keyboard.press('Escape');
  await expect(picker).toBeFocused();
  await expect(page.locator('.cb-resident-title')).toContainText('106');
  await page.getByRole('button', { name: 'Open room 102' }).first().click();
  const residentHeading = page.locator('.cb-resident-title');
  await expect(residentHeading).toBeFocused();
  await expect(residentHeading).toContainText('102');
  await expect(residentHeading).toBeInViewport({ ratio: 1 });
});

test.describe('compact touch controls', () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 320, height: 480 } });

  test('a short touch viewport keeps report input and settings usable', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'More', exact: true }).tap();
    await page.getByRole('button', { name: 'Type note' }).tap();
    const input = page.locator('#handoff-report-input');
    await expect(input).toBeFocused();
    await input.fill('Fictional test note');
    await expect(input).toHaveValue('Fictional test note');
    const composer = page.getByRole('dialog', { name: 'Report', exact: true });
    await expect(composer).toHaveCSS('height', '480px');
    const inputBox = (await input.boundingBox())!;
    expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(480);
    await composer.getByRole('button', { name: 'Close', exact: true }).tap();
    await expect(composer).toBeHidden();
    await expect(page.locator('.cb-report-resume')).toBeFocused();

    await page.locator('.cb-nav-tabs [data-tab=settings]').tap();
    await page.getByRole('button', { name: /Speech pause/ }).tap();
    const sheet = page.getByRole('dialog', { name: 'Speech pause' });
    await expect(sheet).toBeVisible();
    const slider = sheet.getByRole('slider');
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await sheet.getByRole('button', { name: 'Save' }).tap();
    await expect(sheet).toBeHidden();
  });
});

test('compact clinical details and records adapt without losing their controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('[data-tab=incoming]').click();
  await expect(page.getByRole('heading', { name: /Needs attention/ })).toBeVisible();
  const concern = page.locator('.concern').first();
  await concern.click();
  let dialog = page.getByRole('dialog');
  const usableWidth = await page.locator('.cb-nav-tabs').evaluate((nav) => nav.getBoundingClientRect().width);
  await expect(dialog).toHaveCSS('width', usableWidth + 'px');
  await expect(dialog).toHaveCSS('height', '844px');
  await expect(dialog.locator('.cb-compact-concern')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(concern).toBeFocused();
  await page.locator('[data-tab=emr]').click();
  await page.getByRole('button', { name: 'Full record', exact: true }).first().click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Print full shift' })).toBeVisible();
  await expect(dialog.locator('.tablewrap')).toBeHidden();
  const resident = dialog.locator('.resident-documentation > summary').first();
  await resident.click();
  await expect(dialog.locator('.resident-documentation[open]')).toContainText('Completed care');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(dialog.locator('.tablewrap')).toBeVisible();
  await expect(dialog.locator('.resident-documentation[open]')).toContainText('Completed care');
});

test('mobile navigation reserves safe areas and leaves expanded RTL labels operable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await page.locator('.cb-language .cb-select-trigger').click();
  await page.getByRole('menuitemradio').filter({ has: page.locator('[lang=ar]') }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.evaluate(() => {
    const root = document.documentElement;
    root.style.setProperty('--cb-safe-bottom', '24px');
    root.style.setProperty('--cb-safe-top', '16px');
    const labels = [...document.querySelectorAll<HTMLElement>('.cb-nav-label, .cb-nav-short')];
    const sizes = labels.map((label) => parseFloat(getComputedStyle(label).fontSize));
    labels.forEach((label, index) => { label.style.fontSize = (sizes[index] * 2) + 'px'; });
  });
  const nav = page.locator('.cb-nav-tabs');
  await expect(nav).toHaveCSS('padding-bottom', '28px');
  await expect(page.locator('.cb-navigation')).toHaveCSS('top', '16px');
  for (const workspace of workspaces) {
    await nav.locator(`[data-tab="${workspace}"]`).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), workspace)
      .toBeLessThanOrEqual(1);
  }
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const footer = await page.locator('.cb-workspace-footer').boundingBox();
  const bar = await nav.boundingBox();
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(bar!.y + 1);
});
