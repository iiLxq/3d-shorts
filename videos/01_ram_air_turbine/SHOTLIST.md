# Shot list: The Plane's Secret Windmill

VO: `vo/vo.wav` (Take 2, smoothed, 57.5 s). Word times: `vo/words.json`.
**Video: 58.5 s = 1755 frames @ 30 fps** (VO + 1.0 s tail that morphs back into frame 0 for the loop).

## Beat sheet (word starts, seconds)
`die 1.85 · windmill 3.24 · rock 7.44 · glides 8.28 · ten 9.42 · down 11.43 · power 13.92 · dark 15.39 · hydraulic 18.54 · draining 20.16 · heavier 22.10 · Here's 22.97 · pops 25.16 · propeller 26.41 · drops 27.07 · wind 27.75 · **LOCK 28.15** (gap) · spins 28.73 · pump 29.84 · back 31.39 · Steering's 33.28 · pinwheel 34.54 · speed 37.23 · 1983 38.22 · dry 41.37 · kilograms 44.73 · Luckily 45.64 · glider 47.07 · Unluckily 48.09 · race 50.54 · landed 51.45 · injuries 53.11 · plane 53.95 · twenty-five 55.84 · years 56.88`

## Danger meter (left edge, y 300–1000)
0 until 12.0 · rises with the threat: 0.25 @ power 13.92, 0.45 @ dark 15.39, 0.65 @ draining 20.16, 0.9 @ heavier 22.10, pulses red at the top · **crashes to green @ 28.15** · fades out by 31.0.

## Brand sounds
`intro_blueprint` @ 0.0 (under the first line) · `alarm_meter` 20.15 → 28.15 (exactly 8.0 s, ducked under words) · `safety_clunk` @ 28.15 (in the gap between "wind." and "It").

## Shots
| # | t0–t1 | State | VO | Shot | Key event @ t |
|---|---|---|---|---|---|
| 1 | 0.00–2.40 | BLUEPRINT | If both engines… die, | Line-art 767 cruising toward camera, label `FL410 · 2 ENGINES`, slow push | engines flicker and dim @ 1.85 |
| 2 | 2.40–5.10 | BLUEPRINT | a tiny windmill… flying. | Glide under the belly; dashed RAT outline, label `RAT · STOWED` | RAT outline pulses @ 3.24 |
| 3 | 5.10–8.10 | BLUEPRINT | A jet with no engines doesn't fall like a rock. | Side view: a line-art rock drops straight down past the jet; the jet keeps sliding forward | rock passes frame @ 7.44 |
| 4 | 8.10–12.00 | BLUEPRINT | It glides — ten feet… foot down. | Glide-path triangle draws: 10 ticks forward, 1 tick down, label `10 : 1+` | "10" @ 9.42, down tick @ 11.43 |
| 5 | 12.00–14.60 | BP → X-RAY | But no engines means no power. | Shell turns translucent with Fresnel edge; meter fades in | X-ray switch @ 13.92 |
| 6 | 14.60–15.95 | X-RAY | The screens go dark, | Dive into the cockpit: screens blink off one by one | last screen off @ 15.39 |
| 7 | 15.95–19.80 | X-RAY | and the controls… hydraulic pressure. | Follow glowing hydraulic lines from cockpit to tail | line pulse @ 18.54 |
| 8 | 19.80–21.15 | X-RAY | That's draining away. | Glow drains out of the lines; red force arrows push on the tail | drain starts @ 20.16 |
| 9 | 21.15–22.90 | X-RAY | The yoke gets heavier. | Yoke close-up, amber hands straining against red arrows, 4.5° dutch tilt | arrows grow @ 22.10 |
| 10 | 22.90–24.05 | X-RAY → SOLID | Here's what saves you. | Glide down to the belly; the blueprint "prints" into lit 3D | print sweep 22.97–24.0 |
| 11 | 24.05–26.00 | SOLID | A hatch in the belly pops open, | Belly close-up, hatch door snaps open, small kick | hatch @ 25.16 |
| 12 | 26.00–28.15 | SOLID | and a little propeller drops into the wind. | RAT swings down on its strut into the airstream, speed lines | locks + green flash @ 28.15 |
| 13 | 28.15–28.65 | SOLID | (gap) / It… | **0.5 s freeze-frame** on the lock (with a slow push-in creep) | meter green, clunk |
| 14 | 28.65–30.25 | SOLID | It spins up, drives a pump, | **Slow-mo replay** of the lock and the blades spinning up, from a new angle | blades blur @ 29.4 |
| 15 | 30.25–33.20 | SOLID | and pushes pressure back into the controls. | Green pressure glow races up the lines into the tail; surfaces move | surfaces move @ 31.39 |
| 16 | 33.20–34.35 | SOLID | Steering's back. | Yoke eases, amber hands relax, plane levels out | level @ 33.72 |
| 17 | 34.35–37.95 | SOLID | A pinwheel out a car window — powered by your own speed. | Stylized car window, a hand holds out a green pinwheel; blades blur | blur peaks @ 37.23 |
| 18 | 37.95–41.00 | SEPIA | In 1983, Air Canada 143 | White flash → sepia + grain; stamp `1983 · AIR CANADA 143` slams in; the 767 over farmland | stamp @ 38.22 |
| 19 | 41.00–43.45 | SEPIA | ran dry at 41,000 feet. | Fuel gauge needle sweeps to zero; altimeter `41000` | needle hits 0 @ 41.37 |
| 20 | 43.45–45.50 | SEPIA | Someone mixed up pounds and kilograms. | Gauge label `LB` flips to `KG` with a red flash | flip @ 44.73 |
| 21 | 45.50–47.95 | SEPIA | Luckily, the captain was a glider pilot. | Captain (amber) at the yoke, ghost sailplane line-art overlay | glider ghost @ 47.07 |
| 22 | 47.95–51.20 | SEPIA | Unluckily, the runway… car race on it. | Cockpit view down onto the old runway: race cars and campers | cars visible @ 50.54 |
| 23 | 51.20–53.65 | SEPIA | He landed anyway. No serious injuries, | Low wide: jet touches down, nose scrapes, sparks, stops | touchdown @ 51.3 (sound in gap after "anyway") |
| 24 | 53.65–58.50 | SOLID → BLUEPRINT | and the plane, it kept flying… years | Color flash back to now: the 767 climbs out in clean light, then dissolves back into cyan line art and lands on **frame 0** | dissolve 57.3–58.5 |

## Transitions
Hard cuts only at place/time jumps (18, 24). Everything else: camera glides 18–40 f, holds creep 0.15–0.35 %/f, no hand-held drift (playbook §3).
