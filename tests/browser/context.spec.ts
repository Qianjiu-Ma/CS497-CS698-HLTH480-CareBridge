import { expect, test } from '@playwright/test';

for (const width of [320, 768, 1440]) {
  test(`current shift is available from every workspace at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await page.goto('/');
    const trigger = page.getByRole('button', { name: /^Current shift ·/ });
    const details = page.getByRole('dialog', { name: 'Current shift' });
    const navigation = page.getByRole('navigation', { name: 'Main navigation' });

    for (const workspace of ['handoff', 'nurse', 'incoming', 'emr', 'settings']) {
      await navigation.locator(`[data-tab="${workspace}"]`).click();
      await expect(page.locator('main .cb-page-heading h1')).toBeVisible();
      await expect(page.locator('main .cb-page-subtitle')).toHaveCount(0);
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(details).toBeVisible();
      await expect(details.locator('.cb-context-heading button')).toBeFocused();
      await expect(details.locator('dd')).toHaveText([
        'Maple Neighborhood', /.+/, 'Day (07:00 - 15:00)', 'J. Santos, PSW', 'M. Okafor, PSW', 'K. Lewis, RN',
      ]);
      if (width === 320) {
        await expect(details).toHaveCSS('width', '320px');
        expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      } else {
        await expect(details).toHaveCSS('width', '480px');
      }
      await page.keyboard.press('Escape');
      await expect(details).toBeHidden();
      await expect(trigger).toBeFocused();
    }
  });
}

test('live shift edits and signing identity update context while archive metadata remains historical', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  const editShift = page.getByRole('button', { name: 'Edit shift' });
  await editShift.click();
  const initialArchive = await page.evaluate(() => JSON.parse(localStorage.getItem('carebridge_handoff_state_v1')!).emrRecords);
  const shiftEditor = page.getByRole('dialog', { name: 'Edit shift' });
  const unit = 'Fictional West Wing with a long name for narrow screens';
  await shiftEditor.getByRole('textbox', { name: 'Unit', exact: true }).fill(unit);
  await shiftEditor.getByLabel('Date', { exact: true }).fill('2026-09-17');
  await shiftEditor.getByRole('textbox', { name: 'Incoming staff' }).fill('C. Example, PSW');
  await shiftEditor.getByRole('button', { name: 'Shift', exact: true }).click();
  await page.getByRole('menuitemradio', { name: /Night/ }).click();
  await shiftEditor.getByRole('button', { name: 'Save changes' }).click();

  const trigger = page.getByRole('button', { name: /^Current shift ·/ });
  await expect(trigger).toHaveAccessibleName(`Current shift · ${unit} · Night`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.locator('[data-tab=nurse]').click();
  await page.getByRole('button', { name: /Edit signing nurse name/ }).click();
  await page.getByRole('textbox', { name: 'Duty nurse name and credentials' }).fill('A. Example, RN');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await trigger.click();
  const details = page.getByRole('dialog', { name: 'Current shift' });
  await expect(details).toContainText(unit);
  await expect(details).toContainText('C. Example, PSW');
  await expect(details).toContainText('A. Example, RN');
  await expect(details.locator('time')).toHaveAttribute('datetime', '2026-09-17');
  await details.getByRole('button', { name: 'Close', exact: true }).last().click();

  await page.getByRole('button', { name: /Needs review/ }).click();
  await page.locator('[data-escalation-room="104"]').click();
  const assessment = page.getByRole('dialog');
  await assessment.getByRole('textbox', { name: 'Assessment / follow-up' }).fill('Fictional assessment for signing verification.');
  await assessment.getByRole('button', { name: 'Save & monitor' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('carebridge_handoff_state_v1')!).escalations
    .find((item: { id: string }) => item.id === 'esc-104')?.acknowledgedBy)).toBe('A. Example, RN');

  await page.locator('[data-tab=emr]').click();
  await expect(page.locator('.archive .shiftmeta').first()).toContainText(initialArchive[0].header.unit);
  await expect(page.locator('.archive .shiftmeta').first()).toContainText(initialArchive[0].acknowledgedByNurse);
  await expect(page.locator('.archive .shiftmeta').first()).not.toContainText(unit);
  const finalArchive = await page.evaluate(() => JSON.parse(localStorage.getItem('carebridge_handoff_state_v1')!).emrRecords);
  expect(finalArchive).toEqual(initialArchive);
  await page.reload();
  await trigger.click();
  await expect(details).toContainText('A. Example, RN');
  await expect(details).toContainText(unit);
});
