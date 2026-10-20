import { test as base, expect, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { mkdtempSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const EXT = path.resolve(process.env.WTR_EXT ?? 'dist/world-time-ruler'); // WTR_EXT: test a folder extracted from the ZIP
const SHOTS = path.resolve('docs/test-screenshots');
mkdirSync(SHOTS, { recursive: true });
const ID = { sf: 'gn5391959', chicago: 'gn4887398', ny: 'gn5128581', london: 'gn2643743', istanbul: 'gn745044', tokyo: 'gn1850147', kathmandu: 'gn1283240' };

const launch = (dir: string) => chromium.launchPersistentContext(dir, {
  channel: 'chromium', headless: true, viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
async function worker(ctx: BrowserContext): Promise<Worker> {
  return ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
}

interface Fx { ctx: BrowserContext; sw: Worker; extId: string; problems: string[]; open: (opts?: { clock?: string; width?: number; height?: number }) => Promise<Page> }
const test = base.extend<Fx>({
  ctx: async ({}, use) => { const ctx = await launch(mkdtempSync(path.join(tmpdir(), 'wtr-'))); await use(ctx); await ctx.close(); },
  sw: async ({ ctx }, use) => { await use(await worker(ctx)); },
  extId: async ({ sw }, use) => { await use(new URL(sw.url()).host); },
  // Every console error, page error, CSP violation, failed request and non-extension request is a failure.
  problems: async ({ ctx }, use) => {
    const problems: string[] = [];
    const watch = (page: Page) => {
      page.on('console', m => { if (m.type() === 'error' || /content security policy/i.test(m.text())) problems.push(`console ${m.type()}: ${m.text()}`); });
      page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
      page.on('requestfailed', r => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
      page.on('request', r => { if (!r.url().startsWith('chrome-extension://')) problems.push(`remote request: ${r.url()}`); });
      page.on('response', r => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
    };
    ctx.pages().forEach(watch); ctx.on('page', watch);
    await use(problems);
    expect(problems, 'console / CSP / network problems').toEqual([]);
  },
  open: async ({ ctx, extId, problems }, use) => {
    void problems;
    await use(async (opts = {}) => {
      const page = await ctx.newPage();
      if (opts.width) await page.setViewportSize({ width: opts.width, height: opts.height ?? 800 });
      if (opts.clock) await page.clock.install({ time: new Date(opts.clock) });
      await page.goto(`chrome-extension://${extId}/index.html`);
      await page.locator('.cell').first().waitFor();
      await page.locator('svg.world .city').first().waitFor();
      return page;
    });
  },
});

const cell = (page: Page, id: string) => page.locator(`.bar .cell[data-city="${id}"]`);
const cellTime = async (page: Page, id: string) => ((await cell(page, id).locator('.tm').textContent()) ?? '').replace(/\s*(AM|PM)$/, ' $1').trim();
const cellDate = async (page: Page, id: string) => (await cell(page, id).locator('.dd').innerText()).trim();
const names = (page: Page) => page.locator('.bar .cell .nm').allInnerTexts().then(a => a.map(s => s.toUpperCase()));
async function convert(page: Page, id: string, date: string, time: string, mer?: 'AM' | 'PM') {
  await cell(page, id).click();
  const ed = page.locator('.editor');
  await ed.getByLabel('Date').fill(date);
  await ed.getByLabel('Time').fill(time);
  if (mer) await ed.getByRole('button', { name: mer, exact: true }).click();
  await ed.getByRole('button', { name: 'Apply' }).click();
  return ed;
}
const sunX = (page: Page) => page.locator('svg.world circle.sun').getAttribute('cx').then(Number);
const nightPath = (page: Page) => page.locator('svg.world [data-layer="daynight"] path').nth(2).getAttribute('d');

test('manifest: MV3, storage only, no popup, no new-tab override, icons present', async () => {
  const m = JSON.parse(readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  expect(m.manifest_version).toBe(3);
  expect(m.permissions).toEqual(['storage']);
  expect(m.host_permissions).toBeUndefined();
  expect(m.optional_permissions).toBeUndefined();
  expect(m.action.default_popup).toBeUndefined();
  expect(m.chrome_url_overrides).toBeUndefined();
  expect(m.content_scripts).toBeUndefined();
  for (const s of ['16', '32', '48', '128']) {
    const png = readFileSync(path.join(EXT, m.icons[s]));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(+s); expect(png.readUInt32BE(20)).toBe(+s);
  }
  const html = readFileSync(path.join(EXT, 'index.html'), 'utf8');
  expect(html).not.toMatch(/https?:\/\//);
  expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/); // no inline scripts
  expect(html).not.toMatch(/\son[a-z]+=/);                   // no inline handlers
});

test('toolbar click opens a dedicated, active extension tab (new tab per click)', async ({ ctx, sw, extId, problems }) => {
  void problems;
  const before = ctx.pages().length;
  // Playwright cannot press the real toolbar button; this fires the same chrome.action.onClicked event the button fires.
  const [page] = await Promise.all([
    ctx.waitForEvent('page'),
    sw.evaluate(() => (chrome.action.onClicked as unknown as { dispatch: (t: object) => void }).dispatch({ id: 0 })),
  ]);
  await page.waitForLoadState();
  expect(page.url()).toBe(`chrome-extension://${extId}/index.html`);
  await expect(page.locator('h1.brand')).toHaveText(/world time ruler/i);
  await expect(page).toHaveTitle('World Time Ruler');
  // The new tab is the active one (compare tab ids; URLs are hidden without the "tabs" permission, which is not requested).
  const mine = await page.evaluate(async () => (await chrome.tabs.getCurrent())?.id);
  const active = await sw.evaluate(async () => (await chrome.tabs.query({ active: true })).map(t => t.id));
  expect(active).toContain(mine);
  const [second] = await Promise.all([ctx.waitForEvent('page'), sw.evaluate(() => (chrome.action.onClicked as unknown as { dispatch: (t: object) => void }).dispatch({ id: 0 }))]);
  await second.waitForLoadState();
  expect(ctx.pages().length).toBe(before + 2);
  expect(await sw.evaluate(() => chrome.action.getPopup({}))).toBe('');
});

test('loads fully offline: no remote requests, fonts and map bundled, no console or CSP errors', async ({ ctx, open }) => {
  await ctx.setOffline(true);
  const requested: string[] = [];
  ctx.on('request', r => requested.push(r.url()));
  const page = await open();
  await expect(page.locator('.bar .cell')).toHaveCount(11);
  await expect(page.locator('svg.world .city')).toHaveCount(81); // 63 handoff dots + 18 always-labelled cities outside that set
  expect((await page.locator('svg.world path').nth(1).getAttribute('d'))!.length).toBeGreaterThan(20000); // country geometry
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, '')));
  expect(fonts).toContain('Inter Variable');
  expect(fonts).toContain('JetBrains Mono Variable');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.cell .tm')!).fontFamily)).toContain('JetBrains Mono');
  expect(requested.length).toBeGreaterThan(3); // html, js, css, fonts
  expect(requested.filter(u => !u.startsWith('chrome-extension://'))).toEqual([]);
  expect(requested.some(u => u.endsWith('.woff2'))).toBe(true);
});

test('content security policy: no eval, no remote code, remote connections refused even when online', async ({ ctx, extId }) => {
  const page = await ctx.newPage();
  const violations: string[] = [];
  page.on('console', m => { if (/content security policy/i.test(m.text())) violations.push(m.text()); });
  await page.goto(`chrome-extension://${extId}/index.html`);
  const csp = await page.evaluate(() => chrome.runtime.getManifest().content_security_policy as unknown as { extension_pages: string });
  expect(csp.extension_pages).toContain("script-src 'self'");
  expect(csp.extension_pages).toContain("connect-src 'none'");
  expect(csp.extension_pages).not.toMatch(/unsafe-eval|unsafe-inline|https?:/);
  expect(await page.evaluate(() => fetch('https://example.com/').then(() => 'allowed', () => 'blocked'))).toBe('blocked');
  await expect.poll(() => violations.length).toBeGreaterThan(0);
  // A remote <script> injected into the page is refused as well.
  await page.evaluate(() => new Promise<void>(res => { const el = document.createElement('script'); el.src = 'https://example.com/x.js'; el.onerror = () => res(); el.onload = () => res(); document.head.append(el); }));
  expect(violations.some(v => /script-src/.test(v))).toBe(true);
});

test('required conversions through the editor; map and ruler update together', async ({ open }) => {
  const page = await open();
  await expect(page.locator('.pill.live')).toBeVisible();
  const liveSun = await sunX(page), liveNight = await nightPath(page);

  // Oct 7 2026, 7:53 AM Istanbul
  await convert(page, ID.istanbul, '2026-10-07', '7:53', 'AM');
  await expect(page.locator('.pill.plan').first()).toBeVisible();
  await expect(page.getByTestId('plan-city')).toHaveText('Istanbul');
  await expect(page.getByTestId('plan-date')).toHaveText('October 7, 2026');
  await expect(page.getByTestId('plan-time')).toHaveText('7:53 AM');
  expect(await cellTime(page, ID.tokyo)).toBe('1:53 PM');
  expect(await cellDate(page, ID.tokyo)).toBe('Wed, Oct 7');
  expect(await cellTime(page, ID.sf)).toBe('9:53 PM');
  expect(await cellDate(page, ID.sf)).toBe('Tue, Oct 6');
  await expect(cell(page, ID.sf).locator('b.prev')).toHaveText('PREV');
  await expect(page.getByTestId('gmt')).toContainText('4:53 AM');
  await expect(page.locator('.foot')).toContainText('Planning instant · 2026-10-07 04:53Z');
  // map labels show the same instant as the ruler
  await expect(page.locator(`svg.world .city[data-city="${ID.tokyo}"] text.time`)).toHaveText('1:53 PM');
  await expect(page.locator(`svg.world .city[data-city="${ID.sf}"] text.time`)).toHaveText('9:53 PM');
  // Kathmandu: +2h 45m vs Istanbul (tooltip)
  await page.locator(`svg.world .city[data-city="${ID.kathmandu}"] circle.ring`).hover();
  await expect(page.locator('.tip')).toContainText('+2h 45m');
  await expect(page.locator('.tip')).toContainText('Asia/Kathmandu');
  await expect(page.locator('.tip')).toContainText('UTC+5:45');
  await expect(page.locator('.tip .big')).toHaveText(/10:38\s*AM/);
  await page.mouse.move(5, 5);
  const sunA = await sunX(page), nightA = await nightPath(page);
  expect(nightA).not.toBe(liveNight);

  // Oct 7 2026, 5:30 PM New York — source city changes, home does not
  await convert(page, ID.ny, '2026-10-07', '5:30', 'PM');
  await expect(page.getByTestId('plan-city')).toHaveText('New York');
  await expect(page.getByTestId('plan-time')).toHaveText('5:30 PM');
  expect(await cellTime(page, ID.istanbul)).toBe('12:30 AM');
  expect(await cellDate(page, ID.istanbul)).toBe('Thu, Oct 8');
  await expect(cell(page, ID.istanbul)).toHaveClass(/home/);
  await expect(cell(page, ID.ny).locator('b.prev')).toBeVisible();
  await expect(page.locator('.top .home-meta')).toContainText('Istanbul');
  await page.locator(`svg.world .city[data-city="${ID.kathmandu}"] circle.ring`).hover();
  await expect(page.locator('.tip')).toContainText('+2h 45m');
  await expect(page.locator('.tip .big')).toHaveText(/3:15\s*AM/);
  await page.mouse.move(5, 5);
  const sunB = await sunX(page);
  expect(Math.abs(sunB - sunA)).toBeGreaterThan(100); // sun marker moved with the instant
  expect(await nightPath(page)).not.toBe(nightA);
  await page.screenshot({ path: path.join(SHOTS, 'planning-ny-1440.png') });

  // Planning stays fixed while the clock runs; Back to now returns to live.
  await page.getByRole('button', { name: 'Back to now' }).click();
  await expect(page.locator('.pill.live')).toBeVisible();
  await expect(page.locator('.plan-strip')).toHaveCount(0);
  await expect.poll(async () => Math.abs((await sunX(page)) - liveSun)).toBeLessThan(8); // map re-fits once the strip is gone
});

test('ambiguous time offers both occurrences; nonexistent time is rejected', async ({ open }) => {
  const page = await open();
  // New York, Nov 1 2026, 1:30 AM — happens twice
  const ed = await convert(page, ID.ny, '2026-11-01', '1:30', 'AM');
  await expect(ed).toBeVisible();
  await expect(page.locator('.pill.live')).toBeVisible(); // nothing applied yet
  await expect(ed.locator('.note')).toContainText('happens twice');
  const radios = ed.getByRole('radio');
  await expect(radios).toHaveCount(2);
  await expect(ed.locator('.occ label').nth(0)).toContainText('First · UTC−4');
  await expect(ed.locator('.occ label').nth(1)).toContainText('Second · UTC−5');
  await expect(ed.getByRole('button', { name: 'Apply' })).toBeDisabled(); // no silent default
  await radios.nth(1).check();
  await ed.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('.plan-strip')).toContainText('second occurrence · UTC−5');
  await expect(page.locator('.foot')).toContainText('2026-11-01 06:30Z');
  expect(await cellTime(page, ID.ny)).toBe('1:30 AM');
  // …and the first occurrence is a different instant
  const ed2 = await convert(page, ID.ny, '2026-11-01', '1:30', 'AM');
  await ed2.getByRole('radio').nth(0).check();
  await ed2.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('.plan-strip')).toContainText('first occurrence · UTC−4');
  await expect(page.locator('.foot')).toContainText('2026-11-01 05:30Z');
  await page.getByRole('button', { name: 'Back to now' }).click();

  // New York, Mar 8 2026, 2:30 AM — does not exist
  const ed3 = await convert(page, ID.ny, '2026-03-08', '2:30', 'AM');
  await expect(ed3).toBeVisible();
  await expect(ed3.locator('.note')).toContainText('2:30 AM does not exist in New York on Mar 8, 2026');
  await expect(ed3.locator('.note')).toContainText('clocks jump from 2:00 AM to 3:00 AM');
  await expect(page.locator('.plan-strip')).toHaveCount(0);
  await expect(page.locator('.pill.live')).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, 'editor-gap-rejected.png') });
  // a valid time is then accepted
  await ed3.getByLabel('Time').fill('3:30');
  await ed3.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('.foot')).toContainText('2026-03-08 07:30Z');
});

