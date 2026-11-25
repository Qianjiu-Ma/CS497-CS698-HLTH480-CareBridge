import { expect, test } from '@playwright/test';

for (const width of [320, 768, 1440]) {
  test(`workspace chrome stays edge to edge at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 650 });
    await page.goto('/');
    const header = page.locator('.cb-navigation');
    const nav = page.locator('.cb-nav-tabs');
    await expect(header).toBeVisible();
    const widths = () => page.evaluate(() => ({
      viewport: window.innerWidth,
      header: document.querySelector('.cb-navigation')!.getBoundingClientRect().width,
      page: document.scrollingElement!.clientWidth,
    }));
    const expected = { viewport: width, header: width, page: width };
    await expect.poll(widths).toEqual(expected);
    await page.evaluate(() => window.scrollTo({ top: document.scrollingElement!.scrollHeight, behavior: 'instant' }));
    await expect.poll(() => page.evaluate(() => Math.abs(document.scrollingElement!.scrollHeight - window.innerHeight - window.scrollY)))
      .toBeLessThanOrEqual(1);
    await expect(header).toBeInViewport();
    if (width === 320) {
      await expect(nav).toHaveCSS('width', '320px');
      await expect(page.locator('.cb-workspace-footer--sticky')).toHaveCSS('width', '320px');
    }
    await nav.locator('[data-tab=settings]').click();
    await expect.poll(widths).toEqual(expected);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
}

test('document indicators follow native scrolling, fade and mirror in RTL', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto('/');
  await expect(page.locator('.cb-navigation')).toBeVisible();
  const indicator = page.locator('body > .os-scrollbar-vertical');
  test.skip(await indicator.count() === 0, 'This browser already uses native overlays');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    const root = document.documentElement.style;
    root.setProperty('--cb-safe-left', '18px');
    root.setProperty('--cb-safe-top', '10px');
    root.setProperty('--cb-safe-bottom', '24px');
  });
  const nav = page.locator('.cb-nav-tabs');
  const header = page.locator('.cb-navigation');
  await expect(indicator).toHaveCSS('top', (await header.boundingBox())!.height + 10 + 'px');
  await expect(indicator).toHaveCSS('bottom', (await nav.boundingBox())!.height + 'px');

  await page.mouse.move(100, 300);
  await page.mouse.wheel(0, 250);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(indicator).toHaveCSS('opacity', '1');
  await expect(indicator).toHaveCSS('opacity', '0');

  const thumb = (await indicator.locator('.os-scrollbar-handle').boundingBox())!;
  await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
  await expect(indicator).toHaveCSS('opacity', '1');
  const previous = await page.evaluate(() => window.scrollY);
  await page.mouse.down();
  await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2 + 36, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(previous);

  await page.locator('.cb-language .cb-select-trigger').click();
  await page.getByRole('menuitemradio').filter({ has: page.locator('[lang=ar]') }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(indicator).toHaveCSS('left', '18px');
  await expect(nav).toHaveCSS('width', '390px');
});

test('clinical details and the resident table preserve native keyboard scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto('/');
  await expect(page.locator('.cb-navigation')).toBeVisible();
  await page.keyboard.press('PageDown');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Choose resident' }).click();
  await page.getByRole('button', { name: 'Overview' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose resident' })).toBeHidden();
  const table = page.getByRole('region', { name: 'All residents' });
  await table.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  await page.locator('[data-tab=incoming]').click();
  await page.locator('.concern').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCSS('width', '390px');
  await page.keyboard.press('PageDown');
  await expect.poll(() => dialog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('.concern').first()).toBeFocused();
});

test('forced colors keeps the system scrollbar and keyboard scrolling', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced-colors emulation is checked in Chromium');
  await page.goto('/');
  await expect(page.locator('.cb-navigation')).toBeVisible();
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(page.locator('body > .os-scrollbar')).toHaveCount(0);
  await expect(page.locator('html')).toHaveCSS('scrollbar-width', 'auto');
  await page.keyboard.press('PageDown');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test('a touch swipe scrolls the document while the mobile navigation stays fixed', async ({ browser, browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', 'The touch gesture is sent through Chromium DevTools');
  const context = await browser.newContext({
    baseURL, viewport: { width: 390, height: 720 }, isMobile: true, hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    const nav = page.locator('.cb-nav-tabs');
    await expect(nav).toBeVisible();
    const before = await nav.boundingBox();
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 430 }] });
    for (let y = 412; y >= 181; y -= 18) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y }] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect(await nav.boundingBox()).toEqual(before);
  } finally {
    await context.close();
  }
});
