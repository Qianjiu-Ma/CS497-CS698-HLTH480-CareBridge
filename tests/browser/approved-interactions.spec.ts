import { expect, test, type Page } from '@playwright/test';

function deferred() {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => { release = resolve; });
  return { ready, release };
}

const stateKey = 'carebridge_handoff_state_v1';
const readState = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), stateKey);

async function typeReport(page: Page) {
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Type note', exact: true }).click();
  return page.locator('#handoff-report-input');
}

test('compact editor section selection works by keyboard and notification opens as a sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const notification = page.getByRole('button', { name: 'Nurse notification', exact: true });
  await notification.click();
  const editor = page.getByRole('dialog', { name: 'Edit resident' });
  await expect(editor).toHaveClass(/cb-adaptive-sheet/);
  await expect(editor.getByRole('textbox', { name: 'Charge nurse initials' })).toHaveValue('RN (KL)');
  const section = editor.getByRole('button', { name: 'Edit sections' });
  await section.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(editor).toHaveClass(/cb-adaptive-detail/);
  await expect(editor.getByRole('textbox', { name: 'Observations & mood' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(notification).toBeFocused();
});

test('clinical assessment has one reachable save action and protects an unsaved note', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto('/');
  await page.locator('[data-tab="nurse"]').click();
  const firstConcern = page.locator('.clinical-review-row').first();
  await firstConcern.click();
  const dialog = page.locator('.clinical-review-dialog');
  const note = dialog.getByRole('textbox', { name: 'Assessment / follow-up' });
  const save = dialog.getByRole('button', { name: 'Save follow-up' });
  await expect(save).toHaveCount(1);
  await note.fill('[bedside findings]');
  await save.click();
  await expect(note).toBeFocused();
  await expect(note).toHaveAccessibleDescription(/bracketed placeholders/);
  await note.fill('Verified fictional bedside observation.');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveAccessibleName('Discard draft?');
  await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(note).toBeFocused();
  await expect(note).toHaveValue('Verified fictional bedside observation.');
  await page.keyboard.press('Escape');
  await dialog.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(firstConcern).toBeFocused();
  await firstConcern.click();
  await expect(note).not.toHaveValue('Verified fictional bedside observation.');
});

test('mobile report keeps room drafts separate and ignores an older resident extraction', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const first = deferred();
  const pending = deferred();
  let calls = 0;
  await page.route('**/api/gemini/clinical-transcribe', async (route) => {
    const request = route.request().postDataJSON();
    const index = ++calls;
    if (index === 1) {
      pending.release();
      await first.ready;
    }
    await route.fulfill({ json: { fallback: true, data: {
      resident_name: request.resident_name,
      care_completed: index === 1 ? 'Older extraction' : 'Current extraction',
      additional_observations: request.raw_transcript,
      stop_and_watch_flags: [],
      care_requirements: [],
    } } });
  });

  try {
    await page.goto('/');
    const input = await typeReport(page);
    const composer = page.getByRole('dialog', { name: 'Report', exact: true });
    const resume = page.locator('.cb-report-resume');
    const minimize = () => composer.getByRole('button', { name: 'Close', exact: true }).click();
    await input.fill('First fictional resident note.');
    await composer.getByRole('button', { name: 'Extract for Rm 102' }).click();
    await pending.ready;
    await minimize();
    await page.getByRole('button', { name: /Next: Room 103/ }).click();
    await resume.click();
    await expect(input).toHaveValue('');
    await input.fill('Second fictional resident note.');
    await minimize();
    await page.getByRole('button', { name: /Previous: Room 102/ }).click();
    await resume.click();
    await expect(input).toHaveValue('First fictional resident note.');
    await composer.getByRole('button', { name: 'Extract for Rm 102' }).click();
    await expect(composer.getByText('Current extraction')).toBeVisible();
    const oldResponse = page.waitForResponse('**/api/gemini/clinical-transcribe');
    first.release();
    await oldResponse;
    await composer.getByRole('button', { name: 'Save to Rm 102' }).click();
    await expect(composer).toContainText('Saved to room 102');
    const current = await readState(page);
    expect(current.rows.find((row: { room: string }) => row.room === '102').done.value).toBe('Current extraction');
    expect(current.rows.find((row: { room: string }) => row.room === '103').done.value).not.toBe('Current extraction');
    await minimize();
    await page.getByRole('button', { name: /Next: Room 103/ }).click();
    await resume.click();
    await expect(input).toHaveValue('Second fictional resident note.');
  } finally {
    first.release();
  }
});

