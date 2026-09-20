# MEJA52 Release 1 Readiness Audit

Status: Diagnostic release gate; no product behaviour changed
Audited: 20 September 2026
Branch: `codex/meja52-release1` at `a5e04c6`

## Implementation integrity verdict

**Pass with release blockers.** MEJA52 expresses a coherent, product-specific system rather than an interchangeable template: the Batik Indigo/Hibiscus visual language, tactile chip construction, public/private table split, governed physical-card workflow and portrait settlement are consistently implemented. Impeccable's deterministic detector returned no findings across `src`, `shared`, `worker`, `public` and `index.html`.

The application should not be published as Release 1 until the three P1 findings below are fixed and the production smoke gate is completed.

## Audit health score

| # | Dimension | Score | Key finding |
| --- | --- | --- | --- |
| 1 | Accessibility | 3/4 | Sound and Haptics switches have state but no accessible name |
| 2 | Performance | 4/4 | 103 KB gzip application JS; no heavy runtime media or layout-thrashing pattern found |
| 3 | Responsive design | 4/4 | Automated coverage passes from 320–1440 px, landscape play, 15 seats and 200% text |
| 4 | Theming | 3/4 | Strong token system; a small number of scoped hard-coded colours remain |
| 5 | Implementation integrity | 3/4 | Coherent system, but private-link logging and CSV export hardening must be corrected |
| **Total** |  | **17/20** | **Good — address release blockers** |

## Executive summary

- Issues: **0 P0, 3 P1, 3 P2, 1 P3**.
- The poker engine passed 25,000 extended fuzz games; unit, Worker, browser, type and build gates all pass.
- The Pages Function and API Worker both compile, and the Pages service binding follows Cloudflare's supported architecture.
- Production dependencies have no reported vulnerabilities. Four high-severity findings remain in the local Worker test toolchain.
- The current release branch is not merged to `main`, and an authenticated production deployment plus live two-device smoke test has not yet been performed.

## P1 — fix before release

### Private record capability appears in logged API URLs

- **Location:** `src/lib/api.ts:28`, `src/lib/api.ts:35`, `worker/src/index.ts:121`, `worker/wrangler.jsonc:8`
- **Category:** Privacy / implementation integrity
- **Impact:** The bearer capability that opens a private 30-day settlement record is part of the API pathname. Worker observability is enabled, and Cloudflare invocation logs record fetch request URLs. Anyone with access to those logs could open the private record until it expires or is deleted.
- **Standard:** OWASP guidance against secrets in URLs; least-exposure principle.
- **Recommendation:** Change the API to `/api/records/:code` and send the record capability only in an `x-record-token` header. Keep the shareable client route private and `no-referrer`; do not forward its token in the downstream request URL. Disable invocation logging for this endpoint or for the Worker if the capability cannot be kept out of logged fields.
- **Suggested command:** `$impeccable harden`
- **Evidence:** Cloudflare documents that Worker fetch invocation logs include the request method and URL: https://developers.cloudflare.com/workers/observability/logs/workers-logs/

### CSV export permits spreadsheet formula injection

- **Location:** `src/lib/record-export.ts:3`, `src/lib/record-export.ts:21`
- **Category:** Security / implementation integrity
- **Impact:** Player names are user-controlled. Quoting a CSV field does not reliably prevent spreadsheet software from evaluating a value beginning with `=`, `+`, `-` or `@`. A malicious name could execute a formula when the host opens the exported ledger.
- **Standard:** OWASP CSV Injection.
- **Recommendation:** Neutralise formula-leading text before CSV quoting, preserve the displayed player name in the application, and add regression cases for every dangerous leading character plus quotes and line breaks.
- **Suggested command:** `$impeccable harden`

### Sound and Haptics switches have no accessible name

- **Location:** `src/screens/Setup.tsx:95`, `src/screens/Setup.tsx:96`
- **Category:** Accessibility
- **Impact:** Screen-reader users encounter two unnamed switches and cannot determine which preference each controls. The adjacent `dt` text is not programmatically associated with either button.
- **WCAG:** 4.1.2 Name, Role, Value; 1.3.1 Info and Relationships.
- **Recommendation:** Give each switch an explicit accessible name and preserve `aria-checked`; add an accessibility regression assertion for both names and states.
- **Suggested command:** `$impeccable harden`

## P2 — address in the release hardening pass

### Global reduced-motion override removes every transition

- **Location:** `src/styles.css:3684`
- **Category:** Accessibility / motion
- **Impact:** The blanket 1 ms override prevents harmful motion, but it also removes useful state-transition feedback everywhere. Reduced motion should preserve comprehension with immediate, intentional alternatives.
- **WCAG:** 2.3.3 Animation from Interactions (AAA guidance); platform reduced-motion expectations.
- **Recommendation:** Replace the global override with targeted rules for shake, pop, breathing and animated numeric transitions while preserving non-motion state cues.
- **Suggested command:** `$impeccable animate`

