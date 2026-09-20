# Host Authority Recovery — Comp Brief

Status: Awaiting owner approval  
Workflow: Impeccable comp-first; no production UI or protocol implementation before approval

## Job and audience

Keep a live physical poker table governable when the host deliberately hands over authority or unexpectedly loses connection. The people involved are the current host, the nominated recipient and the rest of the table. Surface mode: **Operate**.

## Recommended authority model

- The Durable Object remains the authority throughout; this is a role transfer, never a migration of game state between phones.
- A planned transfer is a request. The current host retains all authority until the recipient accepts and may cancel while it is pending.
- Host and Table Controller remain independent. Transferring host does not silently move dealing or award authority.
- A disconnected host receives a 60-second reconnection grace period. Ordinary legal play continues, but host-only decisions wait.
- After 60 seconds, the configured backup host is asked first. Without one, the longest-connected active player is nominated. Nobody can seize hosting from a general-purpose button.
- The nominee must accept. Declining moves the offer to the next eligible active player; it does not leave a public takeover action available to everyone.
- If the original host reconnects before acceptance, the recovery offer closes and authority remains unchanged. Reconnecting after acceptance restores the former host only as a player.
- Every accepted transfer is announced publicly and written to history. Declines, expired offers and short disconnects do not clutter the public timeline.

This recommendation follows the approved specification and the strongest pattern found in multiplayer ownership systems: retain server state, distinguish planned and involuntary transfer, use a grace period to avoid reacting to brief network drops, nominate deterministically, and require explicit acceptance.

## Approval comp

The coordinated comp shows four portrait states:

1. **Planned transfer pending — current host:** `Waiting for Maya`; hosting remains with Alvin; the request can be cancelled; Table Controller remains Ben.
2. **Planned transfer request — recipient:** `Become the host?`; a one-sentence role explanation; `Accept hosting` is dominant and `Decline` is quiet.
3. **Disconnect grace — everyone else:** a compact, non-blocking `Host reconnecting · 42s` band over the normal table. The current hand continues and the next nominee is stated.
4. **Recovery offer — nominee:** `Take over hosting?`; unchanged table/controller state is explicit; accepting is dominant and declining advances to the next eligible player.

## Interaction and layout

- All states use Batik Indigo, Denim Lift, Batik Ivory, Pewter Mist and restrained Hibiscus state marks from the approved Precision Card Room system.
- The disconnect grace is a status band, not a blocking modal. It leaves the live table and player actions available.
- Transfer and takeover decisions use the existing solid Table Controls sheet geometry. There is one dominant action and no decorative warning treatment.
- A pending request appears as status rather than a disabled form. `Cancel request` stays visually secondary.
- Backup-host selection reuses the connected-player chooser and appears in Host Table Controls as `Backup host` — `First asked if you disconnect.` It may be left unset.
- Motion is limited to the sheet transition and a single status change; Reduced Motion replaces both with immediate state changes.

## States and edge cases

- Recipient disconnects, leaves, becomes ineligible or fails to respond for 30 seconds: cancel the planned request; for recovery, nominate the next eligible player.
- Original host cancels or reconnects before acceptance: close the recipient prompt with `Host is back` and make no authority change.
- Transfer accepted during a hand: authority changes immediately without touching turn, pot, cards, stacks or Table Controller.
- No eligible replacement: preserve the room and current hand state, show `Waiting for a host`, and prevent host-only decisions or a new hand until an eligible seated player reconnects.
- The departing host cannot complete `Leave game` while a transfer remains unaccepted.
- Screen readers announce the named requester, role consequences, remaining grace time at meaningful intervals, and successful transfer. Colour is never the only status signal.

## References used

- Apple: explicit destructive/authority confirmation and singular action hierarchy.
- Porsche: fixed row geometry and precise status/data alignment.
- Bang & Olufsen: restrained, materially coherent sheet treatment.
- Linear: calm recovery copy and secondary chrome that recedes.
- Discord ownership transfer: deliberate named-recipient confirmation.
- Microsoft PlayFab and Unity host-migration guidance: separate planned transfer from disconnect recovery, preserve authoritative session state and use deterministic migration policy/timeouts.
- Multiplayer developer discussions: avoid immediate migration for brief connection changes and make recovery status legible instead of silently reassigning authority.

