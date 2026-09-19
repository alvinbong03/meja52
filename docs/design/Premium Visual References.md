# Premium Visual References

Status: Owner-approved binding reference set for the full product
Recorded: 2026-09-19

These references are principles, not templates. The app must not copy brand assets, logos, signature trade dress, or proprietary components.

## Apple — clarity and action hierarchy

References:

- [Apple Human Interface Guidelines: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [Apple UI Design Dos and Don’ts](https://developer.apple.com/design/tips/)

What to borrow:

- A view should have only one or two prominent actions, with one unmistakable primary action.
- Touch targets must be at least 44 × 44 points, with visible pressed, disabled, loading, and focus states.
- Controls sit close to what they modify, and spacing and alignment explain relationships.
- Labels should state the action plainly; decoration should never compete with content.

Application here: `Place RM10` is the sole visually dominant button. Fold, Call, Raise, and Clear remain clear but quieter. Apple’s structure is used as a quality bar; the interface will not imitate iOS or Liquid Glass.

## Porsche — precision, consistency, and purposeful controls

References:

- [Porsche Design System](https://designsystem.porsche.com/v3/)
- [Porsche Design System open-source overview](https://opensource.porsche.com/blog/porsche-design-system)

What to borrow:

- A disciplined grid, repeatable component geometry, and restrained monochrome palette create premium consistency.
- Controls should remain functional, accessible, responsive, and predictable before they become expressive.
- Every surface, spacing value, focus state, and motion pattern should come from shared tokens rather than ad-hoc styling.

Application here: the top status, pot, and balance share one strict baseline; the action dock uses one geometry and fixed touch heights; the chip materials carry expression while the UI remains quiet.

## Bang & Olufsen — material honesty and tactile restraint

References:

- [Bang & Olufsen: All about aluminium](https://www.bang-olufsen.com/en/ca/story/all-about-aluminium)
- [Bang & Olufsen: Beosound A5 design story](https://www.bang-olufsen.com/en/int/story/gamfratesi-studio)

What to borrow:

- Premium character comes from precise material treatment and detail, not decorative effects.
- Functional, honest forms can still feel emotional when texture, edge treatment, and interaction are deliberate.
- Use a small number of carefully finished materials and let them age visually well.

Application here: chips are the only richly dimensional objects. Their ceramic faces, edge marks, and shallow stack depth should feel tactile; surrounding controls remain flat and restrained.

## Linear — calm hierarchy and receding chrome

References:

- [Linear: A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh)
- [Linear: How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui)

What to borrow:

- Supporting navigation and controls should not compete for attention they have not earned.
- Consistent headers and predictable action positions improve orientation.
- Small details—icon weight, spacing, inactive contrast, alignment—create calm more effectively than visual effects.

Application here: room configuration, host tools, rebuys, leave, and undo move into the collapsed Table Controls sheet. The play surface shows only live hand information and actions.

## Binding direction for Table Edge v2

- Preserve the Table Edge layout; replace its visual language.
- Remove blinds, currency setup, card mode, and other room configuration from the upper-left. These belong inside Table Controls.
- Use deep graphite for waiting and warm mineral ivory for the active turn; avoid stark black/white and bright system blue.
- Use one restrained oxblood accent for turn status, selected action, and red chip relationships—not as general decoration.
- Keep exactly one dominant commit control. Secondary actions are quieter and aligned within one low-profile dock.
- Use tabular numerals and a cross-platform system font stack for familiarity and zero hosting cost.
- Chips carry the material craft; interface chrome is mostly flat, with hairlines and minimal elevation.
- No gradients, glass, glow, casino gold, felt textures, nested cards, dashboard tiles, or oversized capsules.