test('editor: validation, keyboard (Enter / Escape), 24-hour input, map-dot entry point', async ({ open }) => {
  const page = await open();
  await cell(page, ID.tokyo).focus();
  await expect(page.locator('.tip[role="tooltip"]')).toContainText('Tokyo'); // tooltip on keyboard focus
  await expect(cell(page, ID.tokyo)).toHaveAttribute('aria-describedby', 'wtr-tip');
  await page.keyboard.press('Enter');
  const ed = page.locator('.editor');
  await expect(ed).toBeVisible();
  await expect(ed.getByLabel('Time')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(ed).toHaveCount(0);
  await expect(cell(page, ID.tokyo)).toBeFocused();
  await expect(page.locator('.pill.live')).toBeVisible();

  await page.keyboard.press('Enter');
  await ed.getByLabel('Date').fill('2026-02-30');
  await page.keyboard.press('Enter');
  await expect(ed.locator('.note')).toContainText('not a calendar date');
  await ed.getByLabel('Date').fill('07/10/2026');
  await page.keyboard.press('Enter');
  await expect(ed.locator('.note')).toContainText('YYYY-MM-DD');
  await ed.getByLabel('Date').fill('2026-10-07');
  await ed.getByLabel('Time').fill('25:99');
  await page.keyboard.press('Enter');
  await expect(ed.locator('.note')).toContainText(/Minutes|Hour/);
  await ed.getByLabel('Time').fill('nope');
  await page.keyboard.press('Enter');
  await expect(ed.locator('.note')).toContainText('Enter a time like');
  await expect(page.locator('.plan-strip')).toHaveCount(0);
  await ed.getByLabel('Time').fill('9:15');
  await ed.getByRole('button', { name: 'PM', exact: true }).click();
  await ed.getByLabel('Time').press('Enter');
  await expect(page.getByTestId('plan-time')).toHaveText('9:15 PM');
  await expect(page.getByTestId('plan-city')).toHaveText('Tokyo');

  // 24h: no AM/PM toggle, strip and ruler re-format
  await page.locator('.top').getByRole('button', { name: '24h' }).click();
  await expect(page.getByTestId('plan-time')).toHaveText('21:15');
  expect(await cellTime(page, ID.tokyo)).toBe('21:15');
  await page.locator(`svg.world .city[data-city="${ID.kathmandu}"] circle.ring`).click(); // a map-only city
  await expect(ed).toContainText('Kathmandu, Nepal');
  await expect(ed.getByRole('button', { name: 'AM', exact: true })).toHaveCount(0);
  await ed.getByLabel('Date').fill('2026-10-07');
  await ed.getByLabel('Time').fill('17:30');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('plan-city')).toHaveText('Kathmandu');
  await expect(page.locator('.foot')).toContainText('2026-10-07 11:45Z');
  expect(await cellTime(page, ID.istanbul)).toBe('14:45');
  // clicking the map outside the editor cancels it
  await cell(page, ID.london).click();
  await expect(ed).toBeVisible();
  await page.locator('.map').click({ position: { x: 20, y: 200 } });
  await expect(ed).toHaveCount(0);
  await expect(page.getByTestId('plan-city')).toHaveText('Kathmandu');
});

