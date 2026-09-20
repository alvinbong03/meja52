# MEJA52 — Release 1 Implementation Gap Map

Status: Foundation pass 1, Slice 1 entry flow and Slice 2 tactile-betting pass 1 implemented and verified locally; remaining continuity and governance work is pending
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
| Join and lobby | Functional code/name join and list ordering | Approved join, avatar, physical seating confirmation and 15-seat lobby | Slice 1 |
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
| History and retention | Short in-room log and 12-hour expiry | Session history/export, 30-day retention and deliberate early deletion | Slice 5 |
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

### Slice 2 — tactile table edge

Implement the approved waiting, active-turn, preselection, staged-call, raise builder, custom amount, chip-change and portrait fallback comps.

**Implemented in pass 1 and refined in pass 7:** responsive portrait/landscape table-edge presentation, deterministic RM1/RM5/RM25/RM100 visual chip composition, tappable chip racks, two-stage Call → Place workflow, Clear, chip-first raise staging, approved shortcuts and secondary Custom amount entry. Every active player now retains one visible current-street bet beside their name—including `0`—in both the standard table and compact landscape rail, without exposing private balances or total hand contributions. Manual persisted chip change and denomination settings remain pending.

### Slice 3 — table continuity

Implement player/host controls, rebuy requests, breaks, return/missed blinds, late arrival, leaving, host transfer and disconnect recovery.

**Implemented in passes 2–5:** a player can request any valid whole-unit rebuy, cancel it before review, and privately track its state. The host can review, edit, approve or reject it. Approval between hands applies immediately; approval during a hand is queued until the hand ends, remains correct through undo, enters the buy-in ledger and is hidden from unrelated players and shared displays. Cash-game breaks reserve the seat and stack, start at the hand boundary, track a passed blind position, and let the player either post the missed small blind as dead money plus a live big blind or wait to return naturally on the big blind. Governed leaving retains a frozen result for settlement and requires explicit host transfer. Late arrivals now request a seat, receive host-approved chips, and choose the approved big-blind entry workflow. Disconnects keep the last confirmed table visible, freeze controls immediately, and offer an explicit retry while preserving the seat and balance.

### Slice 4 — physical hand control and corrections

Implement street advancement, showdown awards, ties, side pots, multiple physical runouts, redo, void hand and governed administrative override.

**Implemented in pass 6:** Host-only Undo now opens a review instead of applying immediately. The host can return the turn to the original player or enter one corrected action for them; non-host actions stay locked during that correction and the audit history retains both events. The host can pause and resume a live hand. Voiding is a two-stage public workflow with a required reason, visible returned amount, optional dealer-button advance, frozen player actions, host confirmation, exact restoration of all pre-hand contributions including blinds, and an audit entry. Reconnect recovery now presents the last confirmed event and an explicit retry while keeping the table readable. Multiple physical runouts and the broader administrative ledger override remain pending.

### Slice 5 — close and retain

Implement shared display, settlement, minimum transfers, history/export, retention and deletion.

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
