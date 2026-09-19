# Remaining Release 1 Comps — Approval Package

Status: All fourteen coordinated Release 1 comps approved by owner
Workflow: Impeccable comp-first; no production UI code before approval

## Shared visual direction

Every comp uses the owner-approved **Precision Card Room** system and must be judged against all four binding references:

- **Apple:** immediate hierarchy, literal controls, touch ergonomics and clear state feedback.
- **Porsche:** exact grids, consistent control geometry and disciplined numerical presentation.
- **Bang & Olufsen:** premium restraint and honest material craft, with depth concentrated on chips.
- **Linear:** calm information density, predictable actions and secondary chrome that recedes.

The established warm mineral active/setup surface, deep graphite waiting surface, claret host identity, restrained oxblood state accent, graphite primary action, hairline structure and tactile chip language remain unchanged.

## Approval checklist

1. **Approved:** [Remaining setup steps](../Poker%20Chips/app/.impeccable/mocks/room-setup/setup-steps-v3.png) — the three-step Release 1 flow removes the redundant format/variant choice and confirms `Texas Hold’em · Cash game` as non-editable information on review.
2. **Approved:** [Join flow](../Poker%20Chips/app/.impeccable/mocks/join-flow/code-name-v1.png) — four-letter code, name and optional avatar; no account or host approval.
3. **Approved:** [Portrait gameplay](../Poker%20Chips/app/.impeccable/mocks/portrait-gameplay/waiting-active-v1.png) — fully operable waiting and active-turn fallback without digital cards.
4. **Approved:** [Physical-card controls](../Poker%20Chips/app/.impeccable/mocks/physical-cards/street-award-v3.png) — each street has one primary completion action; winner selection supports ties and administrative pot correction. The illustrative single main pot is arithmetically valid.
5. **Approved:** [Multiple runouts](../Poker%20Chips/app/.impeccable/mocks/runouts/all-in-runouts-v2.png) — the host chooses a supported count and the Table Controller is guided through each explicitly named physical runout.
6. **Approved:** [Chip change and rebuy](../Poker%20Chips/app/.impeccable/mocks/chip-operations/change-rebuy-v1.png) — break a denomination, request a rebuy and approve it between hands.
7. **Approved:** [Break and leave](../Poker%20Chips/app/.impeccable/mocks/attendance/break-return-leave-v1.png) — reserve seat, return with missed blinds and freeze an early leaver's stack.
8. **Approved:** [Host transfer and late arrival](../Poker%20Chips/app/.impeccable/mocks/attendance/host-transfer-late-arrival-v1.png) — accepted authority transfer and entry timing between hands.
9. **Approved:** [Corrections and recovery](../Poker%20Chips/app/.impeccable/mocks/corrections/undo-void-reconnect-v1.png) — undo the latest action, preview a void and freeze a disconnected client.
10. **Approved:** [Shared table display](../Poker%20Chips/app/.impeccable/mocks/shared-display/table-view-v1.png) — public balances, pots, positions, action, status and joining QR without private data.
11. **Approved:** [Cash settlement](../Poker%20Chips/app/.impeccable/mocks/settlement/cash-settlement-v1.png) — personal result, minimum transfers and balanced final record including early leavers.
12. **Approved:** [History and deletion](../Poker%20Chips/app/.impeccable/mocks/history/history-retention-v1.png) — audit trail, exports, 30-day retention and deliberate early deletion.
13. **Approved:** [Custom amount](../Poker%20Chips/app/.impeccable/mocks/raise-flow/custom-amount-v1.png) — native numeric entry as a secondary path before chips are staged.
14. **Approved:** [Award preview and override](../Poker%20Chips/app/.impeccable/mocks/awards/preview-override-v1.png) — public award confirmation and governed, reasoned administrative correction.

## Package-wide interaction rules

- One dominant action per state; meaningful destructive actions are never the default focus.
- Gestures always have labelled alternatives.
- Physical Card Mode never displays digital hole or community cards.
- Player-entered rebuys apply only between hands after host approval.
- A departed player's frozen balance remains in settlement.
- A valid room code joins without host approval under the approved initial rule.
- Public/shared displays never reveal private requests, secrets, recovery tokens or hole cards.
- Corrections conserve value, retain the original event and become visible in history.
- Settlement transfers are illustrative but internally balanced and the website never transfers money.
- Digital cards and tournaments remain visible future scope and are not enabled in Release 1.

Approval of this package authorises these visual designs for later implementation, not production deployment or backend changes.
