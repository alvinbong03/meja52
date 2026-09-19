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
  await page.getByRole('button', { name: 'Join lobby' }).click();
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

  await expect(ana.getByText('Who won?')).toBeVisible();
  await expect(ana.locator('.stage-line')).toHaveText('All in. Run it out.');
  const main = ana.locator('.pot-pick').filter({ hasText: 'Main pot' });
  const side = ana.locator('.pot-pick').filter({ hasText: 'Side pot 1' });
  await expect(main).toContainText('300');
  await expect(side).toContainText('1,800');
  await expect(side.getByRole('button', { name: 'Ben' })).toHaveCount(0);

  await main.getByRole('button', { name: 'Ben' }).click();
  await side.getByRole('button', { name: 'Cat' }).click();
  await ana.getByRole('button', { name: 'Pay out' }).click();

  await expect(stackOf(ana, 'Ben')).toHaveText('300');
  await expect(stackOf(ana, 'Cat')).toHaveText('1,800');
  await expect(stackOf(ana, 'Ana')).toHaveText('0');
  await expect(ana.getByRole('button', { name: 'Rebuy for 1,000' })).toBeVisible();
  await ana.getByRole('button', { name: 'Rebuy for 1,000' }).click();
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
  await expect(ben.locator('.stage-line')).toHaveText(/chop it/);
  await expect(stackOf(cat, 'Ana')).toHaveText('1,005');
  await expect(stackOf(cat, 'Ben')).toHaveText('1,005');
  await expect(stackOf(cat, 'Cat')).toHaveText('990');
  for (const p of [ana, ben, cat]) expect((p as Page & { errors: string[] }).errors).toEqual([]);
});

test('anyone can act for a seat without a phone, and undo rolls it back', async ({ browser }) => {
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
  await ben.getByRole('button', { name: 'Act for Gran' }).click();
  await expect(ben.getByText('Acting for Gran')).toBeVisible();
  await ben.getByRole('button', { name: 'Check' }).click();
  await expect(ana.getByText('Deal the flop')).toBeVisible();

  await ben.getByRole('button', { name: 'Menu' }).click();
  await expect(ben.getByRole('button', { name: /^Undo/ })).toHaveCount(0);
  await ben.keyboard.press('Escape');

  await ana.getByRole('button', { name: 'Menu' }).click();
  await expect(ana.getByText('Gran checks (by Ben)')).toBeVisible();
  await ana.getByRole('button', { name: /^Undo/ }).click();
  await expect(ben.getByRole('button', { name: 'Act for Gran' })).toBeVisible();
  await expect(ben.locator('.phase-name')).toHaveText('Preflop');
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
  await expect(ben.locator('.table-shell')).toHaveCSS('background-color', 'rgb(32, 53, 84)');
  await expect(ana.locator('.seat-stack')).toHaveCount(0);
  await expect(ben.locator('.seat-stack')).toHaveCount(0);
  await expect(ana.locator('.private-hand-total')).toContainText('In this hand');

  await ana.getByRole('button', { name: 'Raise' }).click();
  await ana.getByRole('button', { name: /Custom/ }).click();
  await ana.getByLabel('Custom amount').fill('11');
  await ana.getByRole('button', { name: 'Place 11' }).click();
  await expect(yourTurn(ben)).toBeVisible();

  await ben.setViewportSize({ width: 568, height: 320 });
  await expect(ben.getByRole('region', { name: 'Current street bets' })).toBeVisible();
  await expect(ben.getByRole('button', { name: 'Call 6' })).toBeVisible();
  const compactOverflow = await ben.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(compactOverflow).toBeLessThanOrEqual(0);

  await ana.setViewportSize({ width: 844, height: 390 });
  const rail = ana.getByRole('region', { name: 'Current street bets' });
  await expect(rail).toBeVisible();
  await expect(rail.getByRole('listitem')).toHaveCount(3);
  await expect(rail.getByRole('listitem').filter({ hasText: 'Ana' })).toContainText('11');
  await rail.getByRole('button', { name: /Pot/ }).click();
  await expect(rail.getByRole('listitem')).toHaveCount(3);
  await expect(rail).toContainText('Ben');
  await expect(rail).toContainText('Cat');
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
