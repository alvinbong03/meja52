# Table Controls — First Comp Brief

Status: Player-controls v1 approved by owner
Workflow: Impeccable comp-first; no production UI code before approval

## Job and audience

A seated player needs room information and occasional controls without turning the live poker surface into a settings screen. Surface mode: **Operate**.

## Outcome and proof

Show that the small bottom-edge handle expands into a calm, premium control sheet. Live hand information remains visible above it, while room configuration and secondary actions become easy to find, understand and dismiss.

## Binding design references

- Apple: sheet behaviour, action hierarchy, touch targets and clear labels.
- Porsche: exact two-column grid, consistent row geometry and restrained contrast.
- Bang & Olufsen: tactile handle and finely treated surface edge.
- Linear: secondary tools recede, descriptions clarify unfamiliar actions and density remains calm.

The project `DESIGN.md`, premium-reference research and anti-slop rules are binding.

## Comparison comp

Show two landscape states at 844×390 proportions:

1. **Collapsed:** the approved dark waiting player table with the discreet centred `Table controls` handle.
2. **Expanded — player view:** keep the top live-state band visible and raise a solid graphite sheet from the bottom. Do not use glass or blur.

## Expanded content

- Header: `Table controls`, a concise close affordance and personal status `Alvin · RM245`.
- Room summary: `RM1 / RM2 · Cash game · Physical cards` with `Room details` and the description `View the rules and table setup.`
- `Request rebuy` — `Ask the host to add chips.`
- `Take a break` — `Sit out after this hand.`
- `Hand history` — `Review every committed action.`
- `Accessibility` — `Adjust motion, contrast and sound.`
- `Leave table` — `Record your balance for settlement.` This is destructive but not visually loud until selected.

Host-only controls such as transfer host, undo and end game are deliberately deferred to a separate host-state comp.

## Boundaries

- No room-setting values remain on the collapsed play surface.
- Do not show a modal, floating card grid, colourful icons, casino decoration or dashboard tiles.
- Rows may use restrained separators and consistent right chevrons; descriptions must remain readable in landscape.
- Essential controls meet 44×44 CSS-pixel targets and remain understandable without colour.
