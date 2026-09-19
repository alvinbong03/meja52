# Future Release Handoff

Status: Binding roadmap handoff
Recorded: 19 September 2026

This file exists so a new agent cannot interpret a disabled control in the Release 1 interface as removed product scope. The full source of truth remains [Product Specification.md](Product%20Specification.md), especially sections 17 and 36.

## Digital Card Mode is deferred, not cancelled

Digital Card Mode must be implemented in **Release 3 — digital Hold'em**, after Release 1 physical-card cash play and Release 2 tournament/manual-variant work pass their gates.

Until then:

- Keep **Digital cards** visible in the room-creation card-mode step.
- Show it as unavailable with the explicit status **Later release**.
- Do not silently remove it, present it as working, or replace it with a generic roadmap message.
- Do not allow an incomplete client-only or insecure dealing mode behind the control.

## Minimum Release 3 implementation

- Server-trusted Web Crypto shuffle with unbiased rejection-sampled Fisher–Yates.
- Private persisted deck state owned by the room's Durable Object.
- Two seat-scoped Hold'em hole cards delivered only to the authenticated player connection.
- Public flop, turn and river state for player screens and shared display.
- Covered-by-default cards with press/slide peek plus a labelled tap alternative.
- Immediate automatic re-cover on release, loss of focus, backgrounding, lock, unexpected rotation and reconnect.
- Accessible **Read My Cards** flow with a headphone privacy warning and no automatic private-card announcements.
- **Show Hand** and **Muck** controls where rules permit.
- No private cards in public messages, caches, analytics, exception reports, exports or persistent logs.
- No third-party scripts or session replay on gameplay routes.
- Public plain-language **How dealing works** documentation and a completed trusted-dealer threat-model review.
- Automated privacy, reconnect, accessibility, evaluator and full-hand browser tests before enabling the setup choice.

The host is an ordinary client and must never receive the complete deck. Release 3 does not claim independently verifiable dealing; Cloudflare and the service operator remain in the documented trusted computing base.

## Later extension

Digital Pot-Limit Omaha and digital repeated runouts remain Release 4 scope, with deck-capacity limits tested separately. Do not expand the Release 3 Hold'em implementation implicitly.
