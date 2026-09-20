# MEJA52 — Product Specification

Status: Approved product specification; independently reviewed at the original ten-player scope, with a later owner-approved 15-player amendment requiring targeted validation
Date: 19 September 2026
Product name: MEJA52; owner-approved working identity

Independent review completed: 19 September 2026. The resulting security, accessibility, poker-rules, scope and hosting corrections are incorporated below. The later increase to 15 players is not represented as part of that independent pass and carries explicit engine, protocol, layout, load and device-test requirements. See [Specification Review](specification-review.md) for the review record.

## 1. Product summary

MEJA52 is a free, browser-based companion for 2–15 friends playing poker face-to-face. Every player uses a phone as their private chip stack and table control surface. A host creates a room, shares a QR code or four-letter code, and starts the game after arranging the digital seats to match the physical table.

The product has two card modes:

1. **Physical Card Mode** — players use a real deck; the website manages chips, legal betting actions, pots, rebuys, attendance and settlement.
2. **Digital Card Mode** — the website also shuffles, deals private hole cards, shows community cards and evaluates winners.

Gameplay is landscape-first and designed to feel like a player's physical edge of the poker table, not like a calculator or accounting ledger. Settlement returns to portrait orientation.

The website does not hold, transfer or process money. Currency labels are bookkeeping units chosen by the host.

## 2. Product principles

- **In-person first.** Phones support conversation around a real table rather than replacing it with a conventional online-poker screen.
- **Chips should feel tangible.** Players build bets from coloured chip stacks and push them toward the pot.
- **Fast defaults, flexible host controls.** Ordinary hands should require very little administration; unusual situations remain correctable and auditable.
- **Server-authoritative.** A phone submits an intention; the server validates and commits the result.
- **No account required.** A display name and device-bound recovery secret are sufficient.
- **No hidden monetary features.** No deposits, wallets, rake, payment rails, advertisements or purchases.
- **Free to operate at small scale.** Use open-source software and free infrastructure tiers wherever practical.
- **Private by default.** Unrevealed cards never enter public room state, analytics or logs.
- **Accessible beyond colour.** Values, labels, patterns, focus, sound and haptics reinforce visual state.

## 3. Goals and non-goals

### Goals

- Replace physical poker chips for a 2–15-person face-to-face game.
- Support both physical and digital cards.
- Support cash games and single-table tournaments.
- Guide correct betting order, the approved flexible-raise house rule, all-ins, main pots and side pots.
- Survive refreshes, brief disconnections and host changes without losing state.
- Preserve an auditable record of rebuys, departures, corrections and settlement.
- Run on the latest two major iPhone Safari and Android Chrome releases without an app-store download.
- Provide an optional public table/spectator display.

### Non-goals for the approved roadmap

- Processing or guaranteeing real-money payments.
- Public matchmaking, remote internet poker or anonymous play against strangers.
- User accounts, long-term player profiles or leaderboards across rooms.
- Rake, tipping or operator profit.
- Antes, straddles, bomb pots and other optional house bets.
- Automated digital support for draw, stud, high/low, short-deck or mixed games.
- Native iOS or Android applications.
- Guaranteed operation without internet access.

## 4. Open-source foundation

