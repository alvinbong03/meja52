# Digital Poker Chips — Market Research

Research date: 19 September 2026
Original research target: up to 10 friends sitting together, using a physical deck while phones replace physical chips.
Approved product target from 19 September 2026: up to 15 players; the ten-player limits recorded below are therefore competitor/upstream constraints rather than the new product limit.

## Requirements used

The ideal product should:

1. cost every participant £0, without a player-count paywall;
2. allow 10 players;
3. retain the in-person physical-card experience;
4. give each person a private, synchronised stack on their phone;
5. support blinds, check/call/bet/raise/fold/all-in, pots and side pots, split winners, rebuys, undo, cash-out or settlement, and reconnection;
6. require no account and work on iOS and Android browsers;
7. have clear source licensing if we may build on it.

“Free chips” inside a casino app is not the same as a completely free chip-replacement tool. Source code visible on GitHub is also not automatically open source: an explicit licence is required.

## Recommended options

| Option | Cost and access | 10 players | Physical cards | Source/licence | Assessment |
|---|---|---:|---:|---|---|
| [ChipStack](https://poker.beavergrow.com/) | Officially free forever; no ads, premium tier, account, or card | Yes, official support page | Yes | Closed | Best zero-setup trial |
| [Piss Poker](https://piss-poker.pages.dev/) | Free hosted demo; self-hostable | Yes, verified live as `Seats 1/10` | Yes | MIT | Best code foundation; rebrand and remediate dependencies |
| [Chipless](https://playchipless.com/) | Officially completely free; no sign-up/download | Yes, verified live as `1/10` | Yes | Closed | Excellent simple fallback; newer and less technically transparent |
| [Chips of Fury — Chips Only](https://chipsoffury.com/virtual-poker-chips/) | This mode is free and ad-free, but the wider app has paid plans/IAP | Likely, but current official feature page did not clearly state the cap | Yes | Closed | More mature fallback, but fails the strict “entire app is free” test |
| [Poker Now](https://www.pokernow.com/) | Officially free, no IAP/account/download | Yes | No; it digitises the cards and table too | Closed | Good online poker room, wrong product shape |

### 1. ChipStack — best to try now

The [official homepage](https://poker.beavergrow.com/) says there are no premium features, ads, or hidden costs. The [support page](https://poker.beavergrow.com/support) explicitly states up to 10 players and explains that real-time sync needs an internet connection; basic functions can work offline after first load.

The live interface and public feature list include room-code/QR joining, live stacks, bet, fold, check, award/take pot, donate, rebuy, undo, action history, leaderboard, statistics, PWA installation, session persistence, and six themes.

Risks and gaps:

- closed-source and dependent on one hosted service;
- [terms](https://poker.beavergrow.com/terms-of-service) prohibit real-money gambling and allow suspension or discontinuation without notice;
- [privacy policy](https://poker.beavergrow.com/privacy-policy) describes device/browser data, anonymous analytics, and temporary server-side game state;
- no primary-source evidence found for mathematically correct multi-way side pots or minimum-raise edge cases;
- the “10k+ games” claim is self-reported;
- no 10-device stress test was performed.

Verdict: use it for a play-money dry run. For complex all-in games, manually cross-check the first side pot or choose the open-source rules-engine option below.

### 2. Piss Poker — best build-on foundation

The [repository](https://github.com/KarthikSubramanian07/Piss-Poker) has an actual MIT licence and was pushed on 18 September 2026. The live app created a room without an account and displayed 10 seats. The project provides:

- server-authoritative betting actions rather than trusting a client to move chips;
- blinds, turn order, legal minimum raises, short all-ins, layered side pots, uncalled-chip returns, split pots, and odd-chip allocation;
- rebuys, net settlement, 30-state undo history, reconnects, seat transfer, non-phone seats, a shared display, and 12-hour room expiry;
- unit, worker integration, fuzz, and Playwright end-to-end tests;
- a conventional `npm install` / `npm run dev` workflow.

Independent local verification passed type-checking, 47 unit tests, and a production build. `npm audit` reported four high-severity findings in the Cloudflare development/test chain (`@cloudflare/vitest-pool-workers`, `wrangler`, `miniflare`, and `sharp`). They are not evidence of an exploited production app, but they must be remediated or risk-accepted before adoption.

Verdict: fork, rename, audit, and deploy if this becomes a maintained product. It already meets the 10-person physical-card requirement more closely than the other licensed repositories found.

### 3. Chipless — simplest closed-source alternative

The [official FAQ](https://playchipless.com/faq) calls the app completely free, web-based, and account-free. A live room was created successfully and showed `1 / 10`. It supports real cards, synchronised stacks, blinds, bets, host controls, payouts, and settlement.

Risks: closed source, recent service, no published technical assurance for edge-case betting rules, and long-term pricing/availability can change.

### 4. Chips of Fury — mature fallback, not strictly all-free

The official [Chips Only Mode page](https://chipsoffury.com/virtual-poker-chips/) says this specific mode is free, ad-free, and account-free, with guided betting, blind structures, side pots, splits, rebuys, statistics, cash-out, and a freestyle mode for other card games. It needs internet. The surrounding product and store listings contain optional paid subscriptions/IAP, so it does not satisfy the strict interpretation that the whole app must be completely free.

## Open-source alternatives considered

| Repository | Licence | Fit | Why it is not the primary foundation |
|---|---|---|---|
| [Piss Poker](https://github.com/KarthikSubramanian07/Piss-Poker) | MIT file present | Exact physical-card, multi-phone, 10-seat fit | Recommended, but very new, zero stars/forks at research time, awkward name, and four high dev-tool audit findings |
| [Stackd](https://github.com/daksh-mor/Stackd) | MIT file present, but copyright provenance should be cleaned up | Offline central Android phone; rules/side pots/undo/rebuy/settlement | Explicitly 2–9 players and no published release; must build/sideload |
| [Offline Poker Chip Table](https://github.com/Amit-singh3009/offline-Poker-if-you-don-t-have-chips) | Apache-2.0 file present | 2–13 players, offline, no build step | One shared browser/device rather than synchronised phones; only three commits and no mature test evidence |
| [chipz](https://github.com/jj-style/chipz) | GPL-3.0 file present | Physical cards, multi-device, betting UI | Backend plus older React Native/Expo architecture; last code push was January 2021 |
| [PokerTH Web Client](https://github.com/narmod/pokerth-web-client) | AGPL-3.0 | Mature, free, exact 10-player poker | Digitises the entire game, not just chips; heavier adaptation |
| [PocketPoker](https://github.com/k1bot2026/PocketPoker) | README says MIT, but no licence file | Modern P2P PWA with strong feature set | Live UI caps rooms at 8; not legally safe to fork until a licence file is added |
| [Live Poker Tracker](https://github.com/quinnrallen-hub/pokerchips-site) | No licence file | Strong 10-player physical-card fit | Source-available, not legally reusable without written permission |
| [ZocketZero Poker Chip Tracker](https://github.com/ZocketZero/poker-chip-tracker) | No licence file | 2–10 seats and extensive P2P features | Same licensing problem: do not fork without permission |

## Commercial/free candidates excluded

- [Poker Chips Royale](https://pokerchipsroyale.com/) — free only for 2–4; 5–10 requires Pro.
- [PokerChip.live](https://pokerchip.live/) — core is free, but Pro removes ads/adds features; maximum eight players.
- [Pocket Poker Chips on Google Play](https://play.google.com/store/apps/details?id=rubewijk.DigitalPokerChips) — listing has in-app purchases and the developer confirms an ad banner; review evidence reports a six-player limit.
- [vChips](https://vchips.app/) — attractive no-sign-up/PWA/pass-and-play concept, but no clear primary-source pricing or player cap was found; automated room creation stalled behind its anti-bot step.
- [Poker Patio](https://pokerpatio.com/) — free play and 10 seats, but sells chips/membership and replaces the full poker table rather than just chips.
- [Poker Chips Royale](https://pokerchipsroyale.com/) and EasyPoker — player-count paywalls rule them out for a group of 10.

## Independent review

A separate research agent repeated the search without relying on the main research path. It independently selected ChipStack as the best exact fit to try first, successfully created a room, verified the live chip/action UI, and confirmed the 10-player claim from the official support page. It chose Chips of Fury as the mature fallback and separately rejected Poker Chips Royale, AirChips, and EasyPoker because of paid limits.

The independent review also confirmed the two biggest build risks: most promising repositories either stop below 10 players or lack a proper licence file. It did not discover Piss Poker; that repository was found and technically verified in the main pass after the independent result arrived.

## Source-quality notes

Pricing, capacity, and feature claims were taken from official product pages, app stores, live interfaces, and repository files wherever possible. Popularity claims remain vendor assertions. No recommendation is a legal opinion, security audit, or proof of correctness under every poker edge case.
