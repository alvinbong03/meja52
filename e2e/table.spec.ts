import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const contexts: BrowserContext[] = [];

test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close().catch(() => undefined)));
});

async function seat(browser: Browser, name: string, code?: string, options: Parameters<Browser['newContext']>[0] = {}) {
  const ctx = await browser.newContext({ ...test.info().project.use, ...options });
  contexts.push(ctx);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  (page as Page & { errors: string[] }).errors = errors;
  if (code) {
    await page.goto(`/t/${code}`);
  } else {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create a room' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Starting balance').fill('1000');
    await page.getByLabel('Small blind').fill('5');
    await page.getByLabel('Big blind').fill('10');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Create room' }).click();
    await page.waitForURL(/\/invite\/[A-Z]{4}$/);
    await page.getByRole('button', { name: 'Open lobby' }).click();
  }
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: /Join lobby|Request a seat/ }).click();
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  return page;
}

const codeOf = (page: Page) => page.url().match(/\/t\/([A-Z]{4})/)![1];
const yourTurn = (page: Page) => page.getByText('Your turn', { exact: true });
const stackOf = (page: Page, name: string) =>
  page.getByRole('listitem').filter({ has: page.locator('.seat-name', { hasText: new RegExp(`^${name}`) }) }).locator('.seat-stack');

async function actWhoeverIsUp(pages: Page[], action: 'Check' | RegExp) {
  for (let i = 0; i < 100; i++) {
    for (const p of pages) {
      if (!(await yourTurn(p).isVisible())) continue;
      try {
        await p.getByRole('button', { name: action }).click({ timeout: 2_000 });
      } catch {
        continue; // the turn moved on between the check and the click
      }
      await expect(yourTurn(p)).toBeHidden({ timeout: 3_000 }).catch(() => undefined);
      return p;
    }
    await pages[0].waitForTimeout(100);
  }
  throw new Error('nobody had a turn');
}

async function stageAndPlace(page: Page, action: string | RegExp, amount: number) {
  await page.getByRole('button', { name: action }).click();
  await page.getByRole('button', { name: `Place ${amount}` }).click();
}

