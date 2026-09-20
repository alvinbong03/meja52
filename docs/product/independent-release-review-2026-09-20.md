# MEJA52 Independent Release Review

Date: 20 September 2026  
Reviewers: independent security review and independent full-product review  
Decision after follow-up: **security hardening passes; public Release 1 remains blocked by four product gaps**

## Security verdict

No P0 or remaining P1 security vulnerability was found after the hardening pass.

Resolved in this pass:

- Private-record capabilities stay in the browser fragment and are sent to the API only in the `x-record-token` header.
- Private records are `noindex`, `nofollow` and `no-referrer`.
- CSV exports neutralise formula-leading player names.
- An unrelated member cannot approve a second device taking another seat, including the host seat.
- Only the host or Table Controller can act or manage breaks for another seat.
- Anonymous room lookup returns phase and player count, never player names.
- Creation bodies are rate-limited before parsing, streamed with a 4 KB ceiling, and require JSON.
- Room lookup and connection attempts have perimeter rate limits; unaffiliated sockets are capped.
- `.env*` and `.dev.vars*` cannot be committed accidentally.
- Production dependencies have no reported vulnerability.

Accepted alpha risks:

- A person who already knows a four-letter code can still attempt to occupy seats or pending connections. Limits reduce casual abuse but do not make a convenience code an authentication secret.
- Four high advisories remain in the development/test-only Cloudflare chain. Production dependencies are clean. Upgrade only after Worker compatibility testing.
- Device and record capabilities remain in local storage; the restrictive CSP is therefore part of the security boundary.

## Follow-up remediation

The owner approved immediate implementation of the two gaps that required no new visual design:

- **Private chip state — resolved.** The Worker now creates a separate payload for every connection. A player receives their own balance, buy-in and cumulative hand commitment; other connected players and unseated displays receive zeroed private fields plus an explicit privacy marker. Current-street bets, public player status and a separately calculated pot total remain public. The host or Table Controller receives another stack only while acting for an unattended seat, correcting that seat, or managing a manual seat. Departed-player settlement totals stay private until the game ends, and public timeline messages no longer reveal rebuys, corrected balances, late-arrival stacks or departure balances.
- **Sound and Haptics — resolved.** Both named setup switches persist per device. Audio unlock occurs only when sound is enabled, and every vibration respects the haptics preference.

Worker integration tests cover two player devices, an unseated display and a host-managed manual seat. Browser coverage verifies private balances with public current bets in phone landscape and verifies both device preferences. The full verification result is recorded in `docs/product/verification-log.md`.

## Public Release 1 blockers

### 1. Private chip state is hidden visually, but still broadcast — resolved

Resolved by the per-recipient public/private protocol described above. This finding is no longer a Release 1 blocker.

### 2. Approved seating lobby is incomplete

The current numbered list and up/down controls do not implement the approved physical-table mapping, neighbour confirmation, confirmation progress, dealer-button proposal or explicit **Lock seats & start** step.

Required outcome: prepare and approve a revised lobby comp before implementation.

### 3. Defining tactile chip/change interaction is incomplete

The rack supports taps and labelled placement, but not persistent denomination inventory, press-and-hold repeat, dragging staged chips back, pushing chips across a betting line, or explicit Make Change / Break Chip confirmation.

Required outcome: prepare and approve an interaction comp and state model before implementation.

### 4. Host transfer does not require acceptance

**Make host** currently transfers authority immediately.

Required outcome: pending transfer, accept/decline, cancellation, disconnect/expiry handling and a public audit event. Prepare the recipient prompt and host pending state for approval first.

### 5. Host-disconnect takeover is too quick and too open

Any seated player may currently take hosting after the short away threshold. The approved flow uses about 60 seconds, then offers authority to a configured backup or nominated longest-connected active player and requires acceptance.

Required outcome: combine this with the accepted host-transfer design and distinguish planned transfer, host absence, and seat recovery.

### 6. Setup Sound and Haptics choices are not honoured — resolved

Resolved by the persistent device preferences described above. This finding is no longer a Release 1 blocker.

## Important P2 work

- Complete Table Controls content: live history, accessibility controls, Help and fuller room details.
- Announce turn and call amount through an appropriate live region.
- Raise frequent touch targets to the approved 44 × 44 px minimum.
- Handle share and clipboard failures visibly.
- Correct invalid player-list semantics.
- Replace the blanket 1 ms reduced-motion override with targeted non-spatial alternatives.
- Reconcile deployment documentation around the approved single-Worker architecture.
- Complete real-device, poor-network, long-soak, live-deploy and fresh-account deployment gates.

## Hosting decision

Use **one Cloudflare Worker** for the React static assets, `/api/*`, WebSockets and the SQLite-backed Durable Object. This follows the approved design direction and removes the extra Pages Function/service-binding hop in the current inherited split configuration. Start on the Cloudflare Workers Free plan and the generated `workers.dev` address; add a custom domain only later.

The owner must authenticate Wrangler once before a real deployment:

```bash
cd "/Users/alvin/Documents/Second Brain/20 Work/Poker Chips/app"
npx wrangler login
```

Do not create a separate Pages project. First prove the single-Worker migration locally, run the complete gates, then deploy the Worker and perform a live two-device smoke test. Zero-cost operation is a target within current quotas, not a permanent guarantee.

## Verification evidence

```text
TypeScript                         PASS
Unit tests                        PASS (66)
Worker integration tests         PASS (53)
Playwright browser workflows      PASS (20)
Production build                  PASS
Pages Function compilation        PASS
Worker deployment dry-run         PASS
Production dependency audit       PASS (0)
Full dependency audit             RISK (4 high; development/test only)
Impeccable detector               PASS (0 findings)
Live Cloudflare deployment        NOT RUN (Wrangler is not authenticated)
```

## Recommended implementation order

1. Accepted host transfer plus host-loss recovery comp, approval and implementation.
2. Seating lobby comp, approval and implementation.
3. Tactile chip/change interaction comp, approval and implementation.
4. P2 accessibility/control polish.
5. Single-Worker migration proof, real-device/soak gates, Cloudflare deployment and live smoke test.
