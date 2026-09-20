# MEJA52 Foldable and Unusual Mobile Adaptation

Status: owner-approved and implemented for Release 1

## Outcome

Gameplay on a folded or unfolded touch device remains the approved full-screen phone experience. A wide foldable viewport must never promote gameplay into the desktop two-column layout, constrain it to a narrow centred column, or move the private action deck to the side.

## Binding behaviour

- Folded portrait uses the ordinary full-width portrait table.
- Folded landscape uses the ordinary landscape table edge.
- Unfolded portrait fills the available width while retaining the existing top bar, public table and bottom private action deck.
- Unfolded landscape keeps the scrollable current-bet rail across the top and the private action deck across the full bottom width.
- Pot, balance, actions, chip rack, Table Controls and all privacy rules keep their approved positions and behaviour.
- Safe-area insets apply independently on all four edges. No essential control depends on hover, posture detection or a particular hinge API.
- Desktop pointer layouts remain unchanged.

## Implementation approach

The durable rule is capability-based rather than model- or user-agent-based:

1. `any-pointer: coarse` identifies a handheld/touch-first gameplay surface even when its unfolded width resembles a tablet or small desktop.
2. Orientation selects portrait or landscape composition. Touch landscape always uses the approved table-edge layout; it does not depend on an arbitrary 600 px height ceiling.
3. `100dvh`, `viewport-fit=cover` and four independent safe-area variables account for browser chrome, rounded corners and rotation.
4. Viewport-segment and device-posture APIs remain optional progressive enhancements. Core gameplay cannot depend on them because Device Posture is not Baseline and implementations differ.
5. Content-driven breakpoints and the existing full-width overflow tests protect ordinary phones and desktop layouts from regression.

## Reference evidence

- [Apple iPhone Duo technical specifications](https://www.apple.com/iphone-duo/specs/) — 7.6-inch folding inner display.
- [Apple: Prepare your app for iPhone Duo](https://developer.apple.com/videos/play/tech-talks/111461/) — orientation, safe-area and outer-display guidance.
- [Samsung Galaxy Z Fold8 announcement](https://news.samsung.com/global/samsung-galaxy-z-fold8-ultra-fold8-and-flip8foldables-perfected-for-every-way-of-living) — 7.6-inch main display.
- [MDN Device Posture API](https://developer.mozilla.org/en-US/docs/Web/API/Device_Posture_API) — experimental posture detection and limited availability.
- [MDN Viewport Segments API](https://developer.mozilla.org/en-US/docs/Web/API/Viewport_segments_API/Using) — segment-aware progressive enhancement for physical folds or joins.
- [web.dev screen configurations](https://web.dev/learn/design/screen-configurations) — responsive behaviour for single-screen and spanning foldable browser windows.

## Regression matrix

- iPhone Duo cover: 466×678 portrait and 678×466 landscape reference viewports.
- iPhone Duo inner: 626×890 portrait and 890×626 landscape reference viewports.
- Galaxy Z Fold8 inner: 720×960 portrait and 960×720 landscape representative viewports.
- Ordinary 320 px phones, the existing 15-player landscape rail and 1440 px fine-pointer desktop remain in the standard suite.

These CSS-pixel sizes are testing profiles, not device detection signatures. Real hardware verification remains part of the release gate.
