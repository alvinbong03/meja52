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

### Per-recipient chip privacy and device preferences — 20 September 2026

- Replaced the shared authoritative WebSocket game payload with a per-recipient view. Other players' stack, buy-in and cumulative hand commitment are redacted before serialization; public current-street bets and a separately calculated pot total remain available to the table.
- Kept temporary least-privilege visibility for the host or Table Controller only while operating an unattended/manual seat or performing an active host correction.
- Redacted departed-player settlement values until the game ends and removed indirect private-value disclosure from public timeline wording.
- Persisted the Sound and Haptics setup choices per device and made audio unlock and vibration respect those choices.
- Preserved the approved layout; the Impeccable detector returned no findings. A live local-browser inspection confirmed the landing page still renders normally.

Verification:

```text
npm run typecheck                         PASS
npm test                                  PASS (66 unit, 53 Worker)
npm run test:e2e                          PASS (20 workflows)
npm run build                             PASS
npm audit --omit=dev                      PASS (0 vulnerabilities)
npx impeccable detect --target Seats.tsx PASS (0 findings)
git diff --check                          PASS
```

Cloudflare authentication, migration and deployment were deliberately not attempted at the owner's request.

### Single-Worker migration and first live deployment — 20 September 2026

- Replaced the inherited Pages + forwarding Function + API Worker split with one `meja52` Worker serving Vite static assets, SPA routes, `/api/*`, WebSocket upgrades and the SQLite-backed `Room` Durable Object.
- Removed the obsolete Pages Function and service-binding configuration, enabled the `workers.dev` trigger, and updated canonical, Open Graph, sitemap and deployment documentation to the live origin.
- Kept the static-asset security policy through `_headers`; the live homepage returns the expected CSP, HSTS, no-sniff, referrer, opener and permissions headers.
- Added `npm run smoke:live` to create a disposable room, connect two independent devices over live WebSockets, start a hand and verify each device sees its own balance while the other balance remains private.

Deployment:

```text
URL                                      https://meja52.meja52.workers.dev
Cloudflare Worker                        meja52
Version                                  ea997376-75ec-4976-8cf7-d53e23066876
Static assets                            15
Worker startup                           1 ms
Bindings                                 Room Durable Object + 3 rate limiters
```

Verification:

```text
npm run typecheck                        PASS
npm test                                 PASS (66 unit, 53 Worker)
npm run test:e2e                         PASS (20 workflows)
npm run deploy:dry-run                   PASS
Live /api/health                         PASS
Live homepage and /create SPA route      PASS (200)
Live unknown-room behavior               PASS (404)
Live foreign-origin rejection            PASS (403)
Live security headers                    PASS
Live two-device WebSocket smoke          PASS
Live per-recipient balance privacy       PASS
```

The deployment is suitable for continued alpha testing. The approved host-transfer recovery, seating-lobby, tactile chip interaction, accessibility polish and long real-device soak gates remain outstanding before declaring public Release 1 complete.

### Accepted host transfer and disconnect recovery — 20 September 2026

- Replaced immediate host reassignment with a named, 30-second request that keeps the current host in authority until the recipient accepts. The host can cancel; the recipient can decline; only acceptance is written to the public table history.
- Added an optional backup host, independent Table Controller authority, a 60-second disconnect grace period, deterministic longest-connected fallback nomination and explicit recovery acceptance. No player has a general-purpose takeover action.
- A reconnecting original host cancels recovery before acceptance. Unavailable, declined or expired nominees advance to the next eligible active player; with nobody eligible, the room and current hand remain preserved while host-only decisions wait.
- Added the four approved Impeccable states: pending transfer, recipient request, compact reconnecting status band and nominated recovery request. The controls use the existing Batik Indigo, Denim Lift, Batik Ivory and restrained Hibiscus system.
- Marked the owner-approved comp and implementation brief as approved.

Verification:

```text
npm run typecheck                         PASS
npm test                                  PASS (66 unit, 56 Worker)
npm run test:e2e                          PASS (20 existing workflows)
planned transfer browser workflow         PASS
npm run build                             PASS
Impeccable detector                       PASS (0 findings)
git diff --check                          PASS
```

Deployed to `https://meja52.meja52.workers.dev` as Worker version `0e29289a-5071-4447-b3cb-99b13e2b0e64`. The post-deploy two-device WebSocket smoke test passed with private balances and public pot state intact.

### Approved physical seating lobby — 20 September 2026

- Replaced the generic lobby ordering controls with the approved physical clockwise table map for 2–15 players.
- Added desktop drag-and-drop plus a keyboard/touch-friendly tap-player, tap-destination alternative without changing the visual hierarchy.
- Added player-facing left/right neighbour confirmation, an issue signal to the host, advisory confirmation progress and selective invalidation only when a player's neighbours change.
- Added proposed first-dealer and Table Controller selection. The chosen dealer now sets the button and blind positions for hand one.
- Added the explicit **Lock seats & start** action; the host may deliberately start before every advisory confirmation arrives.
- Preserved the approved Batik Indigo, Denim Lift, Batik Ivory and Hibiscus palette and corrected host-transfer candidate filtering so private opponent balances are never used as UI eligibility data.

Verification:

```text
npm run typecheck                         PASS
npm test                                  PASS (67 unit, 58 Worker)
npm run test:e2e                          PASS (22 workflows)
npm run build                             PASS
npm run deploy:dry-run                    PASS
Impeccable detector                       PASS (0 findings)
git diff --check                          PASS
```

Browser coverage includes two independent player devices, neighbour confirmation and issue reporting, selected-dealer blind order, host/controller selection, full gameplay and settlement regressions, no horizontal overflow from 320 px to desktop, and a 15-player phone lobby plus scrollable 15-player landscape bet rail.

Deployed to `https://meja52.meja52.workers.dev` as Worker version `dc32c77a-a246-4db0-b275-0948f06f0b02`. The live two-device WebSocket smoke test passed after updating the smoke client to exercise the host's explicit advisory-confirmation override; private balances and public pot state remained correct.

### Foldable and unusual mobile-screen adaptation — 20 September 2026

- Kept all coarse-pointer gameplay in the approved full-width phone composition, so unfolded touch viewports no longer inherit the centred 680 px portrait column or the 960 px desktop side-control layout.
- Made touch landscape use the approved table-edge composition regardless of foldable inner-screen height. The current-bet rail remains across the top and the complete private action deck remains across the bottom.
- Added independent left and right safe-area handling alongside the existing top and bottom insets without changing poker behaviour, privacy, control order or desktop layout.
- Recorded the durable capability-based approach and official Apple, Samsung, MDN and web.dev references in `docs/design/Foldable and Unusual Mobile Adaptation.md`. Device posture and viewport-segment APIs remain optional enhancements rather than functional dependencies.
- Visually inspected the unfolded portrait and landscape states in one bounded batch against the Apple, Porsche, Bang & Olufsen and Linear principles. No new component language or layout hierarchy was introduced.

Verification:

```text
npm run typecheck                         PASS
npm test                                  PASS (67 unit, 58 Worker)
npm run test:e2e                          PASS (23 workflows)
npm run build                             PASS
Impeccable detector                       PASS (0 findings)
git diff --check                          PASS
```

The new browser workflow covers iPhone Duo cover and inner portrait/landscape reference viewports plus representative Galaxy Z Fold8 inner portrait/landscape viewports. It asserts full-width composition, visible controls, landscape bet rail, bottom Table Controls access and no page-level horizontal overflow. Existing standard-phone, 15-player and fine-pointer desktop workflows remain green. Real-device Safari and Samsung Chrome checks remain part of the final release gate.

Deployed to `https://meja52.meja52.workers.dev` as Worker version `0f10cbef-4710-4760-a2ef-e57ae89a1408`. The post-deploy two-device WebSocket smoke test passed with private balances and public pot state intact.

### Approved tactile chip interaction — 20 September 2026