async function confirmAward(page: Page) {
  await expect(page.getByText('Award preview', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm award' }).click();
}

test('room setup preferences have accessible controls', async ({ page }) => {
  await page.goto('/create');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  const sound = page.getByRole('switch', { name: 'Sound' });
  const haptics = page.getByRole('switch', { name: 'Haptics' });
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  await expect(haptics).toHaveAttribute('aria-checked', 'true');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'false');
});

test('three players play a hand from deal to payout', async ({ browser }) => {
  const ana = await seat(browser, 'Ana');
  const code = codeOf(ana);
  const ben = await seat(browser, 'Ben', code);
  const cat = await seat(browser, 'Cat', code);

  await expect(ben.getByText('Waiting for Ana to deal the first hand')).toBeVisible();
  await ana.getByRole('button', { name: 'Deal the first hand' }).click();

  await expect(yourTurn(ana)).toBeVisible();
  await expect(ben.getByText('Ana to act · 10 to call')).toBeVisible();
  await ana.getByRole('button', { name: 'Raise' }).click();
  await ana.getByRole('button', { name: /Custom/ }).click();
  await ana.getByLabel('Custom amount').fill('60');
  await ana.getByRole('button', { name: 'Place 60' }).click();

  await expect(yourTurn(ben)).toBeVisible();
  await stageAndPlace(ben, 'Call 55', 55);
  await expect(yourTurn(cat)).toBeVisible();
  await cat.getByRole('button', { name: 'Fold' }).click();

  await expect(ana.getByText('Deal the flop')).toBeVisible();
  await expect(ana.locator('.pot-amount')).toHaveText('130');

  for (let i = 0; i < 6; i++) await actWhoeverIsUp([ana, ben], 'Check');
  await expect(ana.getByText('Who won?')).toBeVisible();
  await expect(cat.getByText('Waiting for Ana to confirm the winner')).toBeVisible();
  await ana.locator('.win-row').filter({ hasText: 'Ben' }).click();
  await ana.getByRole('button', { name: 'Pay Ben 130' }).click();
  await confirmAward(ana);

  await expect(ana.locator('.stage-line')).toHaveText('Ben takes it');
  await expect(stackOf(ana, 'Ben')).toHaveText('1,070');
  await expect(stackOf(ben, 'Ana')).toHaveText('940');
  await expect(stackOf(cat, 'Cat')).toHaveText('990');

  await ana.getByRole('button', { name: 'Menu' }).click();
  await ana.getByRole('button', { name: 'Settle up' }).click();
  await expect(ana.getByText('Ana pays Ben')).toBeVisible();
  await ana.keyboard.press('Escape');

  await expect(ben.getByText('Waiting for Ana to deal the next hand')).toBeVisible();
  await ana.getByRole('button', { name: /Deal next hand/ }).click();
  await expect(ana.getByText('Hand 2', { exact: true })).toBeVisible();
  for (const p of [ana, ben, cat]) expect((p as Page & { errors: string[] }).errors).toEqual([]);
});

test('a disputed award is publicly reviewed before a governed table override', async ({ browser }) => {
  const ana = await seat(browser, 'Ana');
  const code = codeOf(ana);
  const ben = await seat(browser, 'Ben', code);
  const cat = await seat(browser, 'Cat', code);
  await ana.getByRole('button', { name: 'Deal the first hand' }).click();
  await ana.getByRole('button', { name: 'Raise' }).click();
  await ana.getByRole('button', { name: /Custom/ }).click();
  await ana.getByLabel('Custom amount').fill('60');
  await ana.getByRole('button', { name: 'Place 60' }).click();
  await stageAndPlace(ben, 'Call 55', 55);
  await expect(yourTurn(cat)).toBeVisible();
  await cat.getByRole('button', { name: 'Fold' }).click();
  for (let i = 0; i < 6; i++) await actWhoeverIsUp([ana, ben], 'Check');

  await ana.locator('.win-row').filter({ hasText: 'Ben' }).click();
  await ana.getByRole('button', { name: 'Pay Ben 130' }).click();
  await expect(cat.getByText('Award preview', { exact: true })).toBeVisible();
  await cat.getByRole('button', { name: 'Dispute' }).click();
  await expect(ben.getByText('Payout disputed')).toBeVisible();

  await ana.getByRole('button', { name: 'Table override…' }).click();
  await ana.getByLabel('Ana').fill('0');
  await ana.getByLabel('Ben').fill('0');
  await ana.getByLabel('Cat').fill('130');
  await ana.getByRole('button', { name: 'Preview override' }).click();
  await expect(cat.getByText('Not rules-validated')).toBeVisible();
  await cat.getByRole('button', { name: 'Approve table ruling' }).click();
  await expect(ana.getByRole('button', { name: 'Confirm override' })).toBeEnabled();
  await ana.getByRole('button', { name: 'Confirm override' }).click();
  await expect(stackOf(ana, 'Cat')).toHaveText('1,120');
  for (const page of [ana, ben, cat]) expect((page as Page & { errors: string[] }).errors).toEqual([]);
});

test('the host ends after the current hand and everyone receives frozen settlement', async ({ browser }) => {
  const ana = await seat(browser, 'Ana');
  const ben = await seat(browser, 'Ben', codeOf(ana));

  await ana.getByRole('button', { name: 'Deal the first hand' }).click();
  await expect(yourTurn(ana)).toBeVisible();

  await ben.getByRole('button', { name: 'Menu' }).click();
  await expect(ben.getByRole('button', { name: /End (after this hand|game)/ })).toHaveCount(0);
  await ben.keyboard.press('Escape');

  await ana.getByRole('button', { name: 'Menu' }).click();
  await ana.getByRole('button', { name: 'End after this hand' }).click();
  const cancelEnd = ana.getByRole('button', { name: 'Cancel' });
  const confirmEnd = ana.getByRole('button', { name: 'End after hand' });
  const [cancelBox, confirmBox] = await Promise.all([cancelEnd.boundingBox(), confirmEnd.boundingBox()]);
  expect(cancelBox).not.toBeNull();
  expect(confirmBox).not.toBeNull();
  expect(Math.abs(cancelBox!.y - confirmBox!.y)).toBeLessThanOrEqual(1);
  expect(confirmBox!.x - (cancelBox!.x + cancelBox!.width)).toBeLessThanOrEqual(10);
  await confirmEnd.click();
  await expect(ben.getByText('Final hand', { exact: true })).toBeVisible();

  await ana.getByRole('button', { name: 'Fold' }).click();
  for (const page of [ana, ben]) {
    await expect(page.getByText('Your result', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Deal next hand/ })).toHaveCount(0);
  }
  await ana.getByRole('button', { name: 'Looks correct' }).click();
  await ben.getByRole('button', { name: 'Report an issue' }).click();
  await ben.getByLabel('What looks wrong?').fill('Please check the blind');
  await ben.getByRole('button', { name: 'Report issue' }).click();
  await expect(ana.getByText('1 unresolved issue')).toBeVisible();
  await ben.getByRole('button', { name: 'Resolved — looks correct' }).click();
  await expect(ana.getByText('2 of 2 players reviewed their result')).toBeVisible();
  const anaSettle = ana.getByRole('button', { name: 'Mark my transfer settled' });
  const benSettle = ben.getByRole('button', { name: 'Mark my transfer settled' });
  if (await anaSettle.isVisible()) await anaSettle.click();
  else await benSettle.click();
  await ana.getByRole('button', { name: 'Finalize record' }).click();
  for (const page of [ana, ben]) {
    await expect(page.getByRole('heading', { name: 'Settlement complete' })).toBeVisible();
    await expect(page.getByText('Results sum to zero')).toBeVisible();
  }
  await ana.setViewportSize({ width: 320, height: 568 });
  expect(await ana.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await ana.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await ana.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await ana.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await ana.getByRole('link', { name: 'Open private record' }).click();
  await expect(ana).toHaveURL(/\/record\/[A-Z]{4}#[a-f0-9]{64}$/);
  expect(await ana.evaluate(() => location.pathname)).toMatch(/^\/record\/[A-Z]{4}$/);
  expect(await ana.evaluate(() => location.hash)).toMatch(/^#[a-f0-9]{64}$/);
  await expect(ana.getByRole('heading', { name: 'Settlement complete' })).toBeVisible();
  await ana.getByRole('button', { name: /Session history/ }).click();
  await expect(ana.getByRole('heading', { name: 'Table timeline' })).toBeVisible();
  await expect(ana.locator('.history-list li')).not.toHaveCount(0);
  await ana.getByRole('button', { name: 'Back' }).click();
  await ana.getByRole('button', { name: /Room data & exports/ }).click();
  await expect(ana.getByRole('heading', { name: 'Available for 30 days' })).toBeVisible();
  const csv = ana.waitForEvent('download');
  await ana.getByRole('button', { name: 'Export ledger CSV' }).click();
  expect((await csv).suggestedFilename()).toMatch(/^meja52-[A-Z]{4}-ledger\.csv$/);
  await ana.getByRole('button', { name: 'Delete room early' }).click();
  await expect(ana.getByRole('button', { name: 'Delete permanently' })).toBeDisabled();
  await ana.getByLabel(/Type .* to confirm/).fill(codeOf(ben));
  await ana.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(ana).toHaveURL('/');
});

test('a player requests a rebuy and the host edits and approves it', async ({ browser }) => {
  const ana = await seat(browser, 'Ana');
  const ben = await seat(browser, 'Ben', codeOf(ana));

  await ben.getByRole('button', { name: 'Menu' }).click();
  await ben.getByRole('button', { name: 'Request rebuy' }).click();
  await ben.getByLabel('Amount').fill('125');
  await expect(ben.getByText('New balance after approval')).toContainText('RM1,125');
  await ben.getByRole('button', { name: 'Send request' }).click();

  await ana.getByRole('button', { name: 'Menu' }).click();
  await expect(ana.getByRole('button', { name: 'Rebuy requests' })).toContainText('1 pending');
  await ana.getByRole('button', { name: 'Rebuy requests' }).click();
  await expect(ana.getByText('Ben requested RM125.')).toBeVisible();
  await ana.getByLabel('Edit amount').fill('150');
  await ana.getByRole('button', { name: 'Approve RM150' }).click();
  await expect(ana.getByText('No rebuy requests are waiting.')).toBeVisible();
  await ana.keyboard.press('Escape');

  await ana.getByRole('button', { name: 'Manage' }).click();
  await expect(ana.locator('.player-row').filter({ hasText: 'Ben' })).toContainText('1,150');
  await ana.keyboard.press('Escape');

  await ben.getByRole('button', { name: 'Menu' }).click();
  await expect(ben.getByRole('button', { name: 'Request rebuy' })).toBeVisible();
});

test('a player takes a break and chooses how to return after missing blinds', async ({ browser }) => {
  const ana = await seat(browser, 'Ana');
  const ben = await seat(browser, 'Ben', codeOf(ana));
  const cat = await seat(browser, 'Cat', codeOf(ana));

  await ana.getByRole('button', { name: 'Deal the first hand' }).click();
  await ben.getByRole('button', { name: 'Menu' }).click();
  await ben.getByRole('button', { name: 'Take a break' }).click();
  await expect(ben.getByText('Your seat and RM995 stay reserved.')).toBeVisible();
  await ben.getByRole('button', { name: 'Take break after hand' }).click();

  await actWhoeverIsUp([ana, ben, cat], /Fold/);
  await actWhoeverIsUp([ana, ben, cat], /Fold/);
  await ana.getByRole('button', { name: /Deal next hand/ }).click();
  await actWhoeverIsUp([ana, cat], /Fold/);
  await ana.getByRole('button', { name: /Deal next hand/ }).click();

  await ben.getByRole('button', { name: 'Menu' }).click();
  await ben.getByRole('button', { name: 'On break' }).click();
  await expect(ben.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(ben.getByText('You missed the small and big blind.')).toBeVisible();
  await ben.getByRole('radio', { name: /Wait for big blind/ }).click();
  await ben.getByRole('button', { name: 'Return to table' }).click();
  await ben.getByRole('button', { name: 'Menu' }).click();
  await expect(ben.getByRole('button', { name: 'Waiting for big blind' })).toBeVisible();
});

test('a player reviews, schedules and cancels leaving before departing after the hand', async ({ browser }) => {
  const ana = await seat(browser, 'Ana', undefined, { viewport: { width: 390, height: 844 } });
  const ben = await seat(browser, 'Ben', codeOf(ana), { viewport: { width: 390, height: 844 } });

  await ana.getByRole('button', { name: 'Menu' }).click();
  await ana.getByRole('button', { name: 'Leave game' }).click();
  await expect(ana.getByText('Transfer hosting to another player before you leave.')).toBeVisible();
  await expect(ana.getByRole('button', { name: 'Choose a new host' })).toBeVisible();
  await ana.keyboard.press('Escape');

  await ana.getByRole('button', { name: 'Deal the first hand' }).click();
  await ben.getByRole('button', { name: 'Menu' }).click();
  await ben.getByRole('button', { name: 'Leave game' }).click();
  await expect(ben.getByRole('heading', { name: 'Leave the game' })).toBeVisible();
  await expect(ben.getByText('Current stack').locator('..')).toContainText('RM990');
  await expect(ben.getByRole('radio', { name: /Leave after this hand/ })).toHaveAttribute('aria-checked', 'true');
  await expect(ben.getByRole('radio', { name: /Leave now/ })).toBeVisible();

  await ben.getByRole('button', { name: 'Request to leave' }).click();
  await ben.getByRole('button', { name: 'Menu' }).click();
  await expect(ben.getByRole('button', { name: 'Leaving after this hand' })).toBeVisible();
  await ben.getByRole('button', { name: 'Leaving after this hand' }).click();
  await ben.getByRole('button', { name: 'Stay in the game' }).click();

  await ben.getByRole('button', { name: 'Menu' }).click();
  await ben.getByRole('button', { name: 'Leave game' }).click();
  await ben.getByRole('button', { name: 'Request to leave' }).click();
  await expect(ana.getByRole('listitem').filter({ hasText: 'Ben' })).toContainText('leaving after hand');

  await ana.getByRole('button', { name: 'Fold' }).click();
  await expect(ben).toHaveURL('/');
  await expect(ben.getByRole('heading', { name: /Poker chips/ })).toBeVisible();
  await ana.getByRole('button', { name: 'Menu' }).click();
  await ana.getByRole('button', { name: 'Settle up' }).click();
  const transfer = ana.getByRole('heading', { name: 'To square up' }).locator('..').getByRole('listitem');
  await expect(transfer).toContainText('Ana');
  await expect(transfer).toContainText('pays');
  await expect(transfer).toContainText('Ben');
});

test('the host approves a late arrival who posts a big blind for the next hand', async ({ browser }) => {
  const ana = await seat(browser, 'Ana');
  const code = codeOf(ana);
  const ben = await seat(browser, 'Ben', code);
  const cat = await seat(browser, 'Cat', code);
  await ana.getByRole('button', { name: 'Deal the first hand' }).click();

  const dee = await seat(browser, 'Dee', code, { viewport: { width: 390, height: 844 } });
  await expect(dee.getByRole('heading', { name: 'Waiting for the host' })).toBeVisible();
  await expect(dee.getByText('RM1,000 seat')).toBeVisible();

  await ana.getByRole('button', { name: 'Menu' }).click();
  await expect(ana.getByRole('button', { name: 'Late arrivals' })).toContainText('1 pending');
  await ana.getByRole('button', { name: 'Late arrivals' }).click();
  await ana.getByLabel('Starting balance').fill('600');
  await ana.getByRole('button', { name: 'Approve RM600' }).click();
  await ana.keyboard.press('Escape');

  await expect(dee.getByRole('heading', { name: 'Choose when to enter' })).toBeVisible();
  await expect(dee.getByText('join between hands with RM600')).toBeVisible();
  await expect(dee.getByRole('radio', { name: /Post RM10/ })).toHaveAttribute('aria-checked', 'true');
  await dee.getByRole('button', { name: 'Confirm entry' }).click();
  await expect(dee.getByRole('heading', { name: 'Joining next hand' })).toBeVisible();

  await actWhoeverIsUp([ana, ben, cat], /Fold/);
  await actWhoeverIsUp([ana, ben, cat], /Fold/);
  await ana.getByRole('button', { name: /Deal next hand/ }).click();
  await expect(dee.getByText('Your balance')).toBeVisible();
  await expect(dee.locator('.my-stack')).toHaveText('590');
  await expect(dee.getByText('Hand 2', { exact: true })).toBeVisible();
});

test('short stack all in creates a side pot that pays the right people', async ({ browser }) => {
  const ana = await seat(browser, 'Ana');
  const code = codeOf(ana);
  const ben = await seat(browser, 'Ben', code);
  const cat = await seat(browser, 'Cat', code);

  await ana.getByRole('button', { name: 'Manage' }).click();
  const benRow = ana.locator('.player-row').filter({ hasText: 'Ben' });
  await benRow.getByRole('button', { name: 'Set stack' }).click();
  await ana.getByLabel('New stack for Ben').fill('100');
  await ana.getByRole('button', { name: 'Set', exact: true }).click();
  await expect(benRow).toContainText('100');
  await ana.keyboard.press('Escape');

  await ana.getByRole('button', { name: 'Deal the first hand' }).click();
  await expect(yourTurn(ana)).toBeVisible();
  await ana.getByRole('button', { name: 'Raise' }).click();
  await ana.getByRole('button', { name: /All in 1,000/ }).click();
  await ana.getByRole('button', { name: 'Place all in 1,000' }).click();

  await expect(yourTurn(ben)).toBeVisible();
  await stageAndPlace(ben, 'All in 95', 95);
  await expect(yourTurn(cat)).toBeVisible();
  await stageAndPlace(cat, 'All in 990', 990);

  await expect(ana.getByText('Choose how many times to run the board')).toBeVisible();
  await expect(ana.locator('.stage-line')).toHaveText('All in. Run it out.');
  await ana.getByRole('button', { name: 'Run remaining board…' }).click();
  await ana.getByRole('radio', { name: /^2×/ }).click();
  await ana.getByLabel('Players agreed verbally').check();
  await ana.getByRole('button', { name: 'Run it 2 times' }).click();

  for (const ordinal of ['First', 'Second']) {
    await expect(ana.getByText(`Runout ${ordinal === 'First' ? 1 : 2} of 2`, { exact: true })).toBeVisible();
    await ana.getByRole('button', { name: `${ordinal} runout complete` }).click();
    const main = ana.locator('.pot-pick').filter({ hasText: 'Main pot' });
    const side = ana.locator('.pot-pick').filter({ hasText: 'Side pot 1' });
    await expect(main).toContainText('150');
    await expect(side).toContainText('900');
    await expect(side.getByRole('button', { name: 'Ben' })).toHaveCount(0);
    await main.getByRole('button', { name: 'Ben' }).click();
    await side.getByRole('button', { name: 'Cat' }).click();
    await ana.getByRole('button', { name: 'Pay out' }).click();
    await confirmAward(ana);
  }

  await expect(stackOf(ana, 'Ben')).toHaveText('300');
  await expect(stackOf(ana, 'Cat')).toHaveText('1,800');
  await expect(stackOf(ana, 'Ana')).toHaveText('0');
  await ana.getByRole('button', { name: 'Request rebuy' }).click();
  await ana.getByLabel('Amount').fill('1000');
  await ana.getByRole('button', { name: 'Send request' }).click();
  await ana.getByRole('button', { name: 'Menu' }).click();
  await ana.getByRole('button', { name: 'Rebuy requests' }).click();
  await ana.getByRole('button', { name: 'Approve RM1,000' }).click();
  await expect(stackOf(ben, 'Ana')).toHaveText('1,000');
});

test('two players with the same hand chop the pot', async ({ browser }) => {
  const ana = await seat(browser, 'Ana');
  const code = codeOf(ana);
  const ben = await seat(browser, 'Ben', code);
  const cat = await seat(browser, 'Cat', code);

  await ana.getByRole('button', { name: 'Deal the first hand' }).click();
  await expect(yourTurn(ana)).toBeVisible();
  await stageAndPlace(ana, /Call/, 10);
  await expect(yourTurn(ben)).toBeVisible();
  await stageAndPlace(ben, /Call/, 5);
  await expect(yourTurn(cat)).toBeVisible();
  await cat.getByRole('button', { name: 'Check' }).click();
  for (let i = 0; i < 9; i++) await actWhoeverIsUp([ana, ben, cat], 'Check');

  await expect(ana.getByText('Tap every winner. Two or more chop it.')).toBeVisible();
  const rowFor = (page: Page, name: string) => page.locator('.win-row').filter({ hasText: name });

  await rowFor(ana, 'Ana').click();
  await expect(rowFor(ana, 'Ana').locator('.win-take')).toHaveText('+30');
  await expect(rowFor(ana, 'Ben').locator('.win-take')).toHaveText('Split');
  await expect(ana.getByRole('button', { name: 'Pay Ana 30' })).toBeVisible();

  await rowFor(ana, 'Ben').click();
  await expect(rowFor(ana, 'Ana').locator('.win-take')).toHaveText('+15');
  await expect(rowFor(ana, 'Ben').locator('.win-take')).toHaveText('+15');
  await expect(ana.getByText('Chopped two ways. 15 each.')).toBeVisible();

  await ana.getByRole('button', { name: 'Chop 30 two ways' }).click();
  await confirmAward(ana);
  await expect(ben.locator('.stage-line')).toHaveText(/chop it/);
  await expect(stackOf(cat, 'Ana')).toHaveText('1,005');
  await expect(stackOf(cat, 'Ben')).toHaveText('1,005');
  await expect(stackOf(cat, 'Cat')).toHaveText('990');
  for (const p of [ana, ben, cat]) expect((p as Page & { errors: string[] }).errors).toEqual([]);
});

test('the host can act for a seat without a phone, and undo rolls it back', async ({ browser }) => {
  const ana = await seat(browser, 'Ana');
  const code = codeOf(ana);
  const ben = await seat(browser, 'Ben', code);

  await ana.getByRole('button', { name: 'Manage' }).click();
  await ana.getByLabel('Add someone without a phone').fill('Gran');
  await ana.getByRole('button', { name: 'Add' }).click();
  await expect(ana.locator('.player-row').filter({ hasText: 'Gran' })).toBeVisible();
  await ana.keyboard.press('Escape');

  await ana.getByRole('button', { name: 'Deal the first hand' }).click();
  await expect(yourTurn(ana)).toBeVisible();
  await stageAndPlace(ana, 'Call 10', 10);
  await expect(yourTurn(ben)).toBeVisible();
  await stageAndPlace(ben, 'Call 5', 5);

  await expect(ana.getByRole('button', { name: 'Act for Gran' })).toBeVisible();
  await expect(ben.getByRole('button', { name: 'Act for Gran' })).toHaveCount(0);
  await ana.getByRole('button', { name: 'Act for Gran' }).click();
  await expect(ana.getByText('Acting for Gran')).toBeVisible();
  await ana.getByRole('button', { name: 'Check' }).click();
  await expect(ana.getByText('Deal the flop')).toBeVisible();

  await ben.getByRole('button', { name: 'Menu' }).click();
  await expect(ben.getByRole('button', { name: /^Undo/ })).toHaveCount(0);
  await ben.keyboard.press('Escape');

  await ana.getByRole('button', { name: 'Menu' }).click();
  await expect(ana.getByText('Gran checks (by Ana)')).toBeVisible();
  await ana.getByRole('button', { name: /^Undo/ }).click();
  await expect(ana.getByRole('heading', { name: 'Undo last action' })).toBeVisible();
  await ana.getByRole('button', { name: 'Undo action' }).click();
  await expect(ana.getByRole('button', { name: 'Act for Gran' })).toBeVisible();
  await expect(ben.locator('.phase-name')).toHaveText('Preflop');
});

test('the host can pause, publicly review, and confirm a voided hand', async ({ browser }) => {
  const ana = await seat(browser, 'Ana');
  const code = codeOf(ana);
  const ben = await seat(browser, 'Ben', code);
  await ana.getByRole('button', { name: 'Deal the first hand' }).click();
  await expect(yourTurn(ana)).toBeVisible();

  await ana.getByRole('button', { name: 'Menu' }).click();
  await ana.getByRole('button', { name: 'Pause hand' }).click();
  await ana.keyboard.press('Escape');
  await expect(ben.getByText('Player actions are locked')).toBeVisible();
  await ana.getByRole('button', { name: 'Resume hand' }).click();
  await expect(yourTurn(ana)).toBeVisible();

  await ana.getByRole('button', { name: 'Menu' }).click();
  await ana.getByRole('button', { name: 'Void hand' }).click();
  await ana.getByLabel('Reason').selectOption('Exposed card');
  await ana.getByRole('button', { name: 'Preview void' }).click();
  await expect(ben.getByText('Exposed card', { exact: true })).toBeVisible();
  await expect(ben.getByText('Waiting for host confirmation')).toBeVisible();
  await ana.getByRole('button', { name: 'Confirm void' }).click();
  await expect(ana.getByRole('button', { name: 'Deal the first hand' })).toBeVisible();
});

test('a new device can take over a seat after approval', async ({ browser }) => {
  const ana = await seat(browser, 'Ana');
  const code = codeOf(ana);
  const ben = await seat(browser, 'Ben', code);

  const ctx = await browser.newContext(test.info().project.use);
  contexts.push(ctx);
  const benTablet = await ctx.newPage();
  await benTablet.goto(`/t/${code}`);
  await benTablet.getByRole('button', { name: /^Ben/ }).click();
  await expect(benTablet.getByText('Asking the table')).toBeVisible();

  await expect(ana.getByText('A new device wants to take')).toBeVisible();
  await ana.getByRole('button', { name: 'Allow' }).click();

  await expect(benTablet.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(benTablet.locator('.seat-you')).toHaveCount(0);
  await expect(ben.getByText('Seat moved')).toBeVisible();
});

test('recovers after losing the connection', async ({ browser }) => {
  const ana = await seat(browser, 'Ana');
  const code = codeOf(ana);
  const ben = await seat(browser, 'Ben', code);
  await ana.getByRole('button', { name: 'Deal the first hand' }).click();
  await expect(yourTurn(ana)).toBeVisible();

  await ben.context().setOffline(true);
  await ben.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(ben.getByText('Connection lost')).toBeVisible({ timeout: 10_000 });
  await expect(ben.getByRole('button', { name: 'Try now' })).toBeVisible();
  await stageAndPlace(ana, 'Call 5', 5);
  await ben.context().setOffline(false);
  await ben.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(yourTurn(ben)).toBeVisible({ timeout: 20_000 });
  await ben.getByRole('button', { name: 'Check' }).click();
  await expect(ana.getByText('Deal the flop')).toBeVisible();
});

test('desktop keyboard shortcuts drive the action bar', async ({ browser }) => {
  const ana = await seat(browser, 'Ana', undefined, { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });
  const ben = await seat(browser, 'Ben', codeOf(ana));
  await ana.getByRole('button', { name: 'Deal the first hand' }).click();
  await expect(yourTurn(ana)).toBeVisible();
  await ana.keyboard.press('r');
  await expect(ana.getByText('Tap chips or choose a shortcut.')).toBeVisible();
  await ana.keyboard.press('ArrowUp');
  await expect(ana.getByRole('button', { name: 'Place 20' })).toBeVisible();
  await ana.keyboard.press('Enter');
  await expect(yourTurn(ben)).toBeVisible();
  await ben.getByRole('button', { name: 'Fold' }).click();
  await expect(ana.getByRole('button', { name: /Deal next hand/ })).toBeVisible();
  await ana.keyboard.press('n');
  await expect(ana.getByText('Hand 2', { exact: true })).toBeVisible();
});

test('live play keeps balances private and exposes current bets in phone landscape', async ({ browser }) => {
  const ana = await seat(browser, 'Ana');
  const code = codeOf(ana);
  const ben = await seat(browser, 'Ben', code);
  const cat = await seat(browser, 'Cat', code);

  await ana.getByRole('button', { name: 'Deal the first hand' }).click();
  await expect(yourTurn(ana)).toBeVisible();
  await expect(ana.locator('.table-shell')).toHaveCSS('background-color', 'rgb(146, 49, 59)');
  await expect(ana.locator('.dock-turn')).toHaveCSS('background-color', 'rgb(179, 58, 70)');
  await expect(ben.locator('.table-shell')).toHaveCSS('background-color', 'rgb(32, 53, 84)');
  await expect(ben.locator('.dock')).toHaveCSS('background-color', 'rgb(44, 69, 100)');
  await expect(ana.locator('.seat-stack')).toHaveCount(0);
  await expect(ben.locator('.seat-stack')).toHaveCount(0);
  await expect(ana.locator('.seat').filter({ hasText: /^Ana/ }).locator('.seat-bet')).toHaveText('0');
  await expect(ana.locator('.seat').filter({ hasText: /^Ben/ }).locator('.seat-bet')).toHaveText('5');
  await expect(ana.locator('.seat').filter({ hasText: /^Cat/ }).locator('.seat-bet')).toHaveText('10');
  await expect(ana.locator('.private-hand-total')).toContainText('In this hand');

  await ana.getByRole('button', { name: 'Raise' }).click();
  await ana.getByRole('button', { name: /Custom/ }).click();
  await ana.getByLabel('Custom amount').fill('11');
  await ana.getByRole('button', { name: 'Place 11' }).click();
  await expect(yourTurn(ben)).toBeVisible();

  await ben.setViewportSize({ width: 568, height: 320 });
  await expect(ben.getByRole('region', { name: 'Current street bets' })).toBeVisible();
  await expect(ben.getByRole('button', { name: 'Call 6' })).toBeVisible();
  await ben.getByRole('button', { name: 'Call 6' }).click();
  const stagedChipWidth = await ben.locator('.staged-chip').first().evaluate((chip) => chip.getBoundingClientRect().width);
  expect(stagedChipWidth).toBeGreaterThanOrEqual(78);
  const compactOverflow = await ben.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(compactOverflow).toBeLessThanOrEqual(0);

  await ana.setViewportSize({ width: 844, height: 390 });
  const rail = ana.getByRole('region', { name: 'Current street bets' });
  await expect(rail).toBeVisible();
  await expect(rail.getByRole('listitem')).toHaveCount(3);
  await expect(rail.getByText('Pot', { exact: true })).toHaveCount(0);
  await expect(rail.getByRole('listitem').filter({ hasText: 'Ana' })).toContainText('11');
  await expect(rail).toContainText('Ben');
  await expect(rail).toContainText('Cat');

  // A wide emulated phone must not inherit the desktop side-column layout.
  await ana.setViewportSize({ width: 1024, height: 500 });
  const dockBox = await ana.locator('.dock-wrap').boundingBox();
  expect(dockBox?.x).toBeLessThanOrEqual(1);
  expect(dockBox?.width).toBeGreaterThanOrEqual(1023);
  await expect(ana.locator('.table-controls-handle')).toBeInViewport();
});

test('no horizontal overflow from small phones to desktops', async ({ browser }) => {
  const host = await seat(browser, 'Ana with a long name');
  const code = codeOf(host);
  await seat(browser, 'Bartholomew', code);
  for (const width of [320, 390, 768, 1024, 1440]) {
    const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width, height: 800 } });
    const page = await ctx.newPage();
    for (const path of ['/', `/t/${code}`, `/t/${code}?view=display`]) {
      await page.goto(path);
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
    }
    await ctx.close();
  }
});

test('a full fifteen-player lobby remains usable on a phone', async ({ browser }) => {
  const host = await seat(browser, 'Host');
  const code = codeOf(host);
  for (let i = 2; i <= 15; i++) await seat(browser, `Player ${i}`, code);

  await expect(host.getByRole('heading', { name: 'Seats 15/15' })).toBeVisible();
  await expect(host.locator('.lobby-seats > li')).toHaveCount(15);
  const overflow = await host.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await host.getByRole('button', { name: 'Manage' }).click();
  await expect(host.getByRole('dialog', { name: 'Players' }).getByText('Player 15', { exact: true })).toBeVisible();
  await host.keyboard.press('Escape');
  await host.getByRole('button', { name: 'Deal the first hand' }).click();
  await host.setViewportSize({ width: 844, height: 390 });
  const rail = host.getByRole('region', { name: 'Current street bets' });
  await expect(rail.getByRole('listitem')).toHaveCount(15);
  const railMetrics = await rail.locator('.bet-rail-scroll').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    minimumCell: (element.querySelector('li') as HTMLElement | null)?.getBoundingClientRect().width ?? 0,
  }));
  expect(railMetrics.scrollWidth).toBeGreaterThan(railMetrics.clientWidth);
  expect(railMetrics.minimumCell).toBeGreaterThanOrEqual(120);
});

