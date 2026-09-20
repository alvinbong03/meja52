# MEJA52

**The table is yours.** MEJA52 is a free, account-free digital poker-chip table for friends playing together in person. Deal physical cards while every player handles chips, bets and pots from their own phone.

[![CI](https://github.com/alvinbong03/meja52/actions/workflows/ci.yml/badge.svg)](https://github.com/alvinbong03/meja52/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-f5db2b)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers%20%2B%20Durable%20Objects-f38020?logo=cloudflare&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)

`poker` `home-game` `chip-tracker` `texas-holdem` `realtime` `websockets` `durable-objects` `cloudflare-workers` `react` `pwa`

Release 1 has passed its automated certification suite and is live for alpha testing. Mixed real-device play, soak testing and the owner-authorised `main` merge/tag remain before a public Release 1 declaration.

---

## Why this exists

Somebody always forgets the chips. Somebody else "borrows" a stack. Side pots turn into a group negotiation. So the cards stay physical (shuffling is half the fun) and the chips moved into everyone's pocket.

Before writing a line, we read the code of 22 open source chip trackers and put 9 betting engines through scripted side pot and all-in scenarios. Every tracker had real rule bugs (short all-ins reopening betting, the big blind posted twice when the table shrinks, kicks deleting chips, clients trusted to say who they are), and none of the engines passed every scenario. So this one was built from scratch around a small, heavily tested rules engine and a server that owns the truth.

## What it does

- **One phone per player, zero accounts.** Start a table, share a four-letter code, QR code or link. Names are the only sign up.
- **Server-enforced no-limit hold'em.** Blinds post automatically, D/SB/BB remain visible, turn order is enforced, and the big blind keeps its option. MEJA52’s approved home-game rule permits any whole-unit raise above the current bet and reopens action.
- **Side pots without arguments.** Pots are built in layers from what each player put in, uncalled chips go back automatically, and folded chips stay in as dead money.
- **Chops take one tap per winner.** Same hand as somebody else? Tap both names. Every pot lists its players with a checkbox, each share appears the moment you pick, and the odd chip goes clockwise from the dealer with a line saying so.
- **Your turn is impossible to miss.** Waiting devices use Batik Indigo; only the active player moves to Hibiscus red with an explicit `Your turn` label. Optional sound and haptics respect each device’s saved preference.
- **Deal prompts for the dealer.** "Deal the flop", "Run out the board", "Who won?". The app tells the table what the cards should be doing.
- **Built for real tables.** The host governs corrections and continuity; a separate Table Controller handles physical streets and awards. Manual seats, accepted host transfer, device recovery, breaks, missed blinds, late arrivals and governed leaving are supported.
- **Settle up.** Buy-ins, rebuys, early leavers and net results produce a minimum-transfer plan. The app records acknowledgements but never moves money; private final records expire after 30 days and support image, CSV and JSON export.
- **Table display mode.** Prop an iPad or laptop in the middle for a big-type view of the pot, whose turn it is and every current bet, with a QR code to join. Private balances stay on each player's device.
- **Phone first, fine everywhere.** Landscape gameplay, portrait fallback and settlement, foldable/unusual-screen adaptation, 15-player scrolling rails and keyboard alternatives (`F`, `C`, `R`, arrows, `Enter`, `N`) are covered by browser workflows.

## Architecture

```
 phones, iPads, laptops                    Cloudflare
┌──────────────────────┐   HTTPS   ┌─────────────────────────────────────────────┐
│ React 19 SPA (Vite)  │──────────▶│ Worker "meja52"                             │
│  shared/engine.ts    │           │  static assets + SPA routes                  │
│  (legal moves, UI)   │   WSS     │  /api/* + WebSocket upgrades                 │
│                      │◀─────────▶│                 │ idFromName(code)           │
└──────────────────────┘           │                 ▼                            │
                                   │ Durable Object "Room" (one per table)        │
                                   │  shared/engine.ts  (authoritative rules)     │
                                   │  hibernating WebSockets, SQLite storage      │
                                   │  undo history, presence, claims, alarms      │
                                   └─────────────────────────────────────────────┘
```

**The server owns the truth.** Phones send intentions (`act`, `award`, `undo`); the room's Durable Object validates them against the rules engine and broadcasts the new state to everyone. A client cannot move chips, act out of turn or pretend to be someone else.

**Every change is versioned.** Each state carries a version `v`, and every action names the version it was decided on. Double taps, two people pressing "Deal next hand" at once, and actions taken from a stale screen are rejected with `STALE`. The sender gets the fresh state back.

**Identity is a device secret.** Each device generates a random 256-bit token. The room stores only a salted SHA-256 hash and never broadcasts it. Taking over a seat from a new device requires authorised approval.

**Undo rewinds the game, not the guest list.** The last 30 game states are kept. Membership lives outside that history, so undoing never removes someone who just sat down or brings back someone who was removed.

**Resilient on real phones.** iOS freezes sockets when a phone locks, so clients ping every 10 seconds (answered by the runtime without waking the object), reconnect on focus, visibility and network changes, and back off with jitter. Rooms hibernate when idle and delete themselves after 12 quiet hours.

### Repository map

| Path | What lives there |
| --- | --- |
| `shared/engine.ts` | Pure betting engine: blinds, turn order, raises, side pots, payouts. No dependencies. |
| `shared/protocol.ts` | Wire message types and strict validation of everything a client sends. |
| `shared/settle.ts` | Ledger, cents conversion that always sums to zero, minimal transfers. |
| `shared/names.ts` | Name cleanup: Unicode normalization, invisible and bidi characters stripped, grapheme limits. |
| `worker/src/room.ts` | The `Room` Durable Object: sockets, permissions, undo, presence, rate limits, expiry. |
| `worker/src/index.ts` | API router, origin allowlist, room creation with per-address rate limiting. |
| `src/` | The React app: screens, the action dock, sheets, table display. |
| `test/` | Engine scenarios, a seeded fuzzer, protocol and settlement tests. |
| `worker/test/` | Durable Object integration tests running inside workerd. |
| `e2e/` | Playwright suite with several simulated devices, plus a screenshot walkthrough. |

## Testing

```bash
npm run test:unit     # 71 tests: engine scenarios + 1,500 fuzzed games + protocol + settlement
npm run test:worker   # 58 Durable Object and WebSocket integration tests inside workerd
npm run test:e2e      # 26 multi-device Playwright workflows
FUZZ_GAMES=25000 npm run test:unit   # the long fuzz run
```

- **Scenario tests** cover every rule bug found while auditing other projects:
  - short and cumulative all-ins
  - the big blind on a short stack, and a heads-up small blind all in for less than the big blind
  - the table dropping from three to two players
  - dead money, three-way ties with odd chips
  - leaving on your own turn, and leaving at showdown
- **The fuzzer** plays random games with short, mixed and deep stacks, random leaves and deliberate illegal moves. After every action it checks:
  - chips are conserved
  - somebody legal is always due to act
  - pots add up, eligibility is nested, and each player can win exactly what they matched
  - rejected moves never change state
  - nobody posts the big blind twice in a row

  25,000 games pass clean.
- **Integration tests** cover stale versions, concurrent `next` and `undo`, seat claims, kicks, host handoff, oversized and malformed messages, rate limits and room expiry.
- **End-to-end tests** cover complete play and settlement, blind posting and positions, tactile/custom chip change, side pots and ties, rebuy/break/leave/late-arrival workflows, accepted host transfer, recovery and seat takeover, runouts and governed corrections, 15-player/foldable layouts, keyboard access and overflow from 320 to 1440 pixels.

## Local development

```bash
npm install
npm run dev          # worker on :8787 and Vite on :5173 with /api proxied
```

Open two browser windows (or a normal and a private window) at `http://localhost:5173` to play against yourself.

Other scripts: `npm run typecheck`, `npm run build`, `npm run shots` (screenshots of every screen in `/tmp/pp-shots`), `npm run assets` (regenerates icons and the OpenGraph image).

## Deployment

MEJA52 deploys as one Cloudflare Worker containing the static Vite build, `/api/*`, WebSockets and the SQLite-backed `Room` Durable Object:

```bash
npm run deploy:dry-run  # build and validate without publishing
npm run deploy          # build and publish to workers.dev
npm run smoke:live      # verify live API, two WebSockets, public pot and private balances
```

Wrangler must be authenticated first. GitHub deployment from `main` requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets.

## Tech

React 19, Vite 8, TypeScript 5.9, Cloudflare Workers static assets, Durable Objects (SQLite-backed, WebSocket hibernation), Vitest 4 with `@cloudflare/vitest-pool-workers`, Playwright, Geist and Instrument Serif, `uqr` for QR codes.

## Project records

- [Product specification](docs/product/product-specification.md)
- [Implementation gap map](docs/product/implementation-gap-map.md)
- [Release 1 certification](docs/product/release-1-certification-2026-09-20.md)
- [Design system](DESIGN.md)
- [Approved design package](docs/design/Remaining%20Release%201%20Comps%20Approval%20Package.md)
- [Future Digital Card Mode handoff](docs/product/future-release-handoff.md)

## Upstream and licence

MEJA52 is built from the MIT-licensed Piss Poker project. The original copyright and licence notice remain in [LICENSE](LICENSE). This repository has its own clean history and does not retain the source project as a Git remote.
