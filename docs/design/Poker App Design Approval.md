# Poker App Design Approval

Status: Approved by owner
Date: 19 September 2026

Approval received: 19 September 2026
Approved amendment: maximum 15 active players.
Approved Impeccable workflow: **comp-first**.

The decisions below are approved as the design brief. Every resulting UI/UX design must still be shown to and approved by the owner before production interface code is written.

## Recommended approval package

1. **Product surface** — Browser-based responsive web app; no download required. Landscape is preferred during play, with a complete portrait fallback.
2. **Release boundary** — Design Release 1 first: physical-card no-limit Hold'em cash games for 2–15 players. Later releases remain in the product specification but do not expand the first design pass.
3. **Visual direction** — **Precision Card Room:** quiet, tactile, exact and recognisably built for an in-person poker table.
4. **Turn contrast** — All waiting players, including the host, use Batik Indigo. The active player's entire gameplay surface becomes deep Hibiscus Ink with Batik Ivory text, a visible **Your turn** label and optional haptic/sound cue.
5. **Colour approach** — Restrained neutral interface with colour concentrated in real chip denominations and state feedback; no decorative gradients, glassmorphism, neon glow or casino-felt cliché.
6. **Typography** — Start with the open-source Public Sans family and tabular numerals; validate it in mockups before freezing the design system.
7. **Chip treatment** — Tactile two-dimensional chips with printed values and edge patterns, shallow physical depth and compact stacked counts; no photorealistic 3D casino render.
8. **Interaction model** — Tap chips into a wager, drag or press **Commit Bet**, with visible buttons for every gesture. Secondary actions stay in one retractable Table Controls sheet.
9. **Setup and settlement** — Portrait, one-decision-at-a-time room setup; circular seating confirmation; portrait settlement using Piss Poker's minimal-transfer approach.
10. **Technical direction** — React 19, TypeScript and Vite; CSS Modules plus design tokens; Cloudflare Worker with one SQLite Durable Object per room and hibernating WebSockets; Vitest and Playwright.
11. **Hosting direction** — Migrate the upstream split Pages/Worker deployment to one Cloudflare Workers application serving static assets and the API, subject to a small migration proof before committing the architecture.
12. **Design quality rule** — Treat [Anti-Slop Rules.md](Anti-Slop%20Rules.md) as binding. Use Impeccable whenever applicable, run its automatic detector plus manual visual review, and obtain owner approval for every UI/UX design before implementing production UI code.

## What remains after approval

Approval authorises design work, not the complete production build. The next design stage will:

1. Initialise Impeccable's `PRODUCT.md` from the approved product specification.
2. Use the approved **comp-first** Impeccable workflow: an image-based visual comp sets the bar, the owner approves it, and only then may implementation begin.
3. Shape four Release 1 surfaces: room setup/invite, seating lobby, waiting gameplay, active-turn gameplay and settlement.
4. Produce phone portrait/landscape wireframes and one shared-display layout.
5. Review the flows with the owner before implementing the production interface.

## Simple approval wording

> I approve the recommended approval package in Poker App Design Approval.md.

Any exception should name the item number and the preferred replacement.

## Approved gameplay refinement — 19 September 2026

- Public live-hand rows show only each player's current-street bet; they never expose another player's remaining balance.
- Each player privately sees their own remaining balance and cumulative amount committed in the hand.
- Phone landscape uses a compact, clockwise, horizontally scrollable bet rail. Non-zero bets appear by default; tapping Pot reveals the complete current-street breakdown.
- All waiting roles use Batik Indigo. Only the active player's own screen uses Hibiscus Ink.
- Chip faces retain their approved shape, depth and denomination colours, with solid centres so edge markings never obstruct values.
- MEJA52 uses a deliberate house rule: any whole-unit amount above the current table bet is a legal raise and every such raise reopens action.
- The private bottom control deck uses Denim Lift over Batik Indigo while waiting and Hibiscus Lacquer over Hibiscus Ink during the active turn. It remains one contiguous surface with a restrained ivory hairline; individual actions do not receive decorative coloured panels.
