# Digital Poker Chips — Verification Log

> Scope note, 19 September 2026: the approved product target is now 15 active players. The historical checks below validated upstream and competitor behaviour at no more than ten players; they do not validate the new 15-player requirement.

Date: 19 September 2026

## Live browser checks

### ChipStack

- Opened the official web app successfully.
- Confirmed the page claims no login, no premium features, no ads, and no hidden cost.
- Confirmed official support states a 10-player maximum.
- Independent agent created a room and observed a room code/QR, 1,000-chip stack, action controls, history, and leaderboard.
- Confirmed multiplayer requires internet and rooms expire after 24 hours with nobody connected.
- Confirmed terms prohibit real-money gambling and permit discontinuation without notice.

Not verified: 10 concurrent physical devices, side-pot correctness, load limits, uptime, or independent privacy/security audit.

### Piss Poker

- Created a live room without an account.
- Joined with a temporary display name.
- Observed `Seats 1/10`, QR/link invitation, blind and stack settings, and live connection status.
- Confirmed an actual MIT `LICENSE` file in the repository.

Temporary clone verification on Node `v24.14.0` and npm `11.9.0`:

```text
npm ci --ignore-scripts     PASS (127 packages installed)
npm run typecheck           PASS
npm run test:unit           PASS (4 files, 47 tests)
npm run build               PASS (Vite production build)
npm audit                   FAIL/RISK: 4 high-severity findings
```

The audit findings are in the Cloudflare development/test toolchain:

- `@cloudflare/vitest-pool-workers`
- `wrangler`
- `miniflare`
- `sharp` below 0.35.4 via the above chain

Not verified: worker integration tests, Playwright suite, upstream 25,000-game fuzz claim, 10 real phones, production security, or Cloudflare quota/cost behaviour.

### Chipless

- Opened the live PWA.
- Created a room with a temporary name and $50 starting stack.
- Observed a join code, QR code, blinds, and `1 / 10` player capacity.
- Confirmed the official FAQ says completely free, no download, and no sign-up.

Not verified: a second device, 10 concurrent devices, side-pot edge cases, source code, or long-term availability.

### PokerChip.live

- Official live page says core room/chip/settlement features are free.
- Page also advertises Pro for advanced statistics, export, and ad removal.
- Official FAQ caps rooms at eight players.

Result: excluded.

### PocketPoker

- Opened the hosted PWA and completed name onboarding.
- Host setup explicitly showed `Max players (2–8)`.
- Repository API reported no detected licence and the raw `LICENSE` URL returned 404, despite README text saying MIT.

Result: excluded as an immediate 10-player or safely reusable base.

### vChips

- Confirmed no-sign-up, multi-phone concept, undo/redo, side pots, minimum raises, multi-way splits, and pass-and-play mode.
- Automated table creation did not finish because the site uses Cloudflare Turnstile/anti-bot protection.
- No primary-source player cap or unambiguous “completely free” statement was found.

Result: promising but insufficiently verified.

## Independent validation

A separate agent independently researched the market, tested ChipStack, checked official pricing/capacity/terms, and reviewed licensed and unlicensed repositories. Its conclusion matched the main recommendation to try ChipStack first. It also found and documented the 2–9 cap in Stackd, the eight-player and licence problems in PocketPoker, and the no-licence issue in Live Poker Tracker.

## Workspace impact

Only this `/Users/alvin/Documents/Second Brain/20 Work/Poker Chips/` research folder was created. No Pemberton Academy source, backend, database, deployment, or production configuration was intentionally changed.

## MEJA52 implementation verification — 20 September 2026

### Corrections and recovery workflow

- Host-only Undo now requires an explicit review and supports either returning the turn or entering one corrected action.
- Pause freezes legal actions for every client while leaving the table readable.
- Void requires a reason and public preview, shows the amount being returned, and restores the pre-hand stacks and contributions only after host confirmation.
- Reconnect immediately replaces private controls with a frozen recovery panel, preserves the visible table, identifies the last confirmed event, and offers an explicit retry.
- The approved table layout, Indigo waiting state, Hibiscus active-turn state, and private dock treatment were retained.

