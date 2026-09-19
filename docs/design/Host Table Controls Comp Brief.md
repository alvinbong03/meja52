# Host Table Controls — Comp Brief

Status: Host-controls v2 approved by owner
Workflow: Impeccable comp-first; no production UI code before approval

## Purpose

Give the host powerful session controls without mixing them into ordinary player controls or exposing them on the live poker surface.

## Structure

Show two landscape states at 844×390 proportions:

1. The approved collapsed host waiting table on the deep claret surface.
2. The same state with the solid Table Controls sheet expanded and **Host** mode selected.

The sheet keeps the slim live-state band visible. Hosts receive a dedicated `Host` section beneath the header with a short restrained underline. There is no `Player` tab or role switch; ordinary players and hosts receive their own role-appropriate Table Controls contents.

## Content

- Header: `Table controls`; `Host · Alvin`.
- Room summary: `RM1 / RM2 · Cash game · Physical cards`; `Room settings`; `View setup and editable controls.`
- `Rebuy requests` — `Review requested chip additions.` Show `1 pending` as restrained metadata.
- `Undo last action` — `Correct the most recent committed action.`
- `Pause game` — `Temporarily stop new actions.`
- `Transfer host` — `Assign host controls to another player.`
- `Hand history` — `Review every committed action.`
- `End game` — `End after this hand and begin settlement.`

`Void hand`, governed overrides and the runout-count workflow live behind the appropriate contextual flows rather than crowding the top-level sheet.

## Design requirements

- Apple: clear mode hierarchy, readable labels, 44px targets and restrained destructive treatment.
- Porsche: exact two-column alignment and consistent row geometry.
- Bang & Olufsen: finely finished sheet edge and host claret material behind it.
- Linear: calm density, compact metadata and secondary controls that recede.
- No glass, blur, dashboard cards, colourful icons, pill-heavy navigation, oversized warnings or casino styling.