test('Add city: search, IANA zone shown, duplicates blocked, replace at the ten-city limit', async ({ open }) => {
  const page = await open();
  await page.getByRole('button', { name: 'Add city' }).click();
  const panel = page.getByRole('dialog', { name: /add city|replace city/i });
  await expect(panel).toContainText('10 / 10 saved');
  await expect(panel).toContainText('Ruler is full');
  const search = panel.getByRole('combobox');
  await expect(search).toBeFocused();
  await search.fill('london');
  await expect(panel.locator('[data-result="gn2643743"]')).toContainText('Europe/London');
  await expect(panel.locator('[data-result="gn2643743"]')).toContainText('Saved');
  await expect(panel.locator('[data-result]').filter({ hasText: 'America/Toronto' })).toContainText('Canada');
  await panel.locator('[data-result="gn2643743"]').click({ force: true }); // duplicate (aria-disabled, still clickable)
  await expect(panel).toContainText('already on the ruler');
  await expect(page.locator('.bar .cell')).toHaveCount(11);
  await search.fill('nepal'); // by country
  await expect(panel.locator(`[data-result="${ID.kathmandu}"]`)).toContainText('Asia/Kathmandu');
  await search.fill('kathm');
  await page.keyboard.press('Enter'); // keyboard add → full → replace step
  await expect(panel).toContainText('Choose the saved city that Kathmandu, Nepal replaces');
  await expect(panel.locator(`[data-replace="${ID.istanbul}"]`)).toBeDisabled(); // home is locked
  await panel.locator(`[data-replace="${ID.chicago}"]`).click();
  await expect(page.locator('.bar .cell')).toHaveCount(11);
  expect(await names(page)).toEqual(['SAN FRANCISCO', 'NEW YORK', 'GMT', 'LONDON', 'BERLIN', 'ISTANBUL', 'DUBAI', 'MUMBAI', 'KATHMANDU', 'SINGAPORE', 'TOKYO']);
  await expect(cell(page, ID.kathmandu).locator('.diff')).toHaveText('+2h 45m');
  await expect(page.locator(`svg.world .city[data-city="${ID.kathmandu}"] text.name`)).toHaveText('Kathmandu'); // now labelled on the map
  await expect(page.locator(`svg.world .city[data-city="${ID.chicago}"] text.name`)).toHaveCount(0);           // Chicago back to a plain dot
  await expect(page.locator('svg.world .city')).toHaveCount(81);
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);

  // below the limit: add a city that is not part of the handoff map set → it appears on ruler and map
  await page.getByRole('button', { name: 'Manage' }).click();
  await page.getByRole('button', { name: 'Remove Berlin' }).click();
  await expect(page.locator('.bar .cell')).toHaveCount(10);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add city' }).click();
  await page.getByRole('combobox').fill('adelaide');
  await page.locator('[data-result]').first().click();
  await expect(page.getByRole('dialog')).toContainText('Adelaide added');
  await expect(page.locator('.bar .cell')).toHaveCount(11);
  await expect(page.locator('svg.world .city')).toHaveCount(82);
  await expect(page.locator('.bar .cell .nm').last()).toHaveText(/adelaide/i); // UTC+10:30 in October: east of Tokyo
  await expect(page.locator('.foot')).toContainText('82 cities on map · 10 + GMT on ruler');

  // an always-labelled map city can also be put on the ruler; the map keeps one dot for it
  await page.getByRole('combobox').fill('madrid');
  await page.locator('[data-result="gn3117735"]').click();
  await expect(page.getByRole('dialog')).toContainText('Choose the saved city that Madrid, Spain replaces');
  await page.locator(`[data-replace="${ID.kathmandu}"]`).click();
  await expect(cell(page, 'gn3117735').locator('.diff')).toHaveText('−1h');
  await expect(page.locator('svg.world .city[data-city="gn3117735"]')).toHaveCount(1);
  await expect(page.locator('svg.world .city')).toHaveCount(82);
});

