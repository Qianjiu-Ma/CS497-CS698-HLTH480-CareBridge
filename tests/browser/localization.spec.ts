import { expect, test, type Locator, type Page } from '@playwright/test';
import en from '../../src/locales/en.json' with { type: 'json' };
import tl from '../../src/locales/tl.json' with { type: 'json' };
import pa from '../../src/locales/pa.json' with { type: 'json' };
import hi from '../../src/locales/hi.json' with { type: 'json' };
import zh from '../../src/locales/zh.json' with { type: 'json' };
import es from '../../src/locales/es.json' with { type: 'json' };
import fr from '../../src/locales/fr.json' with { type: 'json' };
import ar from '../../src/locales/ar.json' with { type: 'json' };

const catalogs = { en, tl, pa, hi, zh, es, fr, ar };
const languagePicker = (page: Page) => page.locator('.cb-language .cb-select-trigger');
const chooseLanguage = async (page: Page, language: string) => {
  await languagePicker(page).click();
  await page.getByRole('menuitemradio').filter({ has: page.locator('[lang="' + language + '"]') }).click();
};
const go = (page: Page, workspace: string) => page.locator(`[data-tab="${workspace}"]`).click();

test('catalogs have matching keys and interpolation variables', () => {
  const keys = Object.keys(en);
  const variables = (value: string) => [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
  for (const [locale, catalog] of Object.entries(catalogs)) {
    expect(Object.keys(catalog).sort(), locale).toEqual([...keys].sort());
    for (const key of keys) {
      const value = (catalog as Record<string, string>)[key];
      expect(value.trim(), `${locale} · ${key}`).toBeTruthy();
      expect(value, `${locale} · ${key}`).not.toMatch(/[⟪⟫⟦⟧]|\n/);
      expect(variables(value), `${locale} · ${key}`).toEqual(variables(key));
    }
  }
});

for (const [language, messages] of Object.entries(catalogs)) {
  test(`${language} localizes five workspaces and their dialogs`, async ({ page }) => {
    const errors: string[] = [];
    let calls = 0;
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/translate/google', async (route) => {
      calls += 1;
      await route.fulfill({ status: 503 });
    });
    await page.goto('/');
    await chooseLanguage(page, language);
    await expect(languagePicker(page)).toHaveText(language.toUpperCase());
    await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    await expect(page.locator('[data-tab="handoff"]')).toContainText(messages.Handoff);
    await expect(page.locator('.cb-banner')).toHaveCount(0);
    const context = page.locator('.cb-context-trigger');
    await expect(context).toContainText(messages.Day);
    await context.click();
    const shiftDetails = page.getByRole('dialog', { name: messages['Current shift'] });
    await expect(shiftDetails).toBeVisible();
    await expect(shiftDetails.locator('dt').last()).toHaveText(messages['Charge nurse']);
    await page.keyboard.press('Escape');
    await expect(context).toBeFocused();
    await page.getByRole('button', { name: messages['Edit resident'], exact: true }).click();
    const residentEditor = page.getByRole('dialog', { name: messages['Edit resident'] });
    await residentEditor.getByRole('button', { name: messages['Completed care'], exact: true }).click();
    await expect(residentEditor.getByRole('textbox', { name: messages['Care provided'] })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: messages['Review handoff'], exact: true }).click();
    await expect(page.getByRole('dialog', { name: messages['Confirm and submit shift handoff'] })).toBeVisible();
    await page.keyboard.press('Escape');

    await go(page, 'nurse');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(messages['Clinical review']);
    await page.locator('main button[aria-haspopup="dialog"]').first().click();
    await expect(page.locator('.clinical-review-dialog')).toBeVisible();
    await expect(page.locator('.clinical-review-dialog')).toContainText(messages['Assessment / follow-up']);
    await page.keyboard.press('Escape');

    await go(page, 'incoming');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(messages['My shift']);
    await page.locator('.task .details').first().click();
    await expect(page.getByRole('dialog')).toContainText(messages['Recorded handoff']);
    await page.keyboard.press('Escape');

    await go(page, 'emr');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(messages.Records);
    await page.getByRole('button', { name: messages['Original transcript'], exact: true }).first().click();
    await expect(page.getByRole('dialog')).toContainText(messages['Source record']);
    await page.keyboard.press('Escape');

    await go(page, 'settings');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(messages.Settings);
    await expect(page.locator('.carebridge-settings .cb-page-subtitle')).toHaveCount(0);
    await page.locator('[data-setting="Speech pause"]').click();
    await expect(page.getByRole('dialog')).toContainText(messages['Speech pause']);
    await page.keyboard.press('Escape');

    expect(calls).toBe(0);
    expect(errors).toEqual([]);
    await page.reload();
    await expect(languagePicker(page)).toHaveText(language.toUpperCase());
  });
}