Verification from the repository root:

```text
npm run typecheck    PASS
npm test             PASS (55 unit tests, 43 Worker integration tests)
npm run build        PASS
npm run test:e2e     PASS (18 browser workflows)
```

Browser coverage included the full phone workflow, governed undo, pause/void confirmation, connection loss and recovery, phone landscape visibility, 320×568 through desktop overflow checks, and a 15-player phone lobby. No browser page errors were reported by the exercised workflows.

### Current-round bet visibility refinement

- Every player row now shows the current-street bet as a number throughout a live hand; zero is displayed as `0` instead of an ambiguous blank.
- The compact phone-landscape rail always includes every active player and their current-street bet.
- Private balances and total hand contributions remain hidden from other players.

Type checking, all 55 unit tests, all 43 Worker integration tests, the production build, and the focused portrait/landscape Playwright workflow passed.

### Wide phone-landscape breakpoint correction

- Corrected the collision where a wide emulated phone could activate both the compact landscape layout and desktop side-column layout.
- At phone-height landscape viewports, the current-bet rail stays across the top and the private action surface now fills the full width beneath it.
- Added a 1024×500 regression check confirming the dock begins at the left edge, spans the viewport, and keeps Table Controls visible.

Type checking, the production build, and the focused landscape Playwright workflow passed.

### Dedicated landscape bet rail

- Removed Pot and helper copy from the top landscape rail; Pot remains beside Balance in the private action header.
- The rail now contains only player names and current-street bets, with a 120 px minimum cell and independent horizontal scrolling.
- Enlarged the landscape chip rack and staged-chip visuals while preserving the approved controls and table hierarchy.
- A 15-player browser regression confirms all players remain present, cell width never compresses below 120 px, and the rail scrolls instead of overflowing the page.

Type checking, the production build, and focused 3-player and 15-player landscape browser workflows passed.

### Enlarged staged chips

- Enlarged chips displayed after selection, including their landscape presentation, without moving the approved Clear/status/Place controls.
- A 568×320 browser regression confirms staged chips render at least 78 px wide without introducing page-level horizontal overflow.

Type checking, the production build, and the focused phone-landscape workflow passed.

### Physical multiple all-in runouts

- Added the approved host-only runout selection with `1×`–`4×` choices, physical deck/burn-card capacity limits, and verbal-agreement confirmation for multiple boards.
- Main and side pots are divided into exact board portions; indivisible remainders go to earlier runouts and existing clockwise odd-chip payout rules still apply within each portion.
- The Table Controller—not necessarily the host—is guided through each named physical runout and awards only that board before the next begins.
- Runout choice, dealing completion and awards remain visible in public table state and audit history.

Verification passed: 56 unit tests, 44 Worker integration tests, production build, and all 18 Playwright browser workflows. Coverage includes two physical runouts with a main pot, side pot, different eligibility, transferred Table Controller and exact final balances.

### Award preview, dispute and governed table override

- Winner selection now creates a public award preview; no stack changes until the Table Controller confirms it.
- Any seated player can dispute the preview before confirmation. The host or Table Controller can return to normal eligible-winner selection.
- A disputed result can instead use an explicitly labelled **Table override — not rules-validated** distribution, including otherwise ineligible or folded players.
- Overrides must assign exactly the selected pot total, preserve the audit history, and receive approval from the Table Controller plus one other currently connected player before the host can confirm.
- The same review gate applies to ordinary awards, ties, side pots and each physical runout.

Verification passed: 57 unit tests, 45 Worker integration tests, production build, and 19 Playwright browser workflows. Browser coverage includes a three-device dispute where a folded player receives a conserved table override only after the second-player approval gate.

### Governed cash settlement

