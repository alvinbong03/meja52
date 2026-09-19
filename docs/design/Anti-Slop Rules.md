# Anti-Slop Interface Rules

Status: Approved and binding
Recorded: 19 September 2026
Applies to: Digital Poker Table web application

## Principle

“AI slop” is not one colour, font or component. It is an interface assembled from fashionable defaults without evidence from the product's real setting. Rounded corners, gradients and cards are not automatically bad; using all of them reflexively, without hierarchy or purpose, is.

The Digital Poker Table must look designed for friends handling chips around a real table. It must not resemble a SaaS dashboard, crypto casino, AI chat product or generic landing-page template.

## Binding rules

### 1. Start from the task, not a template

- Every screen has one dominant job and one visually dominant action.
- Gameplay hierarchy follows the real table ritual: pot and amount owed, prepared wager, chip rack, then secondary controls.
- Do not import dashboard conventions merely because the product contains numbers.
- Do not use the standard centred hero followed by three equal feature cards.

### 2. Containers must express structure

- Do not place every section inside a rounded card.
- Never nest decorative cards inside cards.
- Prefer spacing, alignment, dividers and background changes before adding a container.
- Sheets and dialogs are reserved for temporary secondary work such as rebuy, leave, history and host controls.
- Pills are for compact statuses or mutually exclusive choices, not ordinary buttons, headings or paragraphs.

### 3. Colour must carry meaning

- No decorative purple-to-blue, aurora or mesh gradients.
- No neon glow, cyan-on-charcoal “futuristic” styling or indiscriminate glassmorphism.
- Do not use pure black, pure white or neutral grey everywhere; use deliberately tinted surfaces.
- Waiting state uses dark ink; the current player's turn uses warm white, reinforced by text and controls.
- Denomination colours belong to chips. Interface red is reserved for destructive actions and must not be the only fold signal.
- Gradients are permitted only when they describe an object or state, such as restrained chip depth—not as background decoration.

### 4. Typography must be deliberate

- Do not default to Inter, Geist, Roboto, Arial or a novelty serif merely because they are familiar generator defaults.
- Use one purposeful interface family with tabular numerals and a small, documented type scale.
- Avoid giant marketing headings inside the game.
- Avoid italic-serif “premium” flourishes, gradient text and all-caps overuse.
- Currency, pot and wager values prioritise legibility over personality.

### 5. Controls must feel precise

- Every essential action has a visible label; icons supplement rather than replace unfamiliar poker actions.
- Avoid generic rounded-square icon tiles above headings.
- Use at least 44×44 CSS-pixel targets and clear pressed, disabled, loading, success and error states.
- Every drag, swipe, hold or slide has a labelled tap/button equivalent.
- Do not hide a common action solely inside a gesture, long press, hover or context menu.

### 6. Motion must explain causality

- No bounce, elastic overshoot, ambient pulsing or automatic fade-up sequences.
- Use short, restrained easing to show chips moving from rack to wager to pot, a sheet opening, or a state being committed.
- Nothing moves only to make the interface feel “alive.”
- Respect Reduced Motion and retain complete visual feedback without animation.

### 7. Copy must sound like a table, not a chatbot

- Use short, literal poker language: **Call RM10**, **Raise to RM30**, **Flop Dealt**, **Break Chip**.
- Explain an unfamiliar role or control in one sentence, as approved in the product specification.
- Avoid vague motivational headlines, excessive friendliness, “unlock,” “supercharge,” “seamless,” and unnecessary exclamation marks.
- Errors state what happened, whether the wager was committed, and what the player can do next.

### 8. Visual craft must come from the product

- Chips are the main designed objects. Their values, edge patterns, stacking and movement should feel specific and recognisable.
- Use bespoke or carefully selected functional icons rather than emojis or a mismatched icon library.
- Do not add fake testimonials, invented activity, ornamental charts, abstract blobs or stock casino imagery.
- One memorable material idea carried consistently is stronger than several unrelated effects.

### 9. Responsive design is not a shrunken desktop

- Landscape is the preferred table-edge composition; portrait remains fully operable.
- Respect notches, safe areas, browser chrome, thumb reach, text enlargement and both landscape directions.
- Never solve overflow by shrinking essential text below a readable size.
- Shared display and settlement are separate compositions, not stretched versions of the phone game screen.

### 10. Accessibility is part of the visual system

- Never communicate turn, denomination, connection or error state using colour alone.
- Maintain WCAG 2.2 AA contrast for essential text and controls.
- Provide visible focus, keyboard/switch operation and screen-reader labels.
- Covered digital cards stay out of the accessibility tree until the player deliberately requests them.
- The design remains usable with sound, haptics and animation disabled.

### 11. States are designed, not appended later

Every important surface must cover loading, empty, waiting, active, disconnected, stale action, rejected action, host correction, success and recovery states. A polished happy path beside generic browser errors is unfinished.

### 12. Review against evidence

- Maintain explicit design tokens and reusable components rather than page-level improvisation.
- Review real 320×568 portrait and 568×320 landscape layouts, not only large mockups.
- Run Impeccable's detector after UI edits, then complete a human critique for hierarchy, context and emotional fit.
- Test with real poker scenarios and let observed confusion change the design.

### 13. Approval controls implementation

- Use Impeccable for every applicable UI/UX shaping, critique, adaptation, hardening and polish pass.
- Present UI/UX designs to the owner before implementing them as production interface code.
- Approval of a workflow or product requirement is not approval of its visual implementation.
- If implementation needs to depart materially from an approved design, stop and obtain approval for the revision.

## Product-specific visual guardrails

- Recommended visual world: **Precision Card Room**—quiet, tactile and exact.
- Waiting surface: tinted ink, not pure black.
- Active-turn surface: warm white, not a flashing inversion.
- Controls: restrained squircle-like corners; avoid pill-shaped everything.
- Depth: concentrated on chip stacks and temporary sheets; the base interface stays flat and calm.
- Settlement: portrait ledger/list with direct relationships, not a grid of result cards.

## Sources consulted

- [Impeccable repository and anti-pattern guidance](https://github.com/pbakaus/impeccable)
- [Impeccable design workflow](https://impeccable.style/docs/shape/)
- [Apple Human Interface Guidelines — layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Apple Human Interface Guidelines — colour](https://developer.apple.com/design/human-interface-guidelines/color)
- [Apple Human Interface Guidelines — game controls](https://developer.apple.com/design/human-interface-guidelines/game-controls)
- [Web-design discussion: preventing the AI-slop look](https://www.reddit.com/r/webdesign/comments/1uhuovu/preventing_the_ai_slop_look/)
- [UI-design discussion: why individual patterns are not automatically slop](https://www.reddit.com/r/UI_Design/comments/1w70kqb/question_about_websites_looking_like_ai_slop/)
