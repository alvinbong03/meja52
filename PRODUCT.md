# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Owner-approved direction: React 19, TypeScript and Vite for the browser client; CSS Modules and explicit design tokens for presentation; a Cloudflare Worker with one SQLite Durable Object per room and hibernating WebSockets for server-authoritative realtime state; Vitest, the Cloudflare Workers test pool and Playwright for verification. Prove the migration from the inherited split Pages/Worker deployment to one Workers application serving static assets and API before committing it.

## Users

The primary users are groups of 2–15 friends playing poker face-to-face around one physical table. Each seated player normally has an iPhone or Android phone. A host creates and manages the room; a Table Controller coordinates physical dealing; an optional spectator/shared display shows public state.

Players need to handle bets, chip balances and pots without owning enough physical chips, while preserving the conversation, visibility and physical ritual of an in-person game.

## Product Purpose

Replace physical poker chips with a free, account-free browser experience that makes each phone feel like the player's edge of a real poker table. The product manages legal betting, pots, attendance, recovery and settlement. Later releases may also deal digital cards.

Success means a 15-player mixed-device group can join quickly, complete a session without value drift or private-state leakage, recover from ordinary phone/network interruptions and finish with an exact, understandable settlement.

## Positioning

Unlike a ledger-style chip counter or conventional online poker client, the product combines server-enforced poker accounting with tactile chip-building interactions for people who remain together at a physical table. Physical cards remain a first-class mode rather than an incomplete fallback.

## Operating Context

- No installation or app-store account is required; players open a link or scan a QR code.
- Gameplay occurs on phones around a physical table, often on ordinary home Wi-Fi with devices locking, rotating or briefly disconnecting.
- The host creates the room, chooses the game settings, arranges digital seats to match physical seats and starts play.
- Physical Card Mode uses a real deck. Digital Card Mode is a later release with private hole cards and public community cards.
- Gameplay prefers landscape because it resembles a table edge, but every workflow remains operable in portrait.
- Cash settlement returns to portrait and provides a minimum-transfer ledger; the service never transfers or holds money.

## Capabilities and Constraints

- General capacity: 2–15 active seats. Variant mathematics may lower the cap; single-deck Omaha supports at most 11 active players.
- Release 1 is physical-card no-limit Texas Hold'em cash play. Tournaments/manual variants, digital Hold'em, then PLO/multiple runouts follow in separately gated releases.
- Digital Card Mode is committed Release 3 scope, not cancelled. Keep its room-setup choice visible but disabled and labelled `Later release` until the Release 3 privacy, security and verification gates pass; follow `docs/product/future-release-handoff.md`.
- Rooms use a four-letter locator plus scoped cryptographic capabilities; codes alone are not access control.
- The server owns all committed state and validates turn, role, amount and room version.
- Balances use integer smallest units. Visual chip denominations can never prevent a legal numeric wager.
- The service processes no deposits, withdrawals, rake or real-money payment.
- Current upstream code is MIT-licensed Piss Poker and hard-codes a ten-player maximum. Fifteen-player engine, protocol, layout, load and real-device support are required new work.
- Internet access is required for multiplayer authority. Free Cloudflare hosting is an operating target, not a guarantee.
- Use Impeccable whenever it applies to UI/UX shaping, critique, adaptation, hardening and polish.
- Every UI/UX design requires explicit owner approval before it is implemented as production interface code. A material implementation departure requires renewed approval.

## Brand Commitments

- Owner-approved working name: MEJA52. The exact wordmark and app icon remain subject to comp approval before production UI implementation.
- The interface must feel clean, deliberate and Apple-influenced without copying Apple assets or becoming a generic mobile settings screen.
- Every surface must be evaluated against the owner-approved four-brand reference set: Apple for clarity, hierarchy and touch ergonomics; Porsche for grid precision, consistency and purposeful controls; Bang & Olufsen for tactile material craft and restraint; Linear for calm information hierarchy and receding secondary chrome. These are principles, never assets or templates to copy.
- It must not resemble a SaaS dashboard, crypto casino, AI chat product or generic AI-generated template.
- Waiting players use a dark interface; the active player's surface becomes warm white, reinforced by text and controls rather than colour alone.
- Chips are the primary interactive objects. Poker controls use direct terminology and receive concise one-sentence explanations where unfamiliar.
- The approved anti-slop rules at `docs/design/Anti-Slop Rules.md` are binding.
- The durable visual system in `DESIGN.md` and the research in `docs/design/Premium Visual References.md` are binding for all later comps and UI implementation.

## Evidence on Hand

- Approved product and engineering specification: `docs/product/product-specification.md`.
- Independent specification review: `docs/product/specification-review.md`.
- Approved design decisions: `docs/design/Poker App Design Approval.md`.
- Binding anti-slop rules: `docs/design/Anti-Slop Rules.md`.
- Market comparison and verification notes: `docs/product/market-research.md` and `docs/product/verification-log.md`.
- Inherited open-source implementation and tests in this repository; preserve its MIT licence and copyright notice.
- No final brand name, logo, production customer evidence or usage claims exist. Future work must not fabricate them.

## Product Principles

1. Preserve the social, physical table experience rather than recreating remote online poker.
2. Make chip handling tangible while keeping numeric accounting exact and server-authoritative.
3. Keep ordinary play fast; make exceptions correctable, publicly understandable and auditable.
4. Prefer secure, private and recoverable behaviour over hidden convenience.
5. Design for real phones, real interruptions and all 15 seats before claiming readiness.

## Accessibility & Inclusion

- Meet WCAG 2.2 AA for essential text, controls and workflows.
- Do not rely on colour, sound, haptics, motion, gestures or orientation alone.
- Provide visible focus, keyboard/switch operation, screen-reader semantics and labelled alternatives for every essential gesture.
- Support portrait and both landscape orientations, safe areas, a 320×568 CSS-pixel viewport and 200% text enlargement.
- Covered digital cards remain outside the accessibility tree until deliberately revealed; private spoken output warns the player to use headphones.
