# MEJA52 Release 1 Certification

Date: 20 September 2026  
Branch: `codex/meja52-release1`  
Decision: **Automated release candidate passed; physical-device and release-operations gates remain**

## Outcome

The implemented Release 1 scope—physical-card no-limit Hold’em cash play for 2–15 people—passes the complete automated correctness, privacy, accessibility, responsive, dependency, build and Cloudflare packaging gates. No automated P0/P1 blocker remains.

This is not yet an authorisation to merge or announce a public Release 1. Real iPhone/Android play, a longer home-network soak, rollback rehearsal and the owner-approved merge/tag remain required.

## Certified scope

- Account-free room creation, link/QR/code joining and creator-bound hosting.
- Physical seating, neighbour confirmation, selected first dealer, automatic blinds and visible D/SB/BB positions.
- Server-authoritative Hold’em betting, tactile chip staging, custom exact chip change, all-ins, side pots, ties and odd chips.
- Table Controller, corrections, void hand, award preview/dispute/override and 1×–4× physical runouts.
- Rebuys, breaks, missed blinds, late arrivals, governed leaving, host transfer and disconnect recovery.
- Private per-player balances with public current-street bets and shared-table display.
- End-game review, minimum-transfer settlement, private 30-day record, exports and host-only early deletion.
- Portrait, landscape, foldable/unusual touch screens, 15-player scrolling layouts and desktop keyboard alternatives.

Digital cards, tournaments, Pot-Limit Omaha and editable room denomination sets remain later-release scope.

## Automated evidence

```text
npm run typecheck                         PASS
npm run test:unit                         PASS (71 tests; 1,500 fuzz games)
FUZZ_GAMES=25000 npm run test:unit        PASS (71 tests; 25,000 fuzz games)
npm run test:worker                       PASS (58 tests)
npm run test:e2e                          PASS (26 workflows)
npm run build                             PASS (367.34 kB JS / 108.00 kB gzip)
npm run deploy:dry-run                    PASS (Wrangler 4.135.0)
npm audit                                 PASS (0 vulnerabilities)
Impeccable detector                       PASS (0 findings)
git diff --check                          PASS
```

The full browser run covers complete hands and settlement, privacy, tactile chip/change, blind posting and positions, side pots, tied pots, attendance, recovery, host transfer, 15-player use, foldable reference viewports, 320–1440 px overflow and unknown-room handling.

## Live evidence

- Deployment: `https://meja52.meja52.workers.dev`
- Homepage and `/api/health`: HTTP 200.
- Static response: CSP, HSTS, frame denial, no-sniff, restrictive permissions and referrer policy present.
- API response: `no-store`, `no-referrer`, `noindex, nofollow` present.
- Two independent live WebSockets: passed.
- Public pot and per-recipient private-balance boundary: passed.

## Dependency remediation

The earlier four high-severity development/test advisories came from `sharp@0.35.2` nested under Cloudflare’s pinned test pool. The release candidate pins the patched `sharp@0.35.4`, updates the direct Wrangler toolchain to 4.135.0 and reruns every automated gate. Both production-only and full dependency audits now report zero vulnerabilities. No forced audit rewrite was used.

## Remaining physical-device checklist

Run one bounded session on real hardware:

- iPhone Safari and Android Chrome; include one smaller/older phone where available.
- Join by QR and pasted link; rotate lobby and gameplay both directions.
- Confirm D/SB/BB, automatic blind deduction, Folded state, Call/Check/Raise and custom Make Change.
- Lock/unlock one phone, background a tab, switch Wi-Fi/mobile data where practical and verify recovery without duplicate actions.
- Complete one payout, end the game, review settlement and open the private record.
- Run at least three phones for a full physical-card hand and keep a room active for 30–60 minutes.
- Smoke VoiceOver or TalkBack on Join, the action controls and settlement.

Record device model, OS/browser version, outcome and any screenshot/video evidence in the verification log.

## Remaining release-operations checklist

- Rehearse one Worker version rollback and restore the release candidate.
- Verify deployment from a fresh checkout with only documented secrets and commands.
- Confirm Cloudflare logs do not expose device or private-record capabilities.
- Merge `codex/meja52-release1` to `main` and create the Release 1 tag only with explicit owner approval.
