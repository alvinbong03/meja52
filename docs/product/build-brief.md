# Digital Poker Chips — Build Brief

## Product objective

Create a free, installable web app for 2–15 people playing face-to-face with a physical deck. Each player uses a phone as a chip stack; the system applies poker rules, keeps every device consistent, survives disconnects, and produces an end-of-session settlement.

## Recommended starting point

Fork and rebrand [Piss Poker](https://github.com/KarthikSubramanian07/Piss-Poker) under its MIT licence. Preserve the licence and copyright notice. The existing architecture already covers the hardest parts: a server-authoritative rules engine, real-time rooms, side-pot calculation, reconnection, settlement, tests, and 10-seat UI.

Do not start from PocketPoker unless its owner adds a valid licence file. A README sentence saying “MIT” is not as reliable as a repository licence grant. Do not fork Live Poker Tracker or ZocketZero without written permission for the same reason.

## MVP acceptance criteria

### Joining and table management

- A host creates a table without an account.
- Up to 10 players join through QR code, short code, or link.
- Players can join, leave, sit out, reconnect, or transfer a seat.
- The host can represent a player without a phone.
- A shared tablet/laptop display shows public table state.

### Poker-chip behaviour

- Configurable starting stack, small blind, big blind, ante, and optional cash-value ratio.
- Fold, check, call, bet, raise, and all-in with legal-action validation.
- Dealer/button and blind rotation, including heads-up rules.
- Main pot and any number of side pots; folded contributions remain dead money.
- Split winners, tied pots, odd-chip rule, and automatic return of unmatched bets.
- Rebuy/top-up, sit-out, player removal, and an auditable action history.
- Undo with a clear confirmation and recovery history.

### “But more” features

- Minimal-transfer settlement at the end of a cash game.
- Tournament blind timer and blind schedule.
- Exportable session ledger and hand summaries.
- Optional haptics/sounds and a screen-wake mode.
- PWA installation and useful degraded/offline behaviour.
- Accessibility: keyboard operation, visible focus, reduced motion, high contrast, large touch targets, and screen-reader labels.

### Reliability and safety

- The server, not a phone, validates and commits chip movement.
- All actions are idempotent/versioned so double taps and stale clients cannot duplicate bets.
- State restores after refresh, lock-screen suspension, or brief network loss.
- Room state expires automatically and stores no unnecessary identity data.
- No payment processing and no claim that virtual chips have monetary value.

## Proposed technical shape

Retain the reference architecture initially:

- React + TypeScript + Vite PWA for phones and table display;
- a pure deterministic betting/settlement engine shared by client and server;
- WebSocket rooms backed by Cloudflare Durable Objects or an equivalent stateful service;
- random per-device secrets stored locally, with only hashed claims stored server-side;
- short-lived room state and no account database for MVP.

Avoid pure peer-to-peer state for the first owned version. P2P removes a central bill but makes discovery, host failure, reconnection, cheating resistance, and mobile browser suspension harder. A small authoritative room service is easier to reason about for 10 devices.

## First implementation sequence

1. Fork privately or into the intended organisation; preserve MIT notice.
2. Rename product, package, icons, metadata, and domains.
3. Reproduce the upstream passing type-check, unit tests, and build.
4. Remediate or formally risk-assess the four high-severity development/test dependency findings.
5. Add a scripted 15-player end-to-end scenario with reconnect, all-in, side pots, split pot, undo, and settlement.
6. Add privacy notice, retention statement, acceptable-use terms, and delete/expiry behaviour.
7. Add monitoring for room creation, WebSocket failures, rejected stale actions, and reconnect success—without storing player names longer than needed.
8. Run a real 15-phone play-money pilot on mixed iOS/Android devices and poor Wi-Fi.
9. Only then add tournament timers, export, themes, and other enhancements.

## Verification plan

Automated:

- unit tests for chip conservation after every legal action;
- property/fuzz tests over 2–15 players and mixed stack sizes;
- protocol validation and hostile/stale action tests;
- multi-browser end-to-end flows for a full hand, multi-way all-in, split pot, reconnect, seat takeover, and 15-player lobby;
- type-check, lint, build, dependency audit, and licence scan in CI.

Real devices:

- iPhone Safari and Android Chrome, including older/smaller phones;
- 15 simultaneous devices on one ordinary home router;
- phone lock/unlock, tab backgrounding, network switch, low battery, and host disconnection;
- portrait and landscape, 320 px width through tablet/desktop;
- keyboard-only use, VoiceOver/TalkBack smoke test, visible focus, contrast, reduced motion, and touch target size.

Game-rule scenarios:

- heads-up blinds;
- a short big blind;
- a one-unit increase above the current bet;
- repeated small raises that each reopen action;
- three or more side pots;
- folded dead money;
- tied pot with an odd chip;
- player leaves on their turn or during showdown;
- no chips created or lost across undo, rebuy, award, disconnect, or settlement.

## Go/no-go checklist

Go when:

- the licence is preserved and branding is replaced;
- dependency findings are resolved or documented;
- 15-device E2E and real-device tests pass;
- every chip movement is server-authoritative and logged;
- room expiry/privacy behaviour is documented;
- play-money scope is explicit.

No-go when:

- a client can directly set its stack;
- refresh/reconnect can duplicate or lose chips;
- complex side pots are not covered by tests;
- a real-money flow or payment feature is introduced without legal and operational review;
- deployment cost or quota behaviour can unexpectedly disable active games.