test('translation is on demand, deduplicated across workspaces, and keeps the stored source', async ({ page }) => {
  let requests = 0;
  const original = 'Fictional note: the practice lift remained in room 102.';
  const translation = 'Note fictive : le lève-personne de pratique est resté dans la chambre 102.';
  await page.route('**/api/translate/google', async (route) => {
    requests += 1;
    expect(route.request().postDataJSON()).toMatchObject({ text: original, targetLang: 'fr' });
    await route.fulfill({ json: {
      translated_text: translation, target_language: 'fr', detected_source_language: 'en',
    } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Unit notes', exact: true }).click();
  await page.getByRole('textbox', { name: 'Unit notes' }).fill(original);
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  await chooseLanguage(page, 'fr');
  await expect(languagePicker(page)).toHaveText('FR');
  await page.getByRole('button', { name: fr['Unit notes'], exact: true }).click();
  expect(requests).toBe(0);
  await page.locator('#handoff-unit-notes .cb-translation-link').first().click();
  await expect(page.getByText(translation, { exact: true })).toBeVisible();
  await expect(page.locator('#handoff-unit-notes')).toContainText(fr['Machine translation · Verify against the original']);
  await page.locator('#handoff-unit-notes .cb-translation-link').first().click();
  await expect(page.locator('#handoff-unit-notes textarea')).toHaveValue(original);
  await page.keyboard.press('Escape');
  await go(page, 'incoming');
  await page.locator('.incoming-workspace .unit').click();
  await page.getByRole('dialog').locator('.cb-translation-link').first().click();
  await expect(page.getByRole('dialog')).toContainText(translation);
  expect(requests).toBe(1);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('carebridge_handoff_state_v1') || '{}'));
  expect(stored.anythingElse).toBe(original);
});

test('service failure can be retried and a stale response cannot survive a language change', async ({ page }) => {
  let requests = 0;
  let release: () => void = () => {};
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/translate/google', async (route) => {
    requests += 1;
    if (requests === 1) return route.fulfill({ status: 502 });
    if (requests === 2) {
      await delayed;
      return route.fulfill({ json: { translated_text: 'OLD FRENCH TRANSLATION', target_language: 'fr', detected_source_language: 'en' } });
    }
    return route.fulfill({ json: { translated_text: 'Nota de turno ficticia', target_language: 'es', detected_source_language: 'en' } });
  });
  await page.goto('/');
  const unitNotes = page.locator('#handoff-unit-notes');
  const translate = unitNotes.locator('.cb-translation-link').first();
  await chooseLanguage(page, 'fr');
  await expect(languagePicker(page)).toHaveText('FR');
  await page.getByRole('button', { name: fr['Unit notes'], exact: true }).click();
  await translate.click();
  await expect(unitNotes).toContainText(fr['Translation unavailable. The original text is preserved.']);
  await expect(unitNotes.locator('textarea')).toHaveValue(/Lift battery/);
  await translate.click();
  await expect.poll(() => requests).toBe(2);
  await page.keyboard.press('Escape');
  await chooseLanguage(page, 'es');
  await expect(languagePicker(page)).toHaveText('ES');
  release();
  await page.getByRole('button', { name: es['Unit notes'], exact: true }).click();
  await expect(unitNotes).not.toContainText('OLD FRENCH TRANSLATION');
  await translate.click();
  await expect(unitNotes).toContainText('Nota de turno ficticia');
  expect(requests).toBe(3);
});

test('Arabic mirrors the layout and workspaces fit a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await chooseLanguage(page, 'ar');
  await expect(languagePicker(page)).toHaveText('AR');
  for (const workspace of ['handoff', 'nurse', 'incoming', 'emr', 'settings']) {
    await go(page, workspace);
    await expect(page.locator('main')).toHaveCSS('direction', 'rtl');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, workspace).toBeLessThanOrEqual(1);
  }
});