test('Manage: remove, change home (offsets and badges update), home removal needs a replacement', async ({ open }) => {
  const page = await open();
  await convert(page, ID.istanbul, '2026-10-07', '7:53', 'AM');
  await page.getByRole('button', { name: 'Manage' }).click();
  const panel = page.getByRole('dialog', { name: 'Manage cities' });
  await expect(panel.locator('[data-saved]')).toHaveCount(10);
  await panel.getByRole('button', { name: 'Remove Chicago' }).click();
  await expect(panel.locator('[data-saved]')).toHaveCount(9);
  await expect(page.locator('.bar .cell')).toHaveCount(10);

  await expect(cell(page, ID.sf).locator('.diff')).toHaveText('−10h');
  await panel.getByRole('radio', { name: 'Set Tokyo as home' }).check();
  await expect(cell(page, ID.tokyo)).toHaveClass(/home/);
  await expect(cell(page, ID.tokyo).locator('.diff')).toHaveText('HOME');
  await expect(cell(page, ID.istanbul).locator('.diff')).toHaveText('−6h');
  await expect(cell(page, ID.sf).locator('.diff')).toHaveText('−16h');
  await expect(cell(page, ID.sf).locator('b.prev')).toBeVisible();
  await expect(page.locator('.top .home-meta')).toContainText('Tokyo');
  await expect(page.getByTestId('plan-city')).toHaveText('Istanbul'); // conversion source unaffected

  // removing home: blocked until a replacement is chosen
  await panel.getByRole('button', { name: 'Remove Tokyo' }).click();
  await expect(panel).toContainText('Choose a replacement home before removing it');
  await expect(panel.locator('[data-saved]')).toHaveCount(9);
  await panel.getByLabel('New home city').selectOption({ label: 'London, UK' });
  await panel.locator('[data-confirm-remove-home]').click();
  await expect(panel.locator('[data-saved]')).toHaveCount(8);
  await expect(cell(page, ID.london)).toHaveClass(/home/);
  await expect(cell(page, ID.tokyo)).toHaveCount(0);
  await expect(cell(page, ID.istanbul).locator('.diff')).toHaveText('+2h');

  await expect(cell(page, ID.sf).locator('b.prev')).toBeVisible();          // SF Oct 6 vs London Oct 7
  await expect(page.locator('.bar .cell[data-city="gmt"] .diff')).toHaveText('−1h'); // London is on BST

  // map label switches: every map dot that is not a saved city is listed (81 dots − 8 saved after the removals above); 29 start on, the rest off.
  // A saved city and an always-labelled city lose their label but keep their dot, a plain dot gains one; the choices survive a reload
  await expect(panel.locator('[data-labelled]')).toHaveCount(73);
  await expect(panel.locator('[data-labelled][data-on]')).toHaveCount(29);
  await expect(panel.getByRole('checkbox', { name: 'Show label for Lima' })).not.toBeChecked();
  await expect(page.locator('svg.world .city[data-city="gn3936456"] text.name')).toHaveCount(0); // Lima: dot only
  await panel.getByRole('checkbox', { name: 'Show label for Lima' }).check();
  await expect(page.locator('svg.world .city[data-city="gn3936456"] text.name')).toHaveText('Lima');
  await expect(panel.locator('[data-labelled][data-on]')).toHaveCount(30);
  await panel.getByRole('checkbox', { name: 'Show label for Istanbul' }).uncheck();
  await panel.getByRole('checkbox', { name: 'Show label for Miami' }).uncheck();
  await expect(page.locator(`svg.world .city[data-city="${ID.istanbul}"] text.name`)).toHaveCount(0);
  await expect(page.locator(`svg.world .city[data-city="${ID.istanbul}"] circle.dot`)).toHaveCount(1);
  await expect(page.locator('svg.world .city[data-city="gn4164138"] text.name')).toHaveCount(0);
  await expect(page.locator('svg.world .city[data-city="gn4164138"] circle.dot')).toHaveCount(1);
  await expect(cell(page, ID.istanbul)).toHaveCount(1); // still on the ruler
  await page.reload();
  await expect(page.locator(`svg.world .city[data-city="${ID.istanbul}"] text.name`)).toHaveCount(0);
  await expect(page.locator('svg.world .city[data-city="gn3936456"] text.name')).toHaveText('Lima');
  await page.getByRole('button', { name: 'Manage' }).click();
  await page.getByRole('checkbox', { name: 'Show label for Lima' }).uncheck();
  await expect(page.locator('svg.world .city[data-city="gn3936456"] text.name')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Show label for Istanbul' }).check();
  await expect(page.locator(`svg.world .city[data-city="${ID.istanbul}"] text.name`)).toHaveText('Istanbul');
});

test('Settings persist across reload and browser restart, sync between tabs, and reset after confirmation', async ({ }, info) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'wtr-persist-'));
  let ctx = await launch(dir);
  let extId = new URL((await worker(ctx)).url()).host;
  const url = () => `chrome-extension://${extId}/index.html`;
  const a = await ctx.newPage(); await a.goto(url());
  const b = await ctx.newPage(); await b.goto(url());
  await a.bringToFront();
  await a.locator('.top').getByRole('button', { name: '24h' }).click();
  await a.locator('[data-theme-toggle]').click();
  await a.getByRole('button', { name: 'Manage' }).click();
  await a.getByRole('button', { name: 'Remove Chicago' }).click();
  await a.getByRole('radio', { name: 'Set Tokyo as home' }).check();
  // tab B follows without a reload
  await expect(b.locator('body')).toHaveClass(/light/);
  await expect(b.locator('.top .seg button.on')).toHaveText('24h');
  await expect(b.locator('.bar .cell')).toHaveCount(10);
  await expect(b.locator(`.bar .cell[data-city="${ID.tokyo}"]`)).toHaveClass(/home/);
  expect(await b.locator(`.bar .cell[data-city="${ID.tokyo}"] .tm`).textContent()).toMatch(/^\d\d:\d\d$/);
  await b.reload();
  await expect(b.locator('body')).toHaveClass(/light/);
  await expect(b.locator('.bar .cell')).toHaveCount(10);
  const stored = await a.evaluate(() => chrome.storage.local.get(null));
  expect(stored['wtr.prefs']).toMatchObject({ v: 1, hour12: false, theme: 'light', home: ID.tokyo });
  expect(await a.evaluate(() => chrome.storage.sync.get(null))).toEqual({});
  await ctx.close();

  // full browser restart with the same profile
  ctx = await launch(dir);
  extId = new URL((await worker(ctx)).url()).host;
  const c = await ctx.newPage(); await c.goto(url());
  await expect(c.locator('body')).toHaveClass(/light/);
  await expect(c.locator('.top .seg button.on')).toHaveText('24h');
  await expect(c.locator('.bar .cell')).toHaveCount(10);
  await expect(c.locator(`.bar .cell[data-city="${ID.tokyo}"]`)).toHaveClass(/home/);
  await c.screenshot({ path: path.join(SHOTS, 'restart-light-24h.png') });

  // reset needs confirmation
  const d = await ctx.newPage(); await d.goto(url());
  await c.bringToFront();
  await c.getByRole('button', { name: 'Settings' }).click();
  const panel = c.getByRole('dialog', { name: 'Settings' });
  await panel.locator('[data-reset]').click();
  await expect(panel).toContainText('Reset everything?');
  await panel.getByRole('button', { name: 'Cancel' }).click();
  await expect(c.locator('.bar .cell')).toHaveCount(10); // cancelled: unchanged
  await panel.locator('[data-reset]').click();
  await panel.locator('[data-confirm-reset]').click();
  for (const p of [c, d]) {
    await expect(p.locator('body')).not.toHaveClass(/light/);
    await expect(p.locator('.bar .cell')).toHaveCount(11);
    await expect(p.locator(`.bar .cell[data-city="${ID.istanbul}"]`)).toHaveClass(/home/);
    await expect(p.locator('.top .seg button.on')).toHaveText('12h');
  }
  // settings panel controls also persist
  await panel.getByRole('button', { name: 'Light' }).click();
  await panel.getByRole('button', { name: '24h' }).click();
  await expect(d.locator('body')).toHaveClass(/light/);
  await expect(d.locator('.top .seg button.on')).toHaveText('24h');
  await ctx.close();
  void info;
});