### Four high-severity findings remain in development dependencies

- **Location:** `package-lock.json`; nested `sharp`, `miniflare`, `wrangler` and `@cloudflare/vitest-pool-workers`
- **Category:** Supply chain / release operations
- **Impact:** `npm audit --omit=dev` is clean, so the browser and Worker production dependency set is unaffected. The vulnerable chain still runs in developer and CI environments.
- **Recommendation:** Test a compatible Worker test-pool upgrade on a dedicated change. Do not apply a forced audit rewrite without rerunning Worker integration and deployment dry-runs.
- **Suggested command:** `$impeccable harden`

### Room discovery and connection endpoints lack perimeter throttling

- **Location:** `worker/src/index.ts:105`, `worker/src/index.ts:113`, `worker/src/room.ts:270`
- **Category:** Abuse resistance
- **Impact:** Four-letter room codes are intentionally easy to enter, but the public info and WebSocket routes have no address-level attempt limit. The per-room socket cap and per-connection message bucket limit damage after connection, not code enumeration or connection churn.
- **Recommendation:** Add conservative address-level lookup/upgrade throttling that does not introduce host approval or change the approved join workflow. Return indistinguishable not-found responses and test legitimate reconnect bursts.
- **Suggested command:** `$impeccable harden`

## P3 — documentation polish

### README describes inherited visuals and permissions

- **Location:** `README.md:15`, `README.md:35`, `README.md:37`, `README.md:50`
- **Category:** Implementation integrity / documentation
- **Impact:** Screenshots and copy still mention yellow turn state, universal undo and the old Worker name. Contributors may implement or report against behaviour that MEJA52 has replaced.
- **Recommendation:** Refresh screenshots, architecture names, authority descriptions, settlement/history capability and current verification counts after the P1 hardening changes.
- **Suggested command:** `$impeccable document`

## Operational release gate

The release branch is ahead of `main`; publishing must wait for the hardening changes, CI review and merge. Before announcing a public URL:

1. Verify the Cloudflare Pages project uses the checked-in `wrangler.toml` on the V2 build system.
2. Verify the `API` service binding targets `meja52-api` in production.
3. Configure deployment secrets without committing them.
4. Deploy the API before the Pages application.
5. Run a live two-device smoke test covering room creation, WebSocket play, reconnect, settlement, private-record access and deletion.
6. Confirm response headers and confirm private capability values do not appear in retained logs.
7. Exercise rollback once before public sharing.

Cloudflare's current documentation confirms that Pages Functions require a root `functions` directory and that service bindings configured in Wrangler can call a Worker without a public Worker URL:

- https://developers.cloudflare.com/pages/functions/get-started/
- https://developers.cloudflare.com/pages/functions/bindings/#service-bindings

## Positive findings

- Server-authoritative actions, version checks, strict message parsing, bounded messages, WebSocket caps and room-level rate buckets are present.
- Device and record capabilities are generated with Web Crypto; only salted hashes are stored in room state.
- Security headers include CSP, HSTS, frame denial, permissions restrictions, no-store API responses and no-referrer handling for private records.
- The UI uses semantic buttons, dialogs, forms, landmarks, status regions, visible focus and labelled alternatives for essential chip actions.
- Public live play does not expose other players' balances or total hand contributions.
- Private settlement records exclude device tokens and live connection state and expire automatically after 30 days.
- The 524 KB uncompressed static build is modest; application JavaScript is approximately 103 KB gzip.
- The 15-player rail, 320 px portrait layout, wide phone landscape layout and 200% text checks pass without page-level horizontal overflow.
- The Pages Function, service binding and Worker/Durable Object bundles compile successfully.

## Verification evidence

```text
Impeccable detector              PASS (0 findings)
TypeScript                       PASS
Production build                 PASS (JS 349.88 KB / 103.01 KB gzip)
Unit tests                       PASS (57 tests, 25,000 fuzz games)
Worker integration tests         PASS (48 tests)
Playwright browser workflows     PASS (19 tests)
Pages Function compilation       PASS
API Worker deployment dry-run    PASS
npm audit --omit=dev             PASS (0 vulnerabilities)
npm audit                        RISK (4 high, development/test chain only)
Live Cloudflare smoke test        NOT RUN (production is not connected from this environment)
```

## Recommended actions

1. **[P1] `$impeccable harden`:** Remove the private record token from API URLs, neutralise CSV formulas and label both setup switches, with regression coverage.
2. **[P2] `$impeccable harden`:** Add perimeter throttling and safely update the Worker test toolchain.
3. **[P2] `$impeccable animate`:** Replace the global reduced-motion kill switch with targeted alternatives.
4. **[P3] `$impeccable document`:** Refresh the README and release evidence.
5. **[Final] `$impeccable polish`:** Re-run the bounded visual and accessibility pass after hardening.
