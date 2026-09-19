# Player Table — First Comp Brief

Status: Pre-selection comp approved; staged-state workflow approved
Workflow: Impeccable comp-first; no production UI code before approval

## Job and audience

A seated cash-game player looks down at their phone during a face-to-face physical-card Hold'em game. The screen must immediately answer: whose turn is it, what is owed, how many chips do I have, and how do I prepare and commit a wager? Surface mode: **Operate**.

## Outcome and proof

The first comp must prove that the phone feels like the player's physical edge of the poker table rather than a calculator or online-poker dashboard. Chips—not numeric inputs—are the primary interaction. The active-turn state must be unmistakable without flashing or relying on colour alone.

## Selected direction

Use the approved **Precision Card Room** direction and binding anti-slop rules. Show the same realistic, explicitly synthetic RM1/RM2 Hold'em hand in two landscape phone frames:

1. **Waiting:** dark ink surface, “Waiting for Maya,” current pot and last public action, player's balance and chip rack available without betting controls.
2. **Your Turn:** warm-white surface, dark text, explicit “Your Turn,” call amount, legal actions and a prepared-wager area leading toward the pot.

The focal moment is the prepared chips sitting just below a restrained betting line, ready to be pushed or committed with a labelled button.

## Scope and boundaries

- One high-fidelity comparison comp containing waiting and active-turn landscape states at 844×390 CSS-pixel proportions.
- Physical Card Mode, Release 1, cash game, no hole cards or digital community cards.
- Demonstration state: 5 currently seated players in a room capable of 15; RM1/RM2 blinds; player's balance RM245; pot RM84; RM10 to call.
- Include chip rack, pot, balance, turn/status, Fold, Call RM10, Raise To, Clear/commit affordance and collapsed Table Controls handle.
- Do not design the lobby, settlement, shared display or portrait adaptation in this comp.
- No application source code, production components or backend changes.

## Interaction and layout

- The phone's top edge faces the physical table: public pot/status live there.
- The middle is open working space with a subtle betting line and staged chips.
- The bottom is the player's rack, reachable by both thumbs.
- Tapping chips stages them; staged chips can be dragged back or cleared; pushing across the line or pressing a labelled commit control submits the action.
- Waiting state removes the temptation to act while keeping public state and personal rack legible.
- Use one clear visual hierarchy, restrained squircle-like control shapes, tabular numerals and no nested cards, glow, glass or decorative gradient.

## States the later implementation must cover

Empty wager, staged wager, legal check, amount owed, minimum raise, all-in, stale action, rejected action, disconnect/reconnect, reduced motion, 200% text and portrait fallback. The first comp concentrates on waiting and ordinary call/raise states; it may not invent away the later states.

## Approval gate

Approval of this brief authorises creation of the image comp only. The rendered comp will be presented for a second explicit approval before production UI code begins.

## Comp decision

The owner initially selected **Option 1 — Table Edge** on 2026-09-19 for its composition: a horizontal betting line, an open central wager area, and a full-width lower chip/action zone. The owner then rejected its visual finish as too inexpensive-looking. Version 1 is superseded and no longer approved.

Version 2.1 kept the Table Edge composition but displayed `Call RM10` and `Place RM10` simultaneously as controls. The owner correctly identified that their relationship was ambiguous.

The owner approved a two-stage call workflow on 2026-09-19. Before staging, the legal actions include `Fold`, `Call RM10`, and `Raise`. Selecting `Call RM10` stages the exact chips without committing. In the staged state, the choices are replaced by non-interactive status `Calling RM10`, `Clear`, and the sole commit action `Place RM10`; dragging the chips across the betting line is an equivalent commit gesture. Version 2.2 visualises this staged state and requires explicit visual approval before implementation.

Version 2.3 is the companion pre-selection comp. It shows the same active turn before any chips are staged: the betting field is empty and the action rail presents `Fold`, `Call RM10`, and `Raise`. No `Place…` control appears until a wager exists.

The owner approved the Version 2.3 pre-selection comp on 2026-09-19 and confirmed Apple, Porsche, Bang & Olufsen and Linear as the binding project-wide reference set.