- Implemented the approved fixed RM1, RM5, RM10, RM20 and RM50 rack without changing the existing live turn/call/Pot/Balance header or public current-bet rail.
- Added tap and 350 ms hold-to-repeat staging, larger staged chips, a betting-line instruction that becomes the exact release amount, whole-wager upward drag placement, one-chip downward return, Clear and labelled Place alternatives.
- Added a compact pencil-over-chip Make Change control with denomination selection, equal-value preview, Cancel and Break Chip confirmation. Automatic exact wagers use the same deterministic change chain and privately explain when change was made.
- Added per-player private denomination inventories in the Durable Object. The Worker validates their total against the numeric stack, preserves them across reconnects, awards and rebuys, includes them in undo snapshots, and exposes them only to the player or an authorised controller currently acting for that seat.
- Removed centre stripes from chip faces so printed values remain legible; retained the approved restrained dimensional material and brand colours.
- Visually checked the untouched live header plus idle, staged and Make Change states in landscape against the Apple, Porsche, Bang & Olufsen and Linear reference principles.

Verification:

```text
npm run typecheck                         PASS
npm test                                  PASS (69 unit, 58 Worker)
npm run test:e2e                          PASS (24 workflows)
npm run build                             PASS
manual landscape idle/staged/change       PASS
git diff --check                          PASS
```

Deployed to `https://meja52.meja52.workers.dev` as Worker version `4e8d31c4-453f-4e1b-896b-4483693a07d1`. The post-deploy two-device WebSocket smoke test passed with private balances, public pot state and the new private chip-inventory payload intact.

### Landscape lobby, direct seat movement and balanced starting racks — 20 September 2026

- Separated lobby landscape behaviour from the gameplay-only landscape rule that previously hid the lobby’s header and seating surface.
- Added a compact two-column phone-landscape lobby: the physical table map remains primary, role controls remain visible beside it, and **Lock seats & start** remains reachable without changing the portrait hierarchy.
- Replaced insertion-order seating with direct seat swapping. The host can drag one name onto another seat, or tap a name and then tap the intended new seat; both methods swap the two occupants.
- Reworded the central seating guidance to describe the physical result rather than “come before” ordering.
- Changed deterministic chip composition to preserve useful small denominations. RM50 now begins as exactly `10 × RM1`, `4 × RM5`, and `2 × RM10`; larger balances preserve that base, then add RM20 and RM50 chips.
- Versioned the private inventory composition so existing alpha rooms adopt the new balanced rack once while keeping the numeric balance authoritative.

Verification:

```text
npm run typecheck                         PASS
npm test                                  PASS (70 unit, 58 Worker)
npm run test:e2e                          PASS (25 workflows)
npm run build                             PASS
landscape lobby tap/drag workflow         PASS
Impeccable detector                       PASS (0 findings)
git diff --check                          PASS
```

Deployed to `https://meja52.meja52.workers.dev` as Worker version `18959d91-bed8-40c5-b50f-fb79a2096056`. The post-deploy two-device WebSocket smoke test passed with private balances and public pot state intact.

### Custom player-composed chip change — 20 September 2026

- Replaced the fixed Make Change preview with a focused two-step composer: select one owned source chip, then build the replacement from smaller denominations.
- Kept the approved tactile rack language. Players can tap replacement chips or type exact quantities; the running total shows progress and **Break chip** remains disabled until the values match exactly.
- Added authoritative Worker validation for source ownership, exact value, positive unique counts and smaller replacement denominations. Numeric balance never changes and private inventory remains private.
- Preserved the automatic deterministic change chain used by exact Calls and wagers; only the manual Make Change workflow became custom.
- Checked the interaction against the approved Apple, Porsche, Bang & Olufsen and Linear principles: one contained surface, clear sequence, familiar chip objects, restrained hierarchy and no additional card stack or decorative treatment.

Verification:

```text
npm run typecheck                         PASS
npm run test:unit                         PASS (71 tests)
npm run test:worker                       PASS (58 tests)
npm run test:e2e                          PASS (25 workflows)
npm run build                             PASS
custom RM50 → 20×RM1 + 6×RM5 workflow    PASS
phone-landscape composer overflow check  PASS
Impeccable detector                       PASS (0 findings)
git diff --check                          PASS
```

Deployed to `https://meja52.meja52.workers.dev` as Worker version `a44fee14-0110-4117-a24e-1372378cdcfc`. The post-deploy two-device WebSocket smoke test passed with private balances and public pot state intact.

### Raise-builder hierarchy divider — 20 September 2026

- Added one short centred hairline between the `Raise to / Any amount above…` requirement and the `Tap chips or choose a shortcut` instruction.
- Kept it deliberately shorter than the control deck so it guides reading order without framing the action area or adding another container.
- The divider follows the heading out of view after chips are staged, preserving the approved compact staged-wager state.

Verification:

```text
npm run typecheck                         PASS
focused raise-builder browser workflow   PASS
npm run build                             PASS
Impeccable layout detector                PASS (0 findings)
git diff --check                          PASS
```

Deployed to `https://meja52.meja52.workers.dev` as Worker version `26c782fd-811e-4f41-966c-ea9d3b179583`. The post-deploy two-device WebSocket smoke test passed with private balances and public pot state intact.

### Folded-player state in the current-bet rail — 20 September 2026

- Added an explicit **Folded** label to a folded player’s compact landscape current-bet cell.
- Dimmed the folded player’s name and current-street amount while keeping the numeric contribution visible and the status at normal emphasis.
- Preserved the existing seat-list and shared-display behaviour, which already dims folded players and identifies their state.
- Used text plus contrast rather than colour alone, and kept each 120 px player cell unchanged so 10–15-player scrolling behaviour is unaffected.

Verification:

```text
npm run typecheck                         PASS
three-player fold browser workflow        PASS
npm run build                             PASS
Impeccable layout detector                PASS (0 findings)
git diff --check                          PASS
```

Deployed to `https://meja52.meja52.workers.dev` as Worker version `916bd8d1-fd36-4a73-897f-d861fae8ff66`. The post-deploy two-device WebSocket smoke test passed with private balances and public pot state intact.

### Visible positions and verified blind posting — 20 September 2026

- Audited the server-authoritative blind engine and confirmed that each hand automatically deducts the configured small and big blind, records those amounts as current-street bets and advances action from the correct seat.
- Added compact `D`, `SB` and `BB` position marks to every player in the landscape current-bet rail. Heads-up correctly shows `D` and `SB` together on the dealer.
- Added the previously missing `SB` and `BB` marks to the shared table display; the standard player list already showed all three positions.
- Verified the player-facing rule flow: with 5/10 blinds the heads-up small blind begins at 995 and can Call 5, raise or fold; the big blind begins at 990 and, after the call, can Check or Raise without paying the blind again.

Verification:

```text
npm run typecheck                         PASS
npm run test:unit                         PASS (71 tests)
npm run test:worker                       PASS (58 tests)
blind-position browser workflow           PASS
npm run build                             PASS
Impeccable layout detector                PASS (0 findings)
git diff --check                          PASS
```

Deployed to `https://meja52.meja52.workers.dev` as Worker version `ace3043a-cd3e-4981-a559-dedb6a1342b1`. The post-deploy two-device WebSocket smoke test passed with private balances and public pot state intact.

### Coherent dealer and blind markers — 20 September 2026

- Unified `D`, `SB` and `BB` as equal-sized outlined circular markers beside each player’s name.
- Moved the standard player list’s blind markers from its secondary status line into the same position as the Dealer marker.
- Preserved simultaneous heads-up `D` and `SB` markers and kept non-position statuses such as Folded or Away on the secondary line.

Verification:

```text
npm run typecheck                         PASS
blind-position browser workflow           PASS
17×17 marker-coherence assertion          PASS
npm run build                             PASS
Impeccable layout detector                PASS (0 findings)
git diff --check                          PASS
```