test('live mode ticks each minute and refreshes when the tab becomes visible again', async ({ open, ctx }) => {
  const page = await open({ clock: '2026-10-07T04:52:40Z' });
  await expect(page.locator('.foot')).toContainText('Live · 2026-10-07 04:52Z');
  expect(await cellTime(page, ID.istanbul)).toBe('7:52 AM');
  expect(await cellDate(page, ID.istanbul)).toBe('Wed, Oct 7');
  await page.clock.runFor(21_000);
  await expect(page.locator('.foot')).toContainText('Live · 2026-10-07 04:53Z');
  expect(await cellTime(page, ID.istanbul)).toBe('7:53 AM');
  expect(await cellTime(page, ID.tokyo)).toBe('1:53 PM');
  await page.clock.runFor(60_000);
  await expect(page.locator('.foot')).toContainText('04:54Z');
  // Tab hidden while time jumps (timers frozen), then shown again → immediate refresh, no waiting for a tick.
  const other = await ctx.newPage(); await other.bringToFront();
  await page.clock.pauseAt(new Date('2026-10-07T09:30:10Z'));
  await page.bringToFront();
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('.foot')).toContainText('Live · 2026-10-07 09:30Z');
  expect(await cellTime(page, ID.istanbul)).toBe('12:30 PM');
});

