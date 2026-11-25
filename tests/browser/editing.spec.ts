import { expect, test, type Locator, type Page } from '@playwright/test';
import ar from '../../src/locales/ar.json' with { type: 'json' };

async function chooseEditorSection(dialog: Locator, label: string, trigger = 'Edit sections') {
  await dialog.getByRole('button', { name: trigger, exact: true }).click();
  await dialog.getByRole('menuitemradio', { name: label, exact: true }).click();
}

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('carebridge_handoff_state_v1')!));

test('resident edits validate and save multiple sections to the same resident', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const open = page.getByRole('button', { name: 'Edit resident', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Edit resident' });
  await open.click();
  await expect(dialog).toContainText('102');
  const before = await stored(page);
  const measurement = dialog.getByRole('textbox', { name: 'Fluids (mL)' });
  await measurement.fill('-4');
  await dialog.getByRole('button', { name: 'Completed care' }).click();
  await dialog.getByRole('textbox', { name: 'Care provided' }).fill('Fictional completed care');
  await dialog.getByRole('button', { name: 'Ate 100% breakfast' }).click();
  const save = dialog.getByRole('button', { name: 'Save changes' });
  await save.click();
  await expect(dialog.getByRole('alert')).toContainText('Enter a non-negative number.');
  await expect(measurement).toBeFocused();
  expect((await stored(page)).rows).toEqual(before.rows);

  await measurement.fill('975');
  await dialog.getByRole('button', { name: 'Observations', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Observations & mood' }).fill('Fictional observation after lunch');
  await save.click();
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
  await expect(page.locator('.cb-resident-card')).toContainText('Fictional completed care; Ate 100% breakfast');
  const after = await stored(page);
  const resident = after.rows.find((row: { room: string }) => row.room === '102');
  expect(resident.mltcDetails.fluidIntakeMl.value).toBe(975);
  expect(resident.mltcDetails.qualitativeObservations.value).toBe('Fictional observation after lunch');
  expect(after.rows.filter((row: { room: string }) => row.room !== '102'))
    .toEqual(before.rows.filter((row: { room: string }) => row.room !== '102'));
  expect(after.emrRecords).toEqual(before.emrRecords);
  expect(after.isLocked).toBe(false);

  await page.locator('[data-tab=incoming]').click();
  await page.locator('.concern[data-room="102"]').click();
  await expect(page.getByRole('dialog')).toContainText('Fictional observation after lunch');
});

test('mobile draft survives reload and requires explicit discard', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 660 });
  await page.goto('/');
  const open = page.getByRole('button', { name: 'Edit resident', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Edit resident' });
  const chooseCare = () => chooseEditorSection(dialog, 'Completed care');
  const care = dialog.getByRole('textbox', { name: 'Care provided' });
  await open.click();
  await expect(dialog).toHaveCSS('width', '320px');
  await expect(dialog).toHaveCSS('height', '660px');
  await chooseCare();
  const original = await care.inputValue();
  await care.fill('Fictional unsaved care');
  await page.reload();
  await open.click();
  await chooseCare();
  await expect(care).toHaveValue('Fictional unsaved care');
  await page.keyboard.press('Escape');
  const keepEditing = dialog.getByRole('button', { name: 'Keep editing' });
  await expect(keepEditing).toBeFocused();
  await keepEditing.click();
  await expect(care).toHaveValue('Fictional unsaved care');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await dialog.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(open).toBeFocused();
  await open.click();
  await chooseCare();
  await expect(care).toHaveValue(original);
});

test('shift and unit notes use focused dialogs and restore their launch controls', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 820 });
  await page.goto('/');
  const shift = page.getByRole('button', { name: 'Edit shift' });
  await shift.click();
  const dialog = page.getByRole('dialog', { name: 'Edit shift' });
  const unit = dialog.getByRole('textbox', { name: 'Unit', exact: true });
  await unit.fill(' ');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(unit).toBeFocused();
  await expect(unit).toHaveAttribute('aria-invalid', 'true');
  await unit.fill('Fictional practice unit');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(shift).toBeFocused();
  await expect(page.locator('.cb-context-trigger')).toContainText('Fictional practice unit');

  const notes = page.getByRole('button', { name: 'Unit notes', exact: true });
  await notes.click();
  const notesDialog = page.getByRole('dialog', { name: 'Unit notes' });
  await notesDialog.getByRole('textbox').fill('Fictional unit note for the next shift');
  await notesDialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(notes).toBeFocused();
  await page.locator('[data-tab=incoming]').click();
  await expect(page.locator('.incoming-workspace .unit')).toContainText('Fictional unit note for the next shift');
});

test('the overview opens the shared editor for the selected row', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Overview' }).click();
  const row = page.getByRole('row').filter({ hasText: 'Mr. F' }).first();
  const care = row.getByRole('button', { name: /Bath, lunch/ });
  await care.click();
  const dialog = page.getByRole('dialog', { name: 'Edit resident' });
  await expect(dialog).toContainText('106');
  await expect(dialog.getByRole('button', { name: 'Completed care' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(care).toBeFocused();
});

test('nurse notification requires initials and an untouched pending entry stays pending', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.cb-resident-card')).toBeVisible();
  await page.evaluate(() => {
    const key = 'carebridge_handoff_state_v1';
    const state = JSON.parse(localStorage.getItem(key)!);
    const resident = state.rows.find((row: { room: string }) => row.room === '104');
    resident.done = { ...resident.done, isPendingConfirmation: true, sourceQuote: 'Fictional original transcript' };
    state.selectedResidentRoom = '104';
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Edit resident', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit resident' });
  await expect(dialog).toContainText('104');
  await dialog.getByRole('button', { name: 'Nurse notification', exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'Told Charge Nurse' }).check();
  const save = dialog.getByRole('button', { name: 'Save changes' });
  const initials = dialog.getByRole('textbox', { name: 'Charge nurse initials' });
  await save.click();
  await expect(initials).toBeFocused();
  await expect(initials).toHaveAttribute('aria-invalid', 'true');
  await initials.fill('RN (ZZ)');
  await save.click();
  await expect(dialog).toBeHidden();
  const resident = (await stored(page)).rows.find((row: { room: string }) => row.room === '104');
  expect(resident.toldNurse.value).toBe(true);
  expect(resident.nurseInitials.value).toBe('RN (ZZ)');
  expect(resident.done).toMatchObject({ isPendingConfirmation: true, sourceQuote: 'Fictional original transcript' });
});

test('the resident editor supports RTL, safe areas and a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto('/');
  await page.locator('.cb-language .cb-select-trigger').click();
  await page.getByRole('menuitemradio').filter({ has: page.locator('[lang=ar]') }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--cb-safe-top', '16px');
    document.documentElement.style.setProperty('--cb-safe-bottom', '24px');
  });
  const open = page.getByRole('button', { name: ar['Edit resident'], exact: true });
  await open.click();
  const dialog = page.getByRole('dialog', { name: ar['Edit resident'] });
  await expect(dialog).toHaveCSS('padding-bottom', '24px');
  await chooseEditorSection(dialog, ar['Completed care'], ar['Edit sections']);
  await expect(dialog.getByRole('textbox', { name: ar['Care provided'] })).toBeVisible();
  expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(open).toBeFocused();
});
