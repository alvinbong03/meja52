# Raise Workflow — Comp Brief

Status: Raise builder/staged v3 approved by owner
Workflow: Impeccable comp-first; no production UI code before approval

## Purpose

Let a player create a legal raise quickly while preserving the feeling of handling chips. Presets accelerate common amounts, but the chip rack remains the primary physical interaction and the screen must not resemble a calculator.

## Demonstration state

- No-limit Hold'em cash game.
- Pot before the player's action: RM84.
- RM10 to call; the prior full bet/raise increment is RM10; the player has no earlier contribution on this street.
- Therefore minimum raise-to is RM20.
- Illustrative shortcuts use server-calculated exact amounts: minimum RM20, half-pot raise-to RM57, pot raise-to RM104 and all-in RM245.

The server calculates these values from authoritative state. The UI never asks the player to perform poker arithmetic.

## Comparison comp

Show two warm-mineral active-turn landscape screens:

1. **Raise builder, empty:** `Raise to`; `RM20 minimum`; the open wager field; one utility row with `Back` at the left and the instruction `Tap chips or choose a shortcut.` centred; quiet shortcuts `Min RM20`, `½ pot RM57`, `Pot RM104`, `All-in RM245` and `Custom — Type amount`; full chip rack; no Place button because nothing is staged. Selecting Custom reveals direct numeric entry; no keypad or input is visible beforehand.
2. **Raise staged:** RM25 and RM5 chips are staged below the betting line. On the status row, `Clear` sits at the far-left utility position while the non-interactive `Raising to RM30` status remains centred above the primary action. The compact `Place RM30` button is centred directly beneath it. The rack counts update to reflect the staged chips. Tapping further rack chips continues adjusting the amount.

Dragging the staged chips across the betting line is equivalent to pressing Place.

## Visual rules

- Apple: one primary action only after a valid amount exists; clear state transition and 44px targets.
- Porsche: exact alignment, consistent shortcut spacing and authoritative numerals.
- Bang & Olufsen: chips carry the tactile richness; controls remain quiet and materially restrained.
- Linear: compact shortcuts, minimal chrome and no redundant framing lines.
- Keep the actual betting line. Do not frame the shortcut or action rows between decorative top/bottom rules.
- No slider as the primary input, numeric keypad, calculator field, colourful preset tiles, pills, dashboard cards, glass, glow or casino styling.