for (const [w, h] of [[1280, 720], [1440, 900]] as const) {
  test(`layout ${w}px: ten cities + GMT, no horizontal scroll, readable cells, ruler ≤ 144px, 39 map labels never overlap`, async ({ open }) => {
    const page = await open({ width: w, height: h, clock: '2026-10-07T00:00:00Z' });
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => {
      const bar = document.querySelector('.bar')!.getBoundingClientRect();
      const cells = [...document.querySelectorAll('.bar .cell')].map(c => {
        const r = c.getBoundingClientRect();
        const clipped = [...c.querySelectorAll('.tm, .dt, .diff')].filter(e => e.scrollWidth > e.clientWidth + 0.5 || e.getBoundingClientRect().right > r.right + 0.5).map(e => e.className);
        return { left: r.left, right: r.right, top: r.top, w: r.width, clipped, title: c.getAttribute('title') };
      });
      const top = document.querySelector('.top')!;
      return { bar: { h: bar.height, bottom: bar.bottom }, cells, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight, vw: innerWidth, vh: innerHeight,
        topOverflow: top.scrollWidth > top.clientWidth, map: document.querySelector('.map')!.getBoundingClientRect().height,
        overlapping: (() => { const t = [...document.querySelectorAll('svg.world .city text')].map(e => ({ r: e.getBoundingClientRect(), s: e.parentElement!.dataset.city + ':' + e.textContent })); const hits: string[] = []; for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) { const a = t[i].r, b = t[j].r; if (t[i].s.split(':')[0] !== t[j].s.split(':')[0] && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 2 && b.top < a.bottom - 2) hits.push(t[i].s + ' × ' + t[j].s); } return hits; })() };
    });
    expect(m.docW).toBeLessThanOrEqual(m.vw);
    expect(m.docH).toBeLessThanOrEqual(m.vh);
    expect(m.cells.length).toBe(11);
    expect(m.bar.h).toBeLessThanOrEqual(144);
    expect(new Set(m.cells.map(c => Math.round(c.top))).size).toBe(1); // single row
    for (const c of m.cells) { expect(c.left).toBeGreaterThanOrEqual(0); expect(c.right).toBeLessThanOrEqual(m.vw + 0.5); expect(c.clipped, `${c.title}`).toEqual([]); }
    expect(m.cells.filter(c => c.title && c.title.includes(',')).length).toBe(10); // full names available as tooltips
    expect(m.topOverflow).toBe(false);
    expect(m.map).toBeGreaterThan(h * 0.6);
    expect(m.overlapping).toEqual([]);
    expect(await page.locator('svg.world .city text.name').count()).toBe(39); // 10 ruler + 29 always-labelled
    await page.screenshot({ path: path.join(SHOTS, `dark-live-${w}.png`) });
    await page.locator('[data-theme-toggle]').click();
    await expect(page.locator('body')).toHaveClass(/light/);
    await page.screenshot({ path: path.join(SHOTS, `light-live-${w}.png`) });
  });
}

