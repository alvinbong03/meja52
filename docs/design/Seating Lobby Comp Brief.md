# Seating Lobby — Comp Brief

Status: Host/player confirmation v1 approved by owner
Workflow: Impeccable comp-first; no production UI code before approval

## Purpose

Map the digital seats to the friends' real clockwise positions before play. The host controls the arrangement while each player receives a simple advisory confirmation based on their immediate neighbours.

## Comparison comp

1. **Host:** a clean top-down table map shows six of the supported fifteen seats. The host holds and drags names around the oval, chooses the Dealer Button and Table Controller, sees confirmation progress and may invite more players. `Lock seats & start` remains enabled because player confirmation is advisory.
2. **Player:** the player sees only the relationship needed to verify their place: who is directly left, their seat number and who is directly right. `Yes, this matches` confirms; `Something's wrong` tells the host without allowing the player to rearrange the table.

The demonstration uses Aisha's perspective: Sara is on her left, Ben is on her right and Alvin is the host arranging the table.

## Interaction rules

- Host drag-and-drop must also have an accessible non-drag alternative that selects a player and destination seat.
- Names move in a single clockwise order; the server records stable seat IDs separately from their display positions.
- Every player phone updates immediately after host rearrangement and clears an earlier confirmation when that player's neighbours change.
- A player objection is visible to the host and changes that player's state to `Check seat`; it does not silently reorder anyone.
- The host may start with unconfirmed seats only after a clear acknowledgement; this confirmation is advisory, not a game-state requirement.
- The Dealer Button defaults to a proposed random occupied seat and can be changed before start.
- Physical Card Mode defaults the Table Controller to the host and permits reassignment before start.
- The layout must support two through fifteen active seats; names may abbreviate visually but remain available in full to assistive technology.

## Visual rules

- Apple: direct confirmation question, clear primary action and large touch targets.
- Porsche: exact circular geometry, ordered labels and disciplined setting rows.
- Bang & Olufsen: the table map is a restrained physical diagram rather than casino decoration.
- Linear: quiet secondary actions, compact status language and no competing panels.
- No felt texture, colourful avatar ring, dashboard cards, nested containers, oversized pills, gradients, glass, glow, logos or watermark.