test('unit extraction merges untouched fields and cannot overwrite an edit made while it is running', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  const report = deferred();
  const pending = deferred();
  await page.route('**/api/gemini/parse-handoff-stream', async (route) => {
    pending.release();
    await report.ready;
    await route.fulfill({ contentType: 'text/event-stream', body: 'event: complete\ndata: ' + JSON.stringify({
      fallback: false,
      data: { entries: [{ room: '102', done: 'Older extracted care', not_done_next_shift: 'New fictional follow-up' }] },
    }) + '\n\n' });
  });
  try {
    await page.goto('/');
    const input = await typeReport(page);
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('group', { name: 'Report scope' }).getByRole('button', { name: 'All', exact: true }).click();
    await page.keyboard.press('Escape');
    await input.fill('Fictional unit report for room 102');
    await page.getByRole('button', { name: 'Apply to Sheet' }).click();
    await pending.ready;
    const submit = page.getByRole('button', { name: 'Review handoff', exact: true });
    await expect(submit).toBeDisabled();
    await page.getByRole('button', { name: 'Edit resident', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit resident' });
    await editor.getByRole('button', { name: 'Completed care', exact: true }).click();
    await editor.getByRole('textbox', { name: 'Care provided' }).fill('Manually verified care');
    await editor.getByRole('button', { name: 'Save changes' }).click();
    report.release();
    await expect(submit).toBeEnabled();
    const state = await readState(page);
    const row = state.rows.find((item: { room: string }) => item.room === '102');
    expect(row.done.value).toBe('Manually verified care');
    expect(row.notDoneNextShift).toMatchObject({ value: 'New fictional follow-up', isPendingConfirmation: true });
  } finally {
    report.release();
  }
});

test('mobile archive index moves keyboard focus to the requested read-only section', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('[data-tab="emr"]').click();
  const open = page.getByRole('button', { name: 'Full record', exact: true }).first();
  await open.click();
  const archive = page.getByRole('dialog', { name: 'Full shift record' });
  const navigation = archive.getByRole('navigation', { name: 'Full shift record' });
  const item = navigation.getByRole('button', { name: 'Activity log', exact: true });
  await item.focus();
  await page.keyboard.press('Enter');
  await expect(archive.locator('#archive-section-activity')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(open).toBeFocused();
});

test('settings identifies the invalid threshold next to its field and retains the draft', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/');
  await page.locator('[data-tab="settings"]').click();
  await page.getByRole('button', { name: /Alert thresholds/ }).click();
  await page.getByRole('button', { name: 'Edit demo rules' }).click();
  const field = page.getByRole('spinbutton', { name: 'Daily minimum fluids' });
  const review = page.getByRole('button', { name: 'Review changes' });
  await field.fill('0');
  await review.click();
  await expect(field).toBeFocused();
  await expect(field).toHaveAccessibleDescription('Enter a positive number for every threshold.');
  const errorBox = (await page.locator('#settings-error-fluidIntakeMinMl').boundingBox())!;
  const fieldBox = (await field.boundingBox())!;
  expect(errorBox.y).toBeGreaterThanOrEqual(fieldBox.y + fieldBox.height);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await field.fill('950');
  await review.click();
  await expect(page.getByRole('dialog', { name: 'Review demo changes' })).toContainText('950 mL');
});

test('mobile Tier 2 review requires a fresh override and keeps the AI review separate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((key) => {
    if (!localStorage.getItem(key)) return;
    const state = JSON.parse(localStorage.getItem(key)!);
    state.rows.find((row: { room: string }) => row.room === '102').done.isPendingConfirmation = true;
    localStorage.setItem(key, JSON.stringify(state));
  }, stateKey);
  await page.goto('/');
  await expect(page.locator('.cb-resident-card')).toBeVisible();
  await page.reload();
  const open = page.getByRole('button', { name: 'Review handoff', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Confirm and submit shift handoff' });
  const override = dialog.getByRole('checkbox', { name: /Override reason/ });
  const confirm = dialog.getByRole('button', { name: 'Confirm & Submit Handoff' });
  await open.click();
  await expect(confirm).toBeDisabled();
  await override.check();
  await dialog.getByRole('textbox', { name: 'Override reason' }).fill('Fictional verbal report documented.');
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('checkbox', { name: /reviewed all pending AI-extracted items/ }).check();
  await expect(confirm).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await open.click();
  await expect(override).not.toBeChecked();
  await expect(confirm).toBeDisabled();
});

test('resetting the demo invalidates a unit extraction that finishes afterward', async ({ page }) => {
  const report = deferred();
  const pending = deferred();
  await page.route('**/api/gemini/parse-handoff-stream', async (route) => {
    pending.release();
    await report.ready;
    await route.fulfill({ contentType: 'text/event-stream', body: 'event: complete\ndata: ' + JSON.stringify({
      fallback: false,
      data: { entries: [{ room: '102', done: 'Stale fictional care' }], anything_else: 'Stale fictional unit note' },
    }) + '\n\n' });
  });
  try {
    await page.goto('/');
    const input = await typeReport(page);
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('group', { name: 'Report scope' }).getByRole('button', { name: 'All', exact: true }).click();
    await page.keyboard.press('Escape');
    await input.fill('Fictional report for the prior demo state');
    await page.getByRole('button', { name: 'Apply to Sheet' }).click();
    await pending.ready;
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm Reset', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Review handoff' })).toBeEnabled();
    const lateResponse = page.waitForResponse('**/api/gemini/parse-handoff-stream');
    report.release();
    await lateResponse;
    await page.getByRole('button', { name: 'Unit notes', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Unit notes' })).toHaveValue(/Lift battery/);
    const state = await readState(page);
    expect(state.rows.find((row: { room: string }) => row.room === '102').done.value).not.toBe('Stale fictional care');
  } finally {
    report.release();
  }
});