Deployed to `https://meja52.meja52.workers.dev` as Worker version `1f3c4926-75b8-4bb7-8d58-8d7b7df26b2f`. The post-deploy two-device WebSocket smoke test passed with private balances and public pot state intact.

### Release 1 automated certification — 20 September 2026

- Re-ran the complete correctness, privacy, responsive, accessibility, build and Cloudflare packaging gates against the current Release 1 branch.
- Isolated the unknown-room browser test from the cumulative local lookup-rate bucket; the production limiter remained unchanged.
- Removed all four development/test dependency advisories with a bounded `sharp@0.35.4` override and compatible Wrangler/types patch updates. No forced audit rewrite was used.
- Replaced stale release status in the README, gap map and earlier audit pointer. The current decision and physical-device checklist are in `docs/product/release-1-certification-2026-09-20.md`.

Verification:

```text
npm run typecheck                         PASS
npm run test:unit                         PASS (71 tests; 1,500 fuzz games)
FUZZ_GAMES=25000 npm run test:unit        PASS (71 tests; 25,000 fuzz games)
npm run test:worker                       PASS (58 tests)
npm run test:e2e                          PASS (26 workflows)
npm run build                             PASS (367.34 kB JS / 108.00 kB gzip)
npm run deploy:dry-run                    PASS (Wrangler 4.135.0)
npm audit                                 PASS (0 vulnerabilities)
Impeccable detector                       PASS (0 findings)
live security-header inspection           PASS
git diff --check                          PASS
```

Automated Release 1 certification passes. Physical iPhone/Android play, a longer home-network soak, rollback rehearsal and explicit owner approval to merge/tag remain open.

Deployed the certified dependency/toolchain state to `https://meja52.meja52.workers.dev` as Worker version `f9c79791-6b0d-4611-a7b7-971b711ac644`. The post-deploy two-device WebSocket smoke test and API security-header check passed.

### Persistent landscape street indicator — 20 September 2026

- Added a fixed Hand/Street marker to the left of the landscape current-bet rail, showing **Preflop**, **Flop**, **Turn**, **River** or **Showdown** to every player.
- Kept the 120 px player-bet cells independently scrollable for 10–15 players, so the street remains visible while reviewing the far end of the table.
- Preserved the approved hierarchy: the rail contains public hand context and current-street bets, while Pot and Balance remain in the private action header.
- Used one quiet divider and the existing MEJA52 type and colour tokens; no new card, pill or decorative surface was introduced.

Verification:

```text
npm run typecheck                         PASS
street progression browser workflow       PASS (Preflop → Showdown)
15-player fixed-marker browser check      PASS
npm run test:e2e                          PASS (26 workflows)
npm run build                             PASS
Impeccable detector                       PASS (0 findings)
git diff --check                          PASS
```

Deployed to `https://meja52.meja52.workers.dev` as Worker version `77dbeb41-2dfb-416c-89fe-c3458bcb4f88`. The post-deploy two-device WebSocket smoke test passed with private balances and public pot state intact.

### Shared landscape dealing cues — 20 September 2026

- Added **Deal the flop**, **Deal the turn** and **Deal the river** to the fixed landscape Hand/Street marker at the start of each new street.
- The cue is shared across every player device, uses the same server-authoritative fresh-street condition and wording as portrait and the table display, and disappears after the first action while the street name remains.
- Kept the instruction inside the existing fixed marker rather than adding another banner, preserving gameplay height and independent scrolling for the 10–15 player bet rail.

Verification:

```text
npm run typecheck                         PASS
cross-device Flop cue                     PASS
Flop → Turn → River cue sequence          PASS
focused gameplay/15-player workflows      PASS (4/4)
complete browser workflow set             PASS (25 direct + 1 isolated retry)
npm run build                             PASS
Impeccable detector                       PASS (0 findings)
git diff --check                          PASS
```

The first complete-suite run timed out while creating the overflow test's setup room; its isolated rerun passed in 10.8 seconds. No assertion, rendering or gameplay failure occurred.