test('compact fallback below 1100px keeps every saved city visible without sideways scrolling', async ({ open }) => {
  const page = await open({ width: 924, height: 540, clock: '2026-10-07T00:00:00Z' });
  const m = await page.evaluate(() => ({
    rows: new Set([...document.querySelectorAll('.bar .cell')].map(c => Math.round(c.getBoundingClientRect().top))).size,
    visible: [...document.querySelectorAll('.bar .cell')].filter(c => { const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight; }).length,
    barH: document.querySelector('.bar')!.getBoundingClientRect().height, docW: document.documentElement.scrollWidth, vw: innerWidth,
    note: getComputedStyle(document.querySelector('.compact-note')!).display,
  }));
  expect(m).toMatchObject({ rows: 2, visible: 11, note: 'inline' });
  expect(m.barH).toBeLessThanOrEqual(144);
  expect(m.docW).toBeLessThanOrEqual(m.vw);
  await page.screenshot({ path: path.join(SHOTS, 'dark-live-924-compact.png') });
  await page.setViewportSize({ width: 560, height: 700 });
  expect(await page.evaluate(() => [...document.querySelectorAll('.bar .cell')].filter(c => { const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5; }).length)).toBe(11);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('themes and reference states: tooltip, editor, planning (screenshots at the handoff size)', async ({ open }) => {
  const page = await open({ width: 1440, height: 820, clock: '2026-10-07T00:00:00Z' });
  const css = (sel: string, prop: string) => page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s)!).getPropertyValue(p), [sel, prop]);
  expect(await css('.top', 'background-color')).toBe('rgb(13, 19, 34)');
  expect(await css('.bar', 'background-color')).toBe('rgb(22, 30, 51)');
  expect(await css('.cell.home', 'box-shadow')).toContain('rgb(0, 229, 255)');
  expect(await css('.brand', 'font-family')).toContain('Inter');
  await expect(page.locator(`svg.world .city.home circle.dot`)).toHaveAttribute('fill', '#00e5ff');
  await expect(page.locator('.legend')).toContainText('not legal time zones');
  await expect(page.locator('.foot')).toContainText('not legal time-zone boundaries');
  await page.locator('svg.world .sunmark circle').hover(); // the large amber dot is the sun marker, not a city
  await expect(page.locator('.tip')).toContainText('Sun overhead');
  await expect(page.locator('.tip')).toContainText('Not a city');
  await expect(page.locator('.tip')).toContainText(/\d+\.\d°[NS] \d+\.\d°[EW]/);
  await page.locator(`svg.world .city[data-city="${ID.ny}"] circle.ring`).hover();
  await expect(page.locator('.tip')).toContainText('America/New_York');
  await expect(page.locator('.tip')).toContainText('UTC−4');
  await expect(page.locator('.tip')).toContainText('−7h · prev day');
  await expect(page.locator('.tip')).toContainText('Tue, Oct 6, 2026');
  await page.screenshot({ path: path.join(SHOTS, 'dark-tooltip-new-york.png') });
  await page.locator(`svg.world .city[data-city="${ID.ny}"] circle.ring`).click();
  await expect(page.locator('.editor')).toContainText('New York, USA');
  await page.locator('.editor').getByLabel('Date').fill('2026-10-07');
  await page.locator('.editor').getByLabel('Time').fill('5:30');
  await page.locator('.editor').getByRole('button', { name: 'PM', exact: true }).click();
  await page.screenshot({ path: path.join(SHOTS, 'dark-convert-editor.png') });
  await page.locator('.editor').getByLabel('Time').press('Enter');
  await expect(page.locator('.plan-strip')).toBeVisible();
  expect(await css('.plan-strip .k', 'color')).toBe('rgb(255, 176, 32)');
  await page.screenshot({ path: path.join(SHOTS, 'dark-planning-mode.png') });
  await page.locator('[data-theme-toggle]').click();
  expect(await css('.top', 'background-color')).toBe('rgb(247, 248, 251)');
  expect(await css('.bar', 'background-color')).toBe('rgb(255, 255, 255)');
  await expect(page.locator(`svg.world .city.home circle.dot`)).toHaveAttribute('fill', '#0084b3');
  await page.screenshot({ path: path.join(SHOTS, 'light-planning-mode.png') });
  for (const name of ['Add city', 'Manage', 'Settings']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, `light-panel-${name.toLowerCase().replace(' ', '-')}.png`) });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});
