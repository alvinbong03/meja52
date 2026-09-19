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