test('guests cannot take hosting while the unseated creator is connected or still in the grace period', async ({ browser }) => {
  const creatorContext = await browser.newContext(test.info().project.use);
  contexts.push(creatorContext);
  const creator = await creatorContext.newPage();
  await creator.goto('/');
  await creator.getByRole('button', { name: 'Create a room' }).click();
  await creator.getByRole('button', { name: 'Continue' }).click();
  await creator.getByLabel('Starting balance').fill('1000');
  await creator.getByLabel('Small blind').fill('5');
  await creator.getByLabel('Big blind').fill('10');
  await creator.getByRole('button', { name: 'Continue' }).click();
  await creator.getByRole('button', { name: 'Create room' }).click();
  await creator.waitForURL(/\/invite\/[A-Z]{4}$/);
  await creator.getByRole('button', { name: 'Open lobby' }).click();
  await creator.waitForURL(/\/t\/[A-Z]{4}$/);

  const guest = await seat(browser, 'Guest', codeOf(creator));
  await guest.getByRole('button', { name: 'Menu' }).click();
  await expect(guest.getByRole('button', { name: 'Take over hosting' })).toHaveCount(0);
  await guest.keyboard.press('Escape');

  await creator.close();
  await guest.waitForTimeout(200);
  await guest.getByRole('button', { name: 'Menu' }).click();
  await expect(guest.getByRole('button', { name: 'Take over hosting' })).toHaveCount(0);
});

test('unknown table codes and room pages explain themselves', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Join a table' }).click();
  await page.getByLabel('Room code').fill('zzzz');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('No room called ZZZZ');
  await page.goto('/t/QQQQ');
  await expect(page.getByText('No table called QQQQ')).toBeVisible();
});
