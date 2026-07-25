# Kuro EP1 — Background Specs (human-readable)

All authoritative coordinates live in `manifests/*.json`. This file is background context only.

---

## Kitchen (bg-kitchen)
Canvas 1280×720. West-facing window. Ground line y=620. glow_response=0.35.

**Variants:** `west` (afternoon direct sun), `flat` (ambient only)

**Fridge:** x=960–1180, y=190–720 (metal surfaces reflect cyan glow)

**Narrative mechanic — curtain shadow sweep:**
As the afternoon progresses (t=104→182), a curtain shadow sweeps rightward across the floor,
squeezing the usable light zone between the shadow and the fridge:

| t   | curtain right edge | light zone width | consequence                     |
|-----|--------------------|------------------|---------------------------------|
| 104 | x=600              | 360 px           | wide, comfortable               |
| 124 | x=690              | **270 px**       | KEY — full-light, must jelly    |
| 170 | x=893              | **67 px**        | KEY — two-segment borrow only   |
| 182 | x=960              | 0 px             | light gone, fridge unreachable  |

**Light polygon:** warm amber overlay, sweeps with the sun (matches curtain right edge).

---

## Living Room (bg-livingroom)
Canvas 1280×720. East window light. Three variants: morning / flat / sunset.

- t=44–50: `shadow_cast OFF` — no cat shadow (narrative beat)
- `keyring` appears at wall corner after t=97
- `tally_counter` in flat + sunset
- Sunset: NO jelly (sun too weak), cat is solid, shadow 4.5× long, `tab_in_slot_01` visible

---

## Entryway (bg-entryway)
Canvas 1280×720. Two variants: normal / memory.

- `keyring` under shoe cabinet, visible via glow reflection only
- Memory variant: -70% saturation, high contrast, vignette, glow_response=0

---

## Cards
### card_underbed
- glow_response=0.55 (highest in film)
- 85% shadow coverage, spiderweb only visible via cat glow
- Narrative reversal: "hiding thing becomes glowing thing"

### card_recycle
- Same warm palette as kitchen
- Cardboard box interior clearly visible and empty
