# MEJA52 — Release 1 Implementation Gap Map

Status: Release 1 implementation complete through the approved seating-lobby checkpoint; tactile chip/change interaction and final release review remain
Working branch: `codex/meja52-release1`
Upstream baseline: `7867414` (`origin/main` at audit time)

## Baseline verification

| Check | Result |
| --- | --- |
| Locked dependency installation | Passed |
| TypeScript application and Worker type checking | Passed |
| Unit tests | 49 passed |
| Worker integration tests | 29 passed |
| Production build | Passed |
| Playwright multi-device workflows | 11 passed |
| Dependency audit | Four high-severity development/test-chain findings through `sharp`, `miniflare` and the Worker test-pool dependency; no forced update applied |

The inherited project is functional and well tested. It is a useful foundation, not a visual or behavioural match for the approved MEJA52 product.

## Reusable inherited foundation

- React, TypeScript and Vite browser application.
- Cloudflare Worker and one SQLite-backed Durable Object per room.
- Hibernating WebSocket room state and reconnection handling.
- Four-letter room codes, QR invitation and account-free joining.
- Server-authoritative no-limit Hold'em betting engine.
- Blind movement, legal-action validation, all-ins, side pots, ties and odd-chip handling.
- Physical-card street prompts and human-selected showdown winners.
- Device identity, seat recovery, host transfer, shared display and basic settlement.
- Unit, fuzz, Worker integration and Playwright test infrastructure.
- MIT licence and upstream copyright notice, which must remain.

## Binding gaps against the approved specification

| Area | Inherited state | Required MEJA52 state | Priority |
| --- | --- | --- | --- |
| Capacity | Hard-coded at 10 in engine, protocol, Worker and UI | 2–15 seats with tests and responsive layouts | Foundation |
| Room ownership | First player to join becomes host | Creator receives a private host capability before invitations open | Foundation |
| Roles | Host only; dealing authority is implicit | Separate Host and transferable Table Controller roles with one-sentence descriptions | Foundation |
| Room setup | Room is created immediately, then settings are edited | Approved three-step card mode, stakes and review flow | Slice 1 |
| Settings | Numeric chips and optional USD buy-in | Currency label, starting balance, blind values, smallest unit and visual denomination model | Foundation / Slice 1 |
| Join and lobby | Functional code/name join and list ordering | **Implemented:** approved join, avatar, physical seating confirmation, dealer/controller selection and 15-seat lobby | Slice 1 |
| Visual system | Inherited yellow/light-dark Piss Poker UI | Approved warm mineral, graphite, claret and tactile-chip MEJA52 system | Slice 1 onward |
| Orientation | Responsive portrait-first page | Landscape table-edge experience during play, portrait fallback and portrait settlement | Slice 2 |
| Chip interaction | Slider, amount input and shortcuts | Tap denominations, stage physical-looking chips, make change, clear/back and explicit placement | Slice 2 |
| Turn state | Device theme plus yellow active dock | All waiting roles use Batik Indigo; only the active player's own surface uses Hibiscus Ink with explicit turn copy | Slice 2 |
| Governance | Any member may undo, deal next or award | Host-only latest-action redo; Table Controller governs physical streets and ordinary awards | Foundation / Slice 3 |
| Rebuy | Fixed starting-stack amount applied immediately | Player enters amount; host accepts, edits or rejects; applies between hands | Slice 3 |
| Attendance | Immediate sit-out and leave | Break/return, missed-blind handling, requested early departure and frozen settlement balance | Slice 3 |
| Host departure | Automatic or away takeover | Explicit accepted host transfer, including before the current host leaves | Slice 3 |
| Corrections | Generic undo history | Short redo window, governed ledger override, public preview, reason and audit history | Slice 4 |
| Physical runouts | Single boolean “run out the board” prompt | Host selects supported count; Table Controller completes each named runout; pot portions remain exact | Slice 4 |
| Settlement | Basic ledger and minimum transfers | Approved portrait settlement, early leavers, confirmations, exports and exact currency conversion | Slice 5 |
| History and retention | Short in-room log and 12-hour expiry | **Implemented:** private session history, CSV/JSON/image exports, 30-day final-record retention and deliberate host-only early deletion | Slice 5 |
| Digital cards | Not implemented | Visible as `Later release`; implement only under the future-release handoff | Deferred |

## Implementation sequence

### Foundation — correctness and authority

1. **Implemented in pass 1:** raise engine, protocol, Worker and current UI capacity boundaries to 15, with engine and full-room regression coverage. Dedicated load and real-device coverage remain required.
2. **Implemented in pass 1:** bind initial hosting to the creator's existing private device capability without adding approval to code/link joining. The capability is salted per room, never returned in public state and retired after the creator takes a seat.
3. **Implemented in pass 1:** add an independently transferable Table Controller, default it to the host, and enforce Host-only undo versus Controller-only physical awards and next-hand dealing. The current inherited UI exposes the role using existing controls; the approved visual treatment remains Slice 1 work.
4. **Partially implemented in pass 2:** currency and private pending-rebuy state are live. Denomination policy, attendance requests and the broader durable audit model remain pending.
5. Resolve the Cloudflare development dependency advisories through a tested compatible upgrade, never `npm audit fix --force`.

### Slice 1 — create, invite, join and seat