test('completing an incoming task preserves nurse review and archived records', async ({ page }) => {
  await page.goto('/');
  const persisted = () => page.evaluate(() => JSON.parse(localStorage.getItem('carebridge_handoff_state_v1') || '{}'));
  const before = await persisted();
  await go(page, 'incoming');
  await page.locator('.task .tick:not(:disabled)').first().click();
  await expect.poll(async () => JSON.stringify((await persisted()).incomingTaskProgress)).not.toBe(JSON.stringify(before.incomingTaskProgress));
  const after = await persisted();
  expect(after.escalations).toEqual(before.escalations);
  expect(after.emrRecords).toEqual(before.emrRecords);
});



test('an exact phrase uses the local phrasebook and an edit invalidates the preview', async ({ page }) => {
  let requests = 0;
  await page.addInitScript(() => {
    const locales: string[] = [];
    speechSynthesis.speak = (utterance) => { locales.push(utterance.lang); };
    Object.defineProperty(window, 'carebridgeSpeechLocales', { value: locales });
  });
  await page.route('**/api/translate/google', async (route) => {
    requests += 1;
    expect(route.request().postDataJSON().text).toBe('Fictional change to the practice note.');
    await route.fulfill({ json: {
      translated_text: 'Modification fictive de la note de pratique.',
      target_language: 'fr', detected_source_language: 'en',
    } });
  });
  await page.goto('/');
  const note = page.locator('#handoff-unit-notes');
  await page.getByRole('button', { name: 'Unit notes', exact: true }).click();
  await note.getByRole('textbox').fill('Refused lunch; offer snack around 15:30');
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  await chooseLanguage(page, 'fr');
  await expect(languagePicker(page)).toHaveText('FR');
  await page.getByRole('button', { name: fr['Unit notes'], exact: true }).click();
  await note.locator('.cb-translation-link').first().click();
  await expect(note).toContainText(fr['Phrasebook translation']);
  await note.getByRole('button', { name: fr['Listen to translation'] }).click();
  const spoken = await page.evaluate(() => (window as Window & { carebridgeSpeechLocales?: string[] }).carebridgeSpeechLocales);
  expect(spoken).toEqual(['fr-CA']);
  expect(requests).toBe(0);
  await note.getByRole('textbox').fill('Fictional change to the practice note.');
  await expect(note).not.toContainText(fr['Phrasebook translation']);
  await note.locator('.cb-translation-link').first().click();
  await expect(note).toContainText('Modification fictive de la note de pratique.');
  expect(requests).toBe(1);
});

test('Tier 3 submission stays blocked after switching languages', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const key = 'carebridge_handoff_state_v1';
    const state = JSON.parse(localStorage.getItem(key) || '{}');
    const row = state.rows.find((item: { room: string }) => item.room === '106');
    row.changeCodes = { value: ['C'] };
    row.toldNurse = { value: false };
    row.nurseInitials = { value: '' };
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await chooseLanguage(page, 'ar');
  await expect(languagePicker(page)).toHaveText('AR');
  await page.getByRole('button', { name: ar['Review handoff'], exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: ar['Blocked by Tier 3'] })).toBeDisabled();
});

test('recognition uses the source locale and remains independent of reading language', async ({ page }) => {
  await page.addInitScript(() => {
    const starts: string[] = [];
    class RecognitionStub {
      lang = '';
      start() { starts.push(this.lang); }
      stop() {}
      abort() {}
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: RecognitionStub });
    Object.defineProperty(window, 'carebridgeRecognitionStarts', { value: starts });
  });
  await page.goto('/');
  await page.locator('#report-more-trigger').click();
  const speech = page.getByRole('button', { name: 'Speaking language' });
  await chooseOption(page, speech, 'tl');
  await chooseLanguage(page, 'ar');
  await expect(languagePicker(page)).toHaveText('AR');
  if (await page.locator('#report-more-trigger').getAttribute('aria-expanded') === 'false') {
    await page.locator('#report-more-trigger').click();
  }
  await expect(page.getByRole('button', { name: ar['Speaking language'] })).toHaveText(/الفلبينية/);
  await page.locator('.cb-report button').first().click();
  const starts = await page.evaluate(() => (window as Window & { carebridgeRecognitionStarts?: string[] }).carebridgeRecognitionStarts);
  expect(starts).toEqual(['fil-PH']);
});


