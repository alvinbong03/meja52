# Design System Direction

Status: Owner-approved durable visual direction
Last confirmed: 2026-09-19

## Governing world

The product is a **Precision Card Room**: each phone feels like the player's carefully made edge of a real table. The interface is quiet and exact; chips carry the physical character. It must feel premium through proportion, typography, material discipline and interaction—not decoration.

## Binding reference set

Every surface and state must be designed and reviewed against all four references:

- **Apple:** clarity, a disciplined action hierarchy, familiar touch ergonomics, generous spacing, explicit state feedback and accessible targets. Borrow principles only; do not imitate branded components or Liquid Glass.
- **Porsche:** strict grid alignment, consistent component geometry, purposeful controls, restrained monochrome contrast and systematic tokens.
- **Bang & Olufsen:** tactile material honesty, refined edge treatment, a small palette and emotionally satisfying physical interaction. Chips are the main material objects.
- **Linear:** calm density, predictable action placement, secondary chrome that recedes and careful treatment of typography, icon weight and inactive contrast.

Full source links and translations are recorded in `docs/design/Premium Visual References.md`.

## Surface language

- The owner-approved, independently audited palette is **Batik Indigo and Hibiscus**: Batik Indigo `#203554`, Denim Lift `#2C4564`, Batik Ivory `#F3EEE4`, Porcelain `#FBF7EF` for QR paper only, Hibiscus Lacquer `#B33A46`, Hibiscus Ink `#92313B`, Pewter Mist `#C7C8C2`, Muted Batik `#56627A`, and Host Claret `#5A2538`. Use solid colour relationships; do not introduce blue–purple gradients, electric cyan, glow, orange/cream startup palettes, or generic slate-grey surfaces.
- Brand and application icons use the same indigo body, mineral-ivory mark, and hibiscus detail so they belong to the homepage without becoming miniature decorative scenes.
- Waiting and non-active play use Batik Indigo. The active turn uses Batik Ivory with indigo text; never stark white, black, or casino green.
- The host uses Host Claret while waiting so the table can identify the current host without opening controls. When it is the host's turn, the surface uses the same Batik Ivory as every active player while retaining a visible `Host` label.
- Hibiscus Lacquer is the restrained state/accent colour, with Hibiscus Ink reserved for accessible accent text on light surfaces. Chip denominations retain their semantic colours.
- Use tabular numerals for money, pots, wagers and stacks.
- Use a cross-platform system sans stack for zero-cost delivery and native familiarity. Hierarchy comes from size, weight and spacing rather than display-font theatrics.
- Interface chrome stays flat: hairlines and restrained elevation only. Chips alone may have richer ceramic depth and edge detail.
- Controls use 12–14px radii; capsules are limited to genuinely compact controls. Do not make every object a pill.
- One action per view receives dominant treatment. Secondary actions remain legible but quiet.
- Related poker actions are grouped primarily through alignment, proximity and consistent invisible hit areas. Avoid framing an action row between redundant top and bottom rules; retain only boundaries that communicate an actual region such as the betting line.

## Interaction language

- Chips are directly tappable and draggable. Every gesture has a labelled control alternative.
- Before a wager is staged, show legal actions. After staging, replace choices with inferred action status, Clear and one exact Place action.
- Crossing the betting line and pressing Place are equivalent commits.
- Table Controls is a retractable sheet. Room configuration and secondary actions never compete with live play.
- Table Controls is role-specific: ordinary players receive the approved player sheet; hosts receive a dedicated `Host` section. Do not add a Player/Host tab switch to the host sheet.
- Use short, literal labels and a one-sentence description when a role or action could be unfamiliar.

## Refusals

No bright default blue, decorative gradients, glow, glass, crypto/casino gold, felt textures, dashboard tiles, nested cards, oversized pills, fake 3D chrome, arbitrary shadows, decorative iconography or AI-template composition. Follow `docs/design/Anti-Slop Rules.md`.