Implement the fully approved journey:

`Home → Card mode → Stakes → Review → Room ready → Code/name join → Seating lobby → Start game`

This slice establishes MEJA52's production tokens, typography, brand application, capability flow and 15-player responsive behaviour.

**Implemented in pass 13:** the host receives a physical clockwise table map for 2–15 players with drag-and-drop plus a tap-based accessible alternative. Each player privately confirms the people on their left and right or asks the host to check the order. Confirmation is advisory, remains valid only while that player's neighbours are unchanged, and never prevents the host from starting. The host selects the proposed first dealer and Table Controller, then uses the explicit **Lock seats & start** action. The selected dealer now determines the first hand's button and blind positions.

### Slice 2 — tactile table edge

Implement the approved waiting, active-turn, preselection, staged-call, raise builder, custom amount, chip-change and portrait fallback comps.

**Implemented in pass 1 and refined in passes 7–8:** responsive portrait/landscape table-edge presentation, deterministic RM1/RM5/RM25/RM100 visual chip composition, tappable chip racks, two-stage Call → Place workflow, Clear, chip-first raise staging, approved shortcuts and secondary Custom amount entry. Every active player now retains one visible current-street bet beside their name—including `0`—in both the standard table and compact landscape rail, without exposing private balances or total hand contributions. The landscape rail is reserved exclusively for player bets, uses 120 px minimum player cells and scrolls independently for 10–15 players; Pot remains in the private action header beside Balance. Landscape chip targets and staged-chip visuals are enlarged for tactile interaction. Manual persisted chip change and denomination settings remain pending.

### Slice 3 — table continuity

Implement player/host controls, rebuy requests, breaks, return/missed blinds, late arrival, leaving, host transfer and disconnect recovery.

**Implemented in passes 2–5:** a player can request any valid whole-unit rebuy, cancel it before review, and privately track its state. The host can review, edit, approve or reject it. Approval between hands applies immediately; approval during a hand is queued until the hand ends, remains correct through undo, enters the buy-in ledger and is hidden from unrelated players and shared displays. Cash-game breaks reserve the seat and stack, start at the hand boundary, track a passed blind position, and let the player either post the missed small blind as dead money plus a live big blind or wait to return naturally on the big blind. Governed leaving retains a frozen result for settlement and requires explicit host transfer. Late arrivals now request a seat, receive host-approved chips, and choose the approved big-blind entry workflow. Disconnects keep the last confirmed table visible, freeze controls immediately, and offer an explicit retry while preserving the seat and balance.

### Slice 4 — physical hand control and corrections

Implement street advancement, showdown awards, ties, side pots, multiple physical runouts, redo, void hand and governed administrative override.

**Implemented in passes 6, 9 and 10:** Host-only Undo now opens a review instead of applying immediately. The host can return the turn to the original player or enter one corrected action for them; non-host actions stay locked during that correction and the audit history retains both events. The host can pause and resume a live hand. Voiding is a two-stage public workflow with a required reason, visible returned amount, optional dealer-button advance, frozen player actions, host confirmation, exact restoration of all pre-hand contributions including blinds, and an audit entry. Reconnect recovery now presents the last confirmed event and an explicit retry while keeping the table readable. Physical Hold’em multiple runouts calculate capacity from hole cards, board cards and standard burns; require a host-selected 1×–4× count and verbal agreement; divide every contested main/side pot board-by-board; and guide the separate Table Controller through dealing and awarding each named runout. Ordinary awards now pause at a public preview and accept a dispute before any chips move. A disputed result can use a pot-conserving administrative override—including a folded player—only after Table Controller approval plus one other connected player; the interface and audit history mark it as not rules-validated.

### Slice 5 — close and retain

Implement shared display, settlement, minimum transfers, history/export, retention and deletion.

**Implemented in passes 11–12:** Ended cash games now freeze into the approved portrait settlement flow. Every connected player reviews a personal starting/rebuy/adjustment ledger and final result, can report or resolve an issue, and then sees the deterministic minimum-transfer plan. Only the debtor can acknowledge their own external transfer. The host explicitly finalises the record without waiting for departed players; unresolved issues require a deliberate warning step and remain permanently marked. Finalisation creates a separate private record capability whose hash alone is stored server-side. The compact record contains the ledger, transfer acknowledgements, reviews and meaningful table timeline while excluding device identity and live room state. It remains available for 30 days, supports image/CSV/JSON export, and can be deleted early only by the host after typing the room code. The website records acknowledgements only and never claims to move or verify money.

## Verification required for every slice

- Write or update regression tests before changing behaviour.
- Preserve server authority and chip conservation for every accepted or rejected event.
- Run type checking, unit tests, Worker tests, production build and Playwright workflows.
- Test actual workflows at 320×568 portrait, both phone landscape orientations, modern iPhone/Android sizes, tablet and desktop/shared display.
- Verify keyboard operation, visible focus, screen-reader naming, 200% text enlargement, reduced motion, safe areas and no horizontal overflow.
- Inspect browser console and network recovery behaviour.
- Compare implemented surfaces to the exact approved comp and record any deliberate deviation for owner approval.

## Identity approval gate — complete

The owner approved `.impeccable/mocks/brand/meja52-identity-direction-v2.png`. Backend foundation work and the approved Slice 1 interface implementation may proceed.