Fork and rebrand [Piss Poker](https://github.com/KarthikSubramanian07/Piss-Poker) under its MIT licence. Preserve its licence and copyright notice.

### Reuse

- React, TypeScript and Vite web application structure.
- Cloudflare Workers static assets and SQLite-backed Durable Objects architecture.
- Four-letter rooms, QR/link joining and account-free device identity.
- Server-authoritative WebSocket room state and versioned actions.
- No-limit Hold'em betting engine, blinds, turn order and wager validation.
- Short all-ins, automatic uncalled-bet return, layered side pots and odd chips.
- Reconnect, seat recovery, host handoff, room expiry and public display concepts.
- Settlement ledger and minimum-transfer calculation.
- Unit, integration, fuzz and multi-browser test structure.

### Extend or replace

- Replace the existing interface with the approved landscape physical-chip design.
- Restrict redo/correction authority to the host as specified below.
- Add host-approved rebuys, leaving requests, breaks and frozen departure balances.
- Add cash/tournament mode separation and tournament timing.
- Add Pot-Limit Omaha and physical-card Dealer's Choice.
- Add denomination inventories, visual chip change and chip animations.
- Add digital deck, private card delivery, card evaluation and multiple runouts.
- Add public role/control descriptions and the final settlement-review workflow.

### Adoption prerequisite

Piss Poker is a useful prototype foundation, not a production-ready platform: at review time it was a very young, single-contributor project with no tagged releases. The research clone passed type-checking, 47 unit tests and a production build, but this does not establish production maturity; its fuzzer covered only 2–9 players even though the server allowed ten.

Before adoption:

- Inspect the full Git history and provenance, pin a reviewed commit and preserve MIT attribution.
- Re-run the dependency audit and upgrade, replace or formally accept the four high-severity findings found in the Cloudflare development/test chain.
- Run the worker and end-to-end suites, independently exercise fifteen seats and generate an SBOM/licence report.
- Publish a reproducible fork, local-development and deployment guide.
- Treat the secure capability model, private per-seat state, retained settlement record and all later-phase features as new work, not inherited guarantees.

## 5. Roles

| Role | Authority | One-sentence in-product description |
|---|---|---|
| Host | Room settings, approvals, corrections, host transfer and ending the session | “Manages the room, approvals, corrections and final settlement.” |
| Table Controller | Confirms physical dealing stages and proposes physical-card pot awards | “Manages physical dealing and confirms table events.” |
| Dealer Button | Rotating poker position that determines blinds and betting order | “Rotates each hand and determines blinds and betting order.” |
| Player | Controls their own betting actions, chip rack, cards and requests | “Plays from this seat using its private cards and chip stack.” |
| Spectator | Read-only access to public table information | “Watches the public table without seeing private cards or taking a seat.” |

The host is the initial Table Controller in Physical Card Mode but can assign another player. Transferring the Table Controller never moves the Dealer Button. Digital Card Mode does not need a dealing controller; the assigned controller retains only table-management duties.

Descriptions appear during first use and remain available through an information control. Poker-specific controls such as Muck, Flop Dealt and Run Remaining Board also receive a short description.

## 6. Target game choices

### Target product

1. **No-Limit Texas Hold'em**
   - Two private cards and five community cards.
   - Physical and digital cards.
   - Cash and tournament play.

2. **Pot-Limit Omaha High**
   - Four private cards.
   - A hand uses exactly two private cards and exactly three community cards.
   - Physical and digital cards.
   - Cash and tournament play.
   - A single 52-card deck limits a table to 11 active players; the room configurator enforces this even though the product's general table limit is 15.

3. **Dealer's Choice / Manual**
   - Physical cards only.
   - The Table Controller defines and advances named betting rounds.
   - This is an accounting mode: the controller declares round completion and the table resolves legal-action disputes. The app does not claim complete variant-rules enforcement or evaluate cards.

The general table limit is 15. A selected variant may impose a lower mathematically required cap, which must be shown before invitations are sent.

### Later rules modules

Omaha Hi/Lo Eight-or-Better, Five-Card Draw, Seven-Card Stud, Short Deck Hold'em and mixed-game rotation. PokerKit may be used as an independent rules/test reference, but its Python runtime should not be introduced into the initial Cloudflare TypeScript architecture solely for this purpose.

## 7. Room creation

The host creates a room without registering and chooses:

- Cash Game or Tournament.
- Poker variant.
- Physical Card Mode or Digital Card Mode where supported.
- Currency for cash bookkeeping (for example, RM, £, $, € or a custom label).
- Starting balance for every player in a cash game.
- Small blind and big blind.
- Tournament preset or custom blind schedule.
- Freezeout or tournament re-entry settings.
- Initial Table Controller in Physical Card Mode; host by default.
- Optional backup host.
- Sound, haptics and turn-timer preferences.

Optional house bets are not shown in the first release.

Release 1 fixes the game to **No-Limit Texas Hold'em Cash Game**, so room creation does not show redundant format and variant selectors. Its three focused steps are card mode, stakes and review. The review still states `Texas Hold'em · Cash game` so the host can verify the fixed rules before creating the room. A format or variant selection step is introduced only when more than one supported option is enabled in a later release.

After creation, the host receives:

- A server-unique four-letter uppercase code that excludes ambiguous characters such as I and O.
- A QR code and shareable player link containing the room locator plus a separate random 128-bit join capability.
- A random 256-bit host capability bound before the room accepts players and stored as a private device secret, never placed in the player share link.

**Share invite** invokes the browser's native share sheet with the scoped player join link when the Web Share API is available, allowing the host to choose WhatsApp, Messages, Telegram, email or another installed destination, including a group chat. If native sharing is unavailable, the interface copies the complete player join link and confirms **Invite link copied**. It never copies or shares the host capability.

A guest who opens the QR code or shared player link still enters a display name, then enters the lobby directly. A guest who types a valid four-letter room code also enters their display name and proceeds directly to the lobby without host approval. On successful code lookup, the server issues that browser a new seat-scoped capability. Room-code lookup is rate-limited, active codes expire with their rooms and the host may remove unwanted or duplicate entrants.

The four-letter code is a convenience locator, not a private secret. For the approved initial workflow, possession of a valid active code is sufficient to request a new player session without host approval. Player, spectator and settlement links still use separate scoped capabilities. Failed room lookup and failed authorisation return indistinguishable public errors and are rate-limited.

## 8. Joining, seating and starting

1. A player scans the QR code or enters the four-letter code.
2. They enter a display name and may choose an avatar; no account is required.
3. A valid player link or valid four-letter code may enter the lobby directly after name entry. The host may remove duplicates or unwanted entries.
4. A circular lobby represents the physical table.
5. The host drags a player directly onto another seat to swap the two positions. As an accessible touch/keyboard alternative, tap a player and then tap their intended new seat; the two players swap without an insertion-order step.
6. Each phone shows its seat and neighbours to its left and right. Confirmation is advisory; the host may start after acknowledging any unconfirmed seats.
7. The host selects or confirms the initial Dealer Button. The app proposes a random starting seat.
8. The host selects **Lock Seats & Start**.

The table supports fifteen active seats. Further entrants join a visible waiting list. After the game starts, joining a seat requires host approval and occurs only between hands.

Each browser creates a random 256-bit seat capability. Only a salted hash is stored by the room. A returning browser reclaims the same seat. Moving a player to another device requires host approval; recovering the host seat requires the designated backup host or approval by two connected seated players. Recovery rotates the capability and fences every old WebSocket within one state transition.

## 9. Late arrivals

Cash-game late arrivals:

- Wait until the active hand ends.
- Require host approval and an empty seat.
- Receive the host's configured starting balance unless the host records another approved entry amount.
- Choose **Post Big Blind & Join Next Hand** or **Wait for Big Blind**.
- The host may choose the logged house-rule override **Join Next Hand — No Entry Blind**.
- Never enter a hand already in progress.

Tournament late arrivals:

- Are possible only if late registration was enabled at room creation.
- Join only between hands and receive the full fixed starting stack.
- Close after the configured level; recommended default is the end of Level 4.

## 10. Dealer Button, blinds and action order

- The Dealer Button moves one active seat clockwise after each completed hand.
- In games with three or more players, the next active player posts the small blind and the following active player posts the big blind.
- Pre-flop action begins with the first active player clockwise after the big blind.
- Post-flop action begins with the first active player clockwise after the Dealer Button.
- Heads-up: the button posts the small blind and acts first pre-flop; the big blind acts first post-flop.
- Blinds are deducted and displayed automatically.
- D, SB and BB markers appear on every public table representation.
- Use the dead-button method for both cash and tournament play: blinds advance to the next eligible active seats even if the Dealer Button temporarily points to an empty seat. Heads-up rules override it when two players remain.
- A late player seated between the button and small blind waits until the button passes unless entering through the approved post-big-blind option.
- Missed-blind debt follows the break rules in section 22; a returning player never posts two live big blinds for the same entry.

## 11. Landscape gameplay experience

Gameplay is designed as the player's edge of a physical poker table:

- **Top edge, facing the physical table:** pot, current required amount and committed chips.
- **Middle:** betting area separated by a subtle betting line.
- **Bottom edge, facing the player:** persistent coloured denomination stacks.
- **Corners:** contextual actions and the retractable Table Controls handle.
- **Digital Card Mode:** a private covered-card area and a shared community-card strip.

### Turn state

- The active player's interface changes to a warm-white background with dark text.
- Every other player's gameplay background remains dark.
- While not active, the host uses a distinct premium host surface rather than the ordinary player graphite. The role is also stated in text so colour is never the only identifier. When it becomes the host's turn, the interface uses the same warm-white active surface as every other player and keeps a visible **Host** label.
- **Your Turn**, highlighted controls and a short haptic/sound cue reinforce the state; colour is not the only signal.
- The transition is soft and never flashes.

### Orientation

- Landscape is the preferred table-like layout and supports both landscape directions.
- Portrait provides the same state, actions and confirmations in a compact stacked layout. **Rotate your phone for the table view** is advisory and dismissible.
- Request fullscreen/orientation lock where supported.
- Because iPhone browsers cannot reliably be forced into landscape, show concise instructions if system Portrait Orientation Lock blocks rotation.
- Settlement and exported summaries use portrait layouts.

### Navigation

A retractable **Table Controls** sheet contains secondary actions: rebuy, leave, take a break, host transfer, history, settings, accessibility and help. It collapses to a small handle so the main screen remains table-like. Its contents are role-specific: ordinary players see player controls, while the current host sees a dedicated **Host** section without a Player/Host tab switch.

## 12. Chip model and visual denominations

### Cash games

Cash chips are directly denominated in the selected currency. For RM1/RM2 blinds, the proposed default is:

| Value | Colour |
|---:|---|
| RM1 | White/blue |
| RM5 | Green |
| RM10 | Red |
| RM20 | Warm amber |
| RM50 | Teal-blue |

Release 1 uses the fixed RM1–RM5–RM10–RM20–RM50 rack. Editable denomination sets remain a later enhancement.

Default composition prioritises playable small chips before larger values. A RM50 balance is composed as `10 × RM1`, `4 × RM5`, and `2 × RM10`. Larger balances retain that small-chip floor, then introduce RM20 and RM50 chips; the exact composition always sums to the authoritative balance.

### Tournaments

Tournament values are abstract units, not currency:

| Value | Colour |
|---:|---|
| T25 | Green |
| T100 | Black |
| T500 | Purple |
| T1,000 | Yellow/orange |
| T5,000 | Dark blue |

Tournament chips do not all have the same value and are never converted to currency during play.

### Accessibility and stack display

- Every chip prints its value.
- Every denomination has a distinct value label and colour; the centre remains visually quiet so the amount stays easy to read.
- Screen readers receive a complete value/count label.
- Large holdings use visible stack layers plus a count such as `×18`; the UI does not draw hundreds of individual objects.
- The authoritative balance is an integer count of the configured smallest currency unit. Never use floating point for value.
- Denomination composition is a reversible presentation state that must always sum to the balance and can never prevent a legal wager.
- Room setup rejects a blind, entry or denomination not divisible by the selected smallest unit.

## 13. Building and committing a wager

On the player's turn:

1. Tap a denomination repeatedly to add individual chips to the betting area.
2. Press and hold to add chips repeatedly.
3. Drag one staged chip downward to return it, or tap **Clear** to return the whole staged group at any time before committing.
4. The betting area shows both physical chips and the exact total.
5. Drag the prepared stack upward across the betting line to commit.
6. Crossing the line produces a visual snap, haptic feedback and a chip-to-pot animation.

Contextual quick actions remain available:

- **Check** when nothing is owed.
- **Call RM10** stages the exact amount; it does not commit immediately.
- **Bet** or **Raise to** with minimum, half-pot, pot and all-in presets where legal.
- **Custom** opens direct numeric entry as a secondary method. The input and numeric keypad appear only after Custom is selected, so the default wager builder remains chip-first.
- **Fold** through a deliberate short slide to reduce accidental folds.

Before chips are staged, the action rail shows the currently legal choices, such as **Fold**, **Call RM10** and **Raise**. Selecting **Call RM10** or a bet/raise preset stages the corresponding chips. Once any chips are staged, the choice controls are replaced by:

- A non-interactive inferred-action status, such as **Calling RM10** or **Raising to RM30**.
- **Clear**, which returns all staged chips and restores the legal-action choices.
- One primary commit control labelled with the exact result, such as **Place RM10**.

The interface never presents **Call RM10** and **Place RM10** simultaneously as two actionable buttons. Dragging the prepared chips across the betting line and pressing **Place…** are equivalent commit methods.

Only legal actions are displayed. A committed action is server-validated, versioned, broadcast and followed by automatic activation of the next player.

## 14. Making change

Visual chip composition persists between actions. The app makes change only when needed rather than reorganising every stack after every transaction.

### Manual change

- A visible **Make Change** control appears beside the chip rack.
- Tap it to open a focused change window, then select one owned chip from the familiar visual rack.
- Build the replacement from any smaller denominations by tapping chips or typing quantities. For example, an RM50 chip may become `20 × RM1 + 6 × RM5`.
- A running total shows the replacement amount and the amount remaining. **Break Chip** stays disabled until the replacement exactly equals the selected source chip.
- Confirm **Break Chip** to animate the exchange. The server rejects non-exact totals, duplicate denominations, larger replacement chips, and unavailable source chips.
- Direct shortcut: drag a chip onto the **Make Change** target.
- The preview explains that the player's balance stays the same.
- Making change does not alter balance and may be done before or during a turn.

### Automatic change

For a quick Call or exact numeric amount, the app first tries the player's current visual denominations. If no exact combination exists, it breaks the smallest suitable larger chip and returns the unused smaller chips to the rack.

Example: a player with only RM20 chips calls RM7. One RM20 is broken through the approved chain, RM5 + RM1 + RM1 enters the betting area and RM13 remains in the rack.

Custom denomination sets use an exact bounded change-making algorithm. If the visible rack cannot represent an otherwise legal wager, the server still commits the numeric wager and the client deterministically recomposes the rack, using a clearly labelled smallest-unit remainder token when necessary. Pot awards, rebuys, splits, odd chips, undo and reconnect use the same deterministic composition function.

## 15. Betting engine and turn workflow

- Supported actions: fold, check, call, bet, raise to and all-in.
- Players act strictly in server-controlled order.
- The current amount to call and the smallest legal next raise-to amount are always available to the interface.
- MEJA52 intentionally uses a flexible home-game raise rule instead of Poker TDA's full-raise minimum: any whole-unit raise-to amount above the current table bet and within the player's balance is legal. Every accepted raise reopens action for prior actors. Executable examples are required.
- Pot-Limit Omaha uses integer arithmetic with: `call amount = current street bet − player's prior street contribution`; `pot after call = pot before action + call amount`; `maximum raise-to = player's prior street contribution + call amount + pot after call`.
- Unmatched excess is returned automatically.
- Folded contributions remain dead money.
- Main and side pots are built automatically from contribution layers.
- All devices receive the committed action and new state immediately.
- A short public message appears, for example: “Alvin raises to RM30.”
- During a live hand, public player surfaces show current-street bets but not remaining balances or cumulative hand contributions. Each player's own device privately shows their balance and total committed in the hand. The shared display follows the same public-state rule; final settlement may show final balances.

Cash games have no automatic turn timer by default. The host may enable one. Tournament presets include a host-adjustable timer. One visible/audible warning precedes timeout; on expiry the server checks when legal and otherwise folds. A disconnected player first receives the reconnection grace workflow, and the tournament level clock continues unless the host pauses the whole tournament.

## 16. Physical Card Mode

The app never asks for card ranks or suits.

After a betting round completes:

1. Betting controls pause.
2. The Table Controller physically deals the appropriate cards.
3. They tap **Flop Dealt**, **Turn Dealt** or **River Dealt**.
4. The next betting round begins.

Microcopy example: **Flop Dealt** — “Start the next betting round after placing the three flop cards.”

Dealer's Choice uses host-defined round labels but the same pause/deal/confirm pattern.

## 17. Digital Card Mode

### Private and public cards

- Texas Hold'em deals two private hole cards; Pot-Limit Omaha deals four.
- Each player's hole cards are sent only to that player's authenticated connection.
- Five community cards appear publicly as flop, turn and river.
- A shared display may show community cards but never private cards.

### Peeking interaction

- Hole cards are covered by default.
- The player presses and holds or slides a virtual cover upward to peek.
- Releasing immediately covers the cards.
- Cards also cover when the page loses focus, the phone locks, the browser is backgrounded, the device rotates unexpectedly or the player reconnects.
- Surrounding UI dims while peeking; a subtle haptic confirms reveal/conceal.
- At showdown, the player receives **Show Hand** and **Muck** where rules permit.
- Every press, hold, slide, swipe and drag interaction has a labelled tap/button equivalent.
- Covered cards are absent from the accessibility tree. **Read My Cards** intentionally reveals and announces them once after warning “Use headphones for privacy”; re-covering removes them from the accessibility tree. Card ranks are never announced automatically on turn change, reconnect or focus restoration.

### Shuffle and deal security

Digital dealing is server-trusted in the first digital-card release, not zero-trust or independently provable:

- The room's Durable Object creates the deck with Web Crypto and an unbiased, rejection-sampled Fisher–Yates shuffle.
- The live deck persists only in private room state so a Durable Object restart resumes the exact hand.
- The host is an ordinary client and never receives the full deck.
- Each hole card is sent only in a seat-scoped payload; public messages contain no private card field.
- Unrevealed card material is deleted at hand completion and excluded from room-wide messages, service-worker caches, analytics, exception reports, exports and persistent logs.
- No third-party script or session-replay analytics runs on gameplay routes.
- The shuffle implementation and a plain-language **How dealing works** page are public.
- Cloudflare and the service operator are explicitly within the trusted computing base; the product makes no claim that players can independently prove the shuffle.

A future verifiable-deal design may use selective card commitments or a mental-poker protocol that proves revealed cards without exposing folded or undealt cards. It is not required for the first digital-card release.

## 18. Showdown and pot awards

### Everyone else folds

The server automatically awards all eligible pots to the last live player without requiring cards to be shown.

### Digital cards

- The server evaluates all live hands under the selected variant.
- It identifies each winner and tied winner for every main/side pot.
- It displays the winning five-card hand and animates each award.
- The host may open the logged manual correction editor for an exceptional house ruling.

### Physical cards

1. Betting ends and **Showdown** appears.
2. Players reveal physical cards according to table rules.
3. The Table Controller selects **Award Pot**.
4. The app presents each main/side pot and its eligible players.
5. The controller selects one winner or multiple tied winners.
6. Every device previews the proposed distribution.
7. After verbal table confirmation, the controller confirms the award.
8. Any player may select **Dispute** before the next hand starts.

### Host award editor

Normal corrections may change winners or ties only within each computed pot's eligible set. The user-approved flexibility to change eligibility, include a previously folded player, alter contributions, or create/merge/resize/remove side pots is available as a clearly labelled **Administrative Ledger Override**. It requires a reason plus approval from the Table Controller and one other connected player; if the host is also the Table Controller, a second connected player still approves. The editor must:

- Conserve the total pot exactly.
- Revalidate each player's exposure and the overall session value.
- Preview changes publicly.
- Preserve both original and corrected entries in history.
- Require an explicit final confirmation.
- Mark the affected hand as **Table override — not rules-validated**.

Each side pot is awarded separately. Equal ties split automatically. An indivisible smallest chip goes to the first eligible winning seat clockwise from the Dealer Button.

## 19. Corrections, redo and voiding a hand

### Before commitment

The active player may revise or clear staged chips throughout their turn.

### Redo last action

After commitment and before the next player commits:

- Only the host may select **Redo Last Action**.
- The server restores the state immediately before that action.
- The host either returns the turn to the original player or enters the corrected action on their behalf.
- The original action and correction remain visible in history.

After another player commits or the next street starts, use the broader award/correction tools or void the hand.

### Pause and void

- The host can pause new actions for a dispute, exposed card, misdeal or technical problem.
- **Void Hand** requires a reason and public confirmation.
- All contributions, including blinds, return to their pre-hand owners.
- Dealer/button state returns to the pre-hand position unless the host explicitly advances it.
- The void and reason remain in the audit history.

## 20. Multiple all-in runouts

This feature is available in cash games in both Physical and Digital Card Modes, but not tournaments.

- It becomes available only when every remaining player is all-in and no further betting is possible.
- The host selects **Run Remaining Board…** and chooses the number of runouts.
- Present `1×`, `2×`, `3×`, `4×` up to the maximum supported by the cards remaining.
- The host confirms that the involved players agreed verbally.
- A single runout count applies to the whole hand.
- Each pot is divided into that number of portions and evaluated/awarded once per board.
- Remainders follow the approved odd-chip rule.
- Digital Card Mode deals and evaluates every board automatically.
- Physical Card Mode guides the Table Controller through each physical board and its award.
- The selected count is stored in history.

Calculate `maximum runouts = floor(cards remaining / cards needed per remaining board)`. Physical mode includes the standard burn cards required from the current street; digital mode requires only undealt board cards because no physical card backs can be exposed. The single selected count applies to every pot as an intentional house policy even when pots have different eligible players. Test the capacity matrix for Hold'em/PLO, 2/15 players, every street and both card modes. Digital-card capacity must reject combinations that cannot be dealt from one 52-card deck; for example, 15-player Omaha is impossible and must not appear as a legal room configuration.

## 21. Rebuys

### Cash games

- A player opens the retractable Table Controls sheet and selects **Request Rebuy**.
- The player enters the requested amount.
- The host accepts, edits or rejects it.
- Approved value is added only between hands, never during an active hand.
- Every approval appears publicly and in the settlement ledger.

### Tournaments

- Freezeout is the default.
- If re-entry is enabled, the host sets the deadline and maximum entries before starting.
- Only a player at zero chips may request re-entry.
- Every approved re-entry gives the same fixed starting stack; the player cannot choose an amount.
- Re-entry happens only between hands and is recorded.

## 22. Taking a break

Taking a break is temporary and distinct from disconnecting or leaving.

### Cash games

- **Take a Break** starts after the active hand.
- The player's stack and reserved seat remain visible.
- They receive no cards while away.
- The app records missed blinds.
- If no blind was missed, **I'm Back** rejoins the next hand.
- If blinds were missed, offer **Post Missed Blinds & Return** or **Wait for Big Blind**.
- The big blind portion is live; an owed small blind is dead money.
- The host may convert a prolonged absence into the normal leaving workflow.

### Tournaments

- The player's future hands are automatically folded while absent.
- Blinds continue to move and blinds are deducted.
- A player can be blinded out and eliminated.
- **I'm Back** reactivates them for the next hand.
- A personal break does not pause the tournament clock.

## 23. Disconnects and recovery

- A dropped connection displays status publicly without revealing device details.
- Allow approximately 60 seconds for automatic reconnection before host intervention.
- Clients reconnect on focus, visibility and network changes using jittered backoff.
- The same device restores its seat, balance and covered hole cards.
- The host may extend the wait, place the player on a break where appropriate, or fold an absent hand when rules permit.
- A different device uses table-approved seat recovery and invalidates the old token.

Host disconnection:

1. Preserve server-owned room state.
2. Allow 60 seconds for reconnection.
3. If absent, offer host authority to the designated backup host.
4. Without a backup, nominate the longest-connected active player and require acceptance.
5. Record the transfer publicly.

## 24. Leaving before the game ends

- A player selects **Table Controls → Leave Game**.
- The app previews current stack, total entries and provisional result.
- Default action is **Leave After This Hand**.
- A folded/not-dealt player leaves at the hand boundary.
- A live player finishes the hand normally.
- **Leave Now** is an emergency option that folds the hand at the next legally appropriate moment without returning committed chips.
- At hand end, the final stack is frozen and removed from future deals.
- The player leaves the active seat but remains in settlement and history.

Departure record:

- Player display name.
- Starting value and all approved rebuys.
- Frozen final balance and net result.
- Time of departure.
- Relevant action/correction history.

All devices see a message such as “Alvin left with RM146.” A returning departed player requires a new host-approved entry rather than silently reclaiming the old active stack.

### Host departure

- Host selects **Transfer Host** and chooses a connected player.
- The recipient must accept.
- The transfer is publicly logged.
- Host and Table Controller roles transfer independently.
- The former host then follows the normal leaving workflow.

## 25. Cash games

- Every player begins with the host-configured starting balance unless a late-entry exception is explicitly approved.
- Blinds stay fixed for the session in the first release.
- Players accumulate or lose balances until they leave or the host ends the game.
- Partial cash-out while remaining active is not supported.
- Rebuy requests use player-entered amounts and host approval.
- Currency labels are bookkeeping only.

## 26. Tournaments

### Presets

| Preset | Starting depth | Level length | Approximate intention |
|---|---:|---:|---|
| Quick | 50 BB | 10 minutes | 1–2 hours |
| Standard (default) | 100 BB | 15 minutes | About 3 hours |
| Deep | 200 BB | 20 minutes | 4+ hours |

Recommended Standard example: 10,000 starting chips with `50/100 → 75/150 → 100/200 → 150/300 → break → 200/400 → 300/600 → 400/800 → 600/1,200` and further editable levels.

- A new level takes effect with the next hand, never midway through a hand.
- The Table Controller/host can pause the clock for a scheduled break, dispute or technical issue.
- Freezeout is default; fixed-stack re-entry and late registration are optional setup settings.
- Reaching zero eliminates a player unless re-entry remains available.
- Voluntary withdrawal marks the seat abandoned; future hands are dealt and auto-folded and blinds continue until the stack reaches zero. No tournament chips are destroyed or cashed out.
- The tournament ends when one non-eliminated seat remains.
- Between hands, automatic colour-up/recomposition removes obsolete small denominations while preserving the exact numeric balance.
- Result view shows winner, rankings, eliminations, re-entries, entries and duration.
- Optional external buy-in and prize percentages may be displayed as reference only; no payment is processed.

## 27. Shared table and spectator view

The host can open a read-only public display on a tablet, laptop or TV. It may show:

- Community cards.
- Main and side pots.
- Every public chip balance and current wager.
- Current and previous action.
- Active player.
- D, SB and BB positions.
- Tournament clock and blind level.
- Connection/break status.
- Pot awards and winner animations.
- Join QR code while joining remains open.

It must never show hole cards, recovery tokens, host credentials, private requests or host-only controls. Spectators join through a separate read-only path and never occupy a player seat.

## 28. Ending a cash game and settlement

1. Host selects **End Game**.
2. If a hand is active, the only normal option is **End After This Hand**.
3. Following the final award, balances freeze and all phones switch to portrait settlement.
4. Departed players remain present with frozen balances.
5. Each player sees starting amount, each rebuy, total entered, final balance and net result.
6. The server verifies final balances equal all approved value introduced, all results sum to zero and no pot remains unresolved.
7. Players choose **Looks Correct** or **Report an Issue**.
8. Confirmation is informative, not unanimously blocking, because players may have left.
9. Host corrections require a reason, remain visible, are broadcast and must balance to zero.
10. Finalisation with an unresolved issue is permitted only with a prominent dispute marker in the final record.
11. Reuse Piss Poker's minimum-transfer algorithm to produce instructions such as “Ben pays Aisha RM40.”
12. **Settled** is a shared acknowledgement only; the website does not transfer money.

Exports:

- Screenshot-friendly summary.
- CSV ledger.
- JSON session/hand history.
- Private settlement link retained for 30 days.

Tournament completion uses rankings and optional prize-allocation reference rather than chip-to-currency settlement.

## 29. Audit history

Record meaningful state changes, not UI taps or animations:

- Join, approval, seat and role changes.
- Blinds, actions and street transitions.
- Pot construction and awards.
- Rebuys, re-entries, breaks, departures and reconnect recovery.
- Redo, correction, dispute, pause and void reason.
- Multiple-runout choice.
- Host transfers and settlement edits/finalisation.

Every action carries a room version and unique action identifier. Duplicate/stale actions are rejected without changing state. Private hole cards, recovery secrets and raw shuffle seeds are never included in exported public history.

## 30. Privacy, security and retention

- No account database or unnecessary personal information.
- Device secrets are generated locally and stored server-side only as salted hashes.
- Strict protocol validation, message-size limits, origin allowlist and rate limits.
- Server checks role, turn, legal amount, room version and seat identity for every mutation.
- Room-wide state is separately shaped from each player's private card payload.
- Private responses use `Cache-Control: no-store` and are never written to analytics.
- Gameplay and capability-bearing responses use `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`, HSTS, a restrictive Content Security Policy and `frame-ancestors 'none'`.
- Capability-bearing URLs are never sent to third-party origins.
- Card state covers automatically when the page is hidden.
- A web app cannot prevent a player from photographing or screenshotting their own cards; the product must not claim otherwise.
- Unrevealed digital cards and seed material are deleted at hand completion.
- Active rooms survive brief inactivity/disconnection.
- Final settlement is accessible through an unguessable private link for 30 days.
- Room data and device associations are automatically deleted after that period.
- The host can delete a finalised room sooner after exporting it.
- Wire messages carry protocol and schema versions. Incompatible clients become read-only; refresh prompts occur only between hands. The server supports the previous client version for at least the maximum live-room lifetime or runs a tested state migration.

## 31. Accessibility and Apple-influenced design language

- Calm, deliberate, human-designed visual system; avoid generic gradients, excessive glow, chat-like cards and ornamental “AI” styling.
- Respect safe areas, rounded corners, browser chrome and either landscape direction.
- Frequent touch targets are at least 44×44 CSS pixels.
- Controls remain within comfortable landscape thumb zones.
- Visible focus, keyboard operation and semantic labels for all controls.
- Values and states never rely on colour alone.
- WCAG AA contrast for essential text and controls.
- Reduced Motion replaces chip travel with short fades/state changes.
- Sound and haptics are independently optional; visual feedback always remains.
- VoiceOver and TalkBack announce turn, call amount, chip denomination/count, public action and errors without exposing private cards while covered.
- Text scaling must not obscure the pot, active action or confirmation controls.
- The application remains usable with haptics, sound and animation disabled.
- Every essential gesture has an equivalent labelled control, and no workflow depends on device orientation.

## 32. Reliability and degraded behaviour

- Internet connectivity is required for multiplayer authority.
- Static assets should remain cached, but the app must not accept offline chip mutations that could conflict later.
- If disconnected, freeze action controls, keep the last confirmed public state visible and show reconnection progress.
- Never optimistically display an unconfirmed committed wager as final.
- The static shell detects API/provider failure and shows an offline/capacity notice where possible. Recovery of an active room after provider-level quota exhaustion cannot be guaranteed and must not be promised.
- Screen Wake Lock may be requested during play where supported, with battery guidance and a visible opt-out.

## 33. Free hosting and maintenance plan

Initial production stack:

- Public GitHub repository for source, issues and free standard-runner CI.
- One Cloudflare Worker for static React assets, SPA routes, the API and WebSockets.
- One SQLite-backed Durable Object per room for strongly consistent state and hibernating WebSockets.
- Free `workers.dev` subdomain initially; a custom domain is optional and is the only expected routine cash expense.

As of 19 September 2026, the Cloudflare Workers Free plan documents 100,000 requests/day, five million SQLite row reads/day, 100,000 row writes/day and 5 GB stored data. Hibernation avoids idle Durable Object duration. Current limits must be rechecked before relying on them operationally.

Zero-cost hosting is an initial operating target, not a guarantee. Cloudflare and GitHub can change limits, and maintenance requires human time. Before launch, run a four-hour, ten-device soak and record Worker requests/CPU, Durable Object requests/duration/reads/writes/storage per room. Publish an estimated daily room capacity with a 50% safety margin.

Free-tier controls:

- Retain WebSocket Hibernation API use.
- Handle ping/pong with automatic responses.
- Persist only meaningful state transitions.
- Compact finalised records and enforce 30-day deletion.
- Rate-limit room creation and malformed actions.
- Monitor quota consumption with no paid observability dependency.
- On the free plan, quota exhaustion must fail closed and recover after reset; do not attach automatic paid overage billing.
- Keep short-lived live-room data separate from a compact final-settlement record retained for 30 days, and verify deletion using Durable Object `deleteAll()`.
- Document fresh-account deployment using free Cloudflare and GitHub accounts, Node.js 22, required API tokens/secrets, and no payment method or custom domain.
- Provide one-command local development from a clean clone and document the measured setup time.

Hosting can be zero-cost at personal/modest scale, but maintenance still requires human attention for dependency, browser, security and platform changes.

## 34. State and accounting invariants

The server must verify after every accepted mutation:

- No value is created or destroyed except an explicit approved buy-in/rebuy/re-entry or balanced settlement correction.
- Player stacks + committed wagers + all pots equal total value introduced for the active cash session.
- Denomination presentation always sums to the authoritative stack.
- A player cannot act out of turn or act twice for one room version.
- Every pot's eligible set is correct and nested relative to contribution layers.
- Folded contributions remain in pots but folded players cannot win without an explicit warned host override.
- Uncalled excess returns to the correct player.
- Digital cards are unique within a hand and public/private visibility follows state.
- A room always has at most one host and one current turn.
- Undo/redo never rewinds membership or revives invalid credentials.
- Settlement results sum exactly to zero in integer minor currency units.
- A legal numeric wager is never rejected because of the current visual chip composition.

## 35. Verification requirements

### Automated gates

- Type-check, lint, unit tests, worker/integration tests, end-to-end tests and production build.
- Dependency and licence scan.
- Property/fuzz tests over 2–15 players and mixed stack sizes.
- Digital-deck uniqueness, deterministic shuffle and distribution tests.
- Hand-evaluator test vectors for Hold'em and Omaha.
- Private-state tests proving one player cannot receive another player's cards.
- Tests proving cards/seeds never enter logs, exceptions, analytics, public messages, service-worker caches or exports.
- Capability brute-force/rate-limit, token-rotation, old-WebSocket fencing and security-header tests.
- Durable Object eviction/restart tests during every hand phase; the exact deck and state must resume.
- Protocol-version skew and state-migration tests.
- Accessibility lint plus keyboard-flow tests.

### Required game scenarios

- Heads-up blinds and transition from three players to two.
- Dead-button, late-seat and missed-blind state tables, including entrants between the button and small blind.
- Short big blind, a one-unit raise and repeated small raises that each reopen action under the MEJA52 house rule.
- At least three nested side pots, dead money, tied pots and odd chips.
- PLO pot-limit maximum calculations.
- Manual and automatic chip change with custom denominations.
- Host redo before the next action and rejection after the boundary.
- Physical-card disputed/corrected award and voided hand.
- Digital automatic showdown and host correction log.
- Multiple runouts with main/side pots and insufficient-deck limits.
- Rebuy approval, tournament re-entry and late arrival.
- Break, missed blinds, departure during a hand and host transfer.
- Settlement with a departed player, correction and unresolved dispute marker.
- Refresh, lock/unlock, backgrounding, network switch and seat recovery.
- Host disconnect and automatic nomination flow.

### Real-device acceptance

- Latest two major iPhone Safari and Android Chrome versions, including a supported 320×568 CSS-pixel viewport.
- Fifteen simultaneous phones on an ordinary home internet connection.
- Landscape in both directions and fully operable portrait gameplay/settlement.
- Optional shared tablet/laptop display and spectator.
- Poor Wi-Fi, high latency, brief full outage and reconnection.
- VoiceOver/TalkBack smoke tests, text enlargement, visible focus, contrast and Reduced Motion.
- WCAG 2.2 AA automated and manual checks at 200% text size, keyboard/switch control, and with sound, haptics and animation disabled.
- Verify browser console contains no errors and private card data never appears in public network messages.
- A first-use fifteen-player room can join, seat and start within four minutes; a returning group within two minutes.
- Over a four-hour/500-hand soak, committed actions reach all fifteen devices at p95 within one second on target Wi-Fi, reconnect completes at p95 within ten seconds after network return, and value drift/duplicate actions remain zero.
- Test provider 429/5xx/quota failure, five-minute phone backgrounding, deployment during a room and total host-device power loss.
- From a clean clone and fresh free accounts, the documented local run and deployment succeed without a payment method or custom domain; record actual setup time.

## 36. Phased delivery sequence

The approved specification describes the target product. It is intentionally split into credible releases rather than treating every new subsystem as a first-release extension of Piss Poker.

### Release 1 — dependable physical-card Hold'em cash game

- Fork and rebrand a pinned upstream commit; preserve MIT attribution and resolve dependency/provenance prerequisites.
- Support 2–15 seats, secure capabilities, host recovery, physical-card no-limit Hold'em and server-authoritative numeric accounting.
- Deliver the responsive portrait/landscape chip interface, visual denominations, change-making, rebuys, breaks, departures, host-only redo, governed overrides, physical-card multiple runouts and settlement.
- Include shared public display, history/export, expiry and all relevant release gates.

### Release 2 — tournaments and manual variants

- Add tournament levels, dead-button/absence behaviour, breaks, late registration, fixed re-entry, colour-up, elimination and rankings.
- Add physical-card Dealer's Choice accounting mode.

### Release 3 — digital Hold'em

- Digital Card Mode is committed future scope, not an optional idea or cancelled feature. Release 1 must keep its room-setup entry visible but unavailable and labelled **Later release**.
- Complete the trusted-dealer threat-model review.
- Add persisted private deck state, seat-scoped cards, accessible private-card controls, Hold'em evaluation and privacy tests.

### Release 4 — PLO and digital multiple runouts

- Add Pot-Limit Omaha rules/evaluation and digital repeated runouts with tested deck-capacity limits. Extend the Release 1 physical-runout capacity matrix to PLO.

Each release passes its applicable automated, browser, accessibility, privacy and soak gates and completes a play-money pilot before the next phase begins.

## 37. Release acceptance criteria

Each release must pass every shared criterion and each criterion labelled for that release or an earlier one. Later-phase features do not block an earlier release.

- **Shared:** Fifteen mixed iOS/Android devices complete a full applicable test session.
- **Shared:** No client can directly set a balance, award a pot or access a private resource outside its role.
- **Shared:** Refresh, reconnect, host handoff, redo and void conserve all value.
- **Shared:** Every essential control is operable by touch and keyboard, with visible focus and readable contrast.
- **Shared:** Free-tier quota/expiry behaviour is documented and fails safely.
- **Shared:** The phase's clean-clone local and fresh-account free deployment walkthroughs succeed as documented.
- **Shared:** The website states clearly that it is a bookkeeping/game aid and processes no money.
- **Release 1:** Physical Hold'em side pots pass deterministic vectors; cash settlement balances exactly and includes early departures.
- **Release 2:** Tournament blinds, breaks, sit-outs, late registration, re-entry, withdrawal and eliminations behave as specified.
- **Release 3:** No client can set or retrieve another seat's private card; public display, caches, analytics, errors, exports and logs cannot expose unrevealed cards.
- **Release 4:** PLO pot-limit, PLO hand evaluation, side pots and repeated runouts pass deterministic vectors and deck-capacity tests.

## 38. Deferred work

Branding remains intentionally open: product name, logo, icon, exact typefaces and final colour palette. These must follow the approved Apple-influenced, non-AI-looking design direction without changing the workflows in this specification.

The later rules modules in section 6 and a future zero-trust digital dealing protocol are outside the four approved releases. Implementation-level decisions must be captured in architecture decision records and may not weaken the security, accounting, accessibility or workflow requirements here.

## 39. Primary references

- [Piss Poker repository and MIT licence](https://github.com/KarthikSubramanian07/Piss-Poker)
- [Poker Tournament Directors Association rules](https://www.pokertda.com/view-poker-tda-rules/)
- [PokerStars Texas Hold'em rules](https://www.pokerstars.com/poker/learn/lesson/texas-holdem-rules/)
- [PokerStars poker-variant catalogue](https://www.pokerstars.com/poker/games/)
- [PokerStars tournament rules](https://www.pokerstars.com/poker/tournaments/rules/)
- [Apple game-control guidance](https://developer.apple.com/design/human-interface-guidelines/game-controls)
- [Apple context-menu guidance](https://developer.apple.com/design/human-interface-guidelines/context-menus)
- [WCAG 2.2 — Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)
- [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage)
