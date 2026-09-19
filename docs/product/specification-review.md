# Digital Poker Table — Independent Specification Review

Review date: 19 September 2026
Review status: Complete for the original ten-player scope; corrections incorporated into [Product Specification.md](Product%20Specification.md). The later owner-approved 15-player amendment awaits targeted validation.

Post-correction independent re-review: **PASS — no blocker-level defects remained in the reviewed ten-player scope.**

## Review scope

An independent agent reviewed the draft for poker correctness, workflow smoothness, contradictions, missing edge cases, security/privacy, accessibility, reuse feasibility, free hosting and testability. The review was adversarial: it was asked to find reasons the proposal should not yet be treated as a build contract.

## Verdict

The draft had strong breadth and accounting/recovery coverage, but it mixed the long-term product with an unrealistic first release and contained six blockers. All six were resolved in the final specification. The project is ready for implementation planning, beginning with Release 1; this does not mean the complete four-release product is quick or already supplied by Piss Poker.

## Blockers found and resolved

| Finding | Resolution in the final specification |
|---|---|
| A shuffle commitment could not be verified without revealing folded cards, while deleting its seed made it meaningless. | Removed the misleading commitment claim. Digital dealing is explicitly server-trusted; the threat boundary, private persisted deck, seat-scoped delivery, deletion and restart tests are defined. |
| Four-letter codes are enumerable and upstream's host/join model is not sufficient access control. | Codes are locators only. Added separate host/player/spectator/settlement capabilities, manual-join approval, rate limits, recovery quorum, token rotation and old-socket fencing. |
| Landscape-only gameplay would exclude some users and conflict with WCAG orientation guidance. | Landscape remains preferred, but portrait is fully operable and the rotate prompt is dismissible. Added portrait, zoom and assistive-technology gates. |
| Tournament withdrawal destroyed chips and contradicted conservation. | Withdrawal now abandons the seat; auto-folding and blinds continue until elimination, so value is conserved. |
| Visual denominations could reject a legal numeric poker action. | Integer smallest-unit accounting is authoritative. The rack deterministically recomposes and can show a remainder token; visual inventory never limits a legal wager. |
| The proposed first release was far larger than the young upstream project could credibly support. | Split delivery into four releases: physical-card Hold'em cash, tournaments/manual variants, digital Hold'em, then PLO/multiple runouts. Added provenance, SBOM, ten-seat and deployability prerequisites. |

## Important improvements also incorporated

- Adopted the dead-button method, specified cumulative short-all-in reopening and added the PLO pot-limit formula.
- Defined timeout behaviour and clarified that Manual/Dealer's Choice is an accounting mode, not a complete rules engine.
- Kept the user's flexible host pot-award control but labelled rule-breaking edits as Administrative Ledger Overrides requiring a reason and independent approval.
- Defined a deck-capacity formula and test matrix for multiple runouts.
- Added a private, headphone-aware screen-reader path for digital hole cards and button alternatives for every gesture.
- Reframed zero-cost hosting as a measured operating target, not a guarantee; added soak-based capacity estimates, provider-failure behaviour and clean-account deployment checks.
- Added protocol-version compatibility, tournament colour-up, faster advisory seat confirmation and measurable performance/reliability/security criteria.

## Independent caution retained

Piss Poker is MIT-licensed and useful, but it was a very young, single-contributor prototype at review time. Its passing type-check, 47 unit tests and production build are encouraging—not proof of production maturity. Secure capabilities, private digital-card delivery, tournaments, PLO, the new interface, retained settlement and most advanced workflows are new engineering work.

Cloudflare Pages, Workers and SQLite Durable Objects can fit within documented free tiers at modest usage as of the research date. Free operation is not guaranteed: quotas and terms can change, and human maintenance remains necessary. The release gate therefore requires a four-hour ten-device soak, a 50% capacity margin and a fresh-account deployment without payment details or a custom domain.

## Final recommendation

Proceed with Release 1 only: physical-card no-limit Hold'em cash games for 2–15 players. This owner-approved increase from the independently reviewed ten-player scope requires new 15-seat engine, protocol, layout, load and device testing. Preserve the later approved workflows in the target specification, but do not begin digital cards, tournaments or PLO until the preceding phase passes its measured release gates.