test('reading language popover supports keyboard selection and dismisses without changing the language', async ({ page }) => {
  await page.goto('/');
  const trigger = languagePicker(page);
  const menu = page.getByRole('menu', { name: en['Global reading language'] });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.getByRole('menuitemradio', { checked: true })).toBeFocused();
  await expect(menu.getByRole('menuitemradio')).toHaveCount(8);
  await page.keyboard.press('End');
  await expect(menu.getByRole('menuitemradio', { name: /العربية/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveText('EN');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(trigger).toBeFocused();
  await page.setViewportSize({ width: 360, height: 500 });
  await trigger.click();
  const arabicMenu = page.getByRole('menu', { name: ar['Global reading language'] });
  await expect(arabicMenu.getByRole('menuitemradio', { checked: true })).toHaveAccessibleName(/العربية/);
  const bounds = await arabicMenu.boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
  await page.keyboard.press('Tab');
  await expect(arabicMenu).toBeHidden();
  await expect(page.getByRole('button', { name: ar['Print paper sheet'] })).toBeFocused();
  await trigger.click();
  await page.locator('.cb-brand').click();
  await expect(arabicMenu).toBeHidden();
  await expect(trigger).toHaveText('AR');
});

async function chooseOption(page: Page, trigger: Locator, value: string) {
  await trigger.click();
  await page.getByRole('menuitemradio').and(page.locator('[data-value=' + JSON.stringify(value) + ']')).click();
}

test('handoff dropdowns save the exact shift and task category', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit shift' }).click();
  const shift = page.getByRole('button', { name: 'Shift', exact: true });
  await chooseOption(page, shift, 'Night (23:00 - 07:00)');
  await expect(shift).toContainText('Night');
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await chooseOption(page, page.getByRole('button', { name: 'Task category' }), 'Medication');
  await page.getByPlaceholder('Add follow-up task...').fill('Fictional practice follow-up');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('carebridge_handoff_state_v1') || '{}'));
  expect(stored.header.shift).toBe('Night (23:00 - 07:00)');
  expect(stored.rows.flatMap((row: { careRequirements?: unknown[] }) => row.careRequirements ?? [])).toContainEqual(expect.objectContaining({ category: 'Medication', action_item: 'Fictional practice follow-up' }));
});

test('records dropdowns filter and restore focus to the shift trigger', async ({ page }) => {
  await page.goto('/');
  await go(page, 'emr');
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  const shift = page.getByRole('button', { name: 'Shift', exact: true });
  const room = page.getByRole('button', { name: 'Room', exact: true });
  await expect(shift).toBeFocused();
  await chooseOption(page, shift, 'Night');
  await expect(page.getByText('No matching records.')).toBeVisible();
  await chooseOption(page, shift, '');
  await chooseOption(page, room, '102');
  await expect(page.locator('.emr-archive .record')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(shift).toBeFocused();
  await expect(room).toHaveText('All rooms');
});

test('voice selectors keep grouped cloud languages and distinct source and target choices', async ({ page }) => {
  await page.route('**/api/translate/languages?*', (route) => route.fulfill({ json: { languages: [{ code: 'pt', name: 'Portuguese' }, { code: 'ja', name: 'Japanese' }] } }));
  await page.goto('/');
  await page.locator('#report-more-trigger').click();
  const source = page.getByRole('button', { name: 'Speaking language' });
  await source.click();
  const menu = page.getByRole('menu', { name: 'Speaking language' });
  await expect(menu.getByRole('group', { name: 'All Cloud Languages (2)' })).toBeVisible();
  await page.keyboard.press('p');
  await page.keyboard.press('o');
  await expect(menu.getByRole('menuitemradio', { name: 'Portuguese' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(source).toHaveText('Portuguese');
  await page.getByRole('button', { name: 'Type note' }).click();
  const target = page.getByRole('button', { name: 'Target translation language' });
  await chooseOption(page, target, 'ja');
  await expect(target).toHaveText('Japanese');
  await page.getByRole('button', { name: 'Swap languages' }).click();
  await expect(target).toHaveText('Portuguese');
});

test('rule priority dropdown reaches the review dialog on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  await go(page, 'settings');
  await page.locator('[data-setting="Stop & Watch rules"]').click();
  await page.getByRole('button', { name: 'Edit demo rules' }).click();
  const priority = page.getByRole('button', { name: /Priority for / }).first();
  await chooseOption(page, priority, '1');
  await expect(priority).toContainText('Tier 1');
  await page.getByRole('button', { name: 'Review changes' }).click();
  await expect(page.getByRole('dialog')).toContainText('Review demo changes');
  await expect(page.getByRole('button', { name: 'Apply demo changes' })).toBeEnabled();
});