- Replaced the provisional ended-game ledger with the approved three-state portrait experience: personal result review, minimum transfers, and final record.
- Settlement preserves structured initial entries, approved rebuys and host stack adjustments; legacy rooms fall back to the authoritative total entered.
- Players can confirm their result or report a reasoned issue, then later resolve it by confirming the corrected result.
- Only the debtor can mark their external transfer settled or undo that acknowledgement before finalisation.
- The host explicitly finalises the record. A record with an unresolved issue requires a separate warning confirmation and retains a permanent issue marker; departed players never block closure.
- MEJA52 does not move or verify money, and the interface states this directly.

Verification passed: 57 unit tests, 47 Worker integration tests, production build, and 19 Playwright browser workflows. The settlement browser workflow covers two devices, an issue report and resolution, payer-only acknowledgement, host finalisation, a 320×568 viewport and 200% root text without horizontal overflow.

### Private history, export and 30-day retention

- Finalising settlement now creates a separate 256-bit private record capability; only its room-salted SHA-256 hash is stored, and neither the capability nor any device token appears in room state or the returned record.
- The compact record includes final player results, transfer acknowledgements, issue reviews and the meaningful session timeline while excluding connection state and other live-room internals.
- The approved portrait surfaces provide a final summary, filtered timeline, screenshot-ready PNG, ledger CSV, full JSON, and copyable private link.
- Final records expire 30 days after finalisation rather than extending on access. A host can delete one sooner only from the original host device and only after typing the room code; a holder of the private link alone cannot delete it.
- API responses carry `no-store`, `no-referrer` and `noindex, nofollow` controls, and the application sets a no-referrer document policy.

Verification passed: 57 unit tests, 48 Worker integration tests, production build, and all 19 Playwright browser workflows. The settlement browser workflow now also opens the private record, checks the timeline, downloads CSV, verifies the disabled destructive action before confirmation, and deletes the record. Manual browser inspection covered the summary, history, room-data and deletion views at a 515×779 phone viewport; the accessible filter label remains available to assistive technology without disturbing layout, and all primary/destructive actions use the approved Indigo/Ivory/Hibiscus hierarchy.

### Release 1 readiness audit

The diagnostic release audit is recorded in `docs/product/release-1-readiness-audit.md`. The implementation scored 17/20 and passed all reliability/build gates, including 25,000 fuzz games, 48 Worker tests, 19 browser workflows, Pages Function compilation and an API Worker deployment dry-run. Publication remained gated on three P1 corrections: keeping the private record capability out of logged API URLs, neutralising spreadsheet formulas in CSV exports, and naming the Sound/Haptics switches for assistive technology. No product behaviour was changed during that diagnostic audit.

### Independent security hardening and full-product review — 20 September 2026

Two independent reviewers audited the current Release 1 implementation. The security reviewer found no remaining P0/P1 issue after the hardening changes; the product reviewer found six approved workflows or privacy guarantees that still block a public Release 1. The complete decision and implementation order are recorded in `docs/product/independent-release-review-2026-09-20.md`.

This hardening pass moved private-record capabilities out of server-visible URLs, added record indexing/referrer controls, neutralised CSV formula input, named the setup switches, closed seat-claim and proxy-action authorization gaps, removed names from anonymous room lookup, added bounded pre-parse request handling, added lookup/connection rate limits and an unaffiliated-socket cap, and broadened secret-file ignores. The approved visual layout did not change.

Verification:

```text
npm run typecheck                         PASS
npm test                                  PASS (64 unit, 51 Worker)
npm run test:e2e                          PASS (20 workflows)
npm run build                             PASS
wrangler deploy --dry-run                 PASS
wrangler pages functions build            PASS
npm audit --omit=dev                      PASS (0 vulnerabilities)
npm audit                                 RISK (4 high, development/test only)
git diff --check                          PASS
```

Wrangler authentication is not configured, so no live Cloudflare resource was created and no production smoke test was run.
