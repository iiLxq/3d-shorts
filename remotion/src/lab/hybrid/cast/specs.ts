// [hybrid/cast] The recurring cast as data. A new character = a new spec (no new code): height/heads/build, skin, hair,
// face style, outfit pieces + colours, accessories, palette. Amber #FFB020 is reserved for the person at risk.
import { BRAND } from "../look/shade";
import type { CharacterSpec } from "./character";

/** RAFA: the technician, our first recurring person at risk. Mid-40s, broad, long-limbed, salt-and-pepper boxed beard,
 *  cap-peak hard hat with a crown fin + headlamp, two-tone hi-vis jacket (amber body, navy trim) with tape braces. */
export const RAFA: CharacterSpec = {
  id: "rafa", name: "Rafa", role: "lift technician (person at risk)",
  heightM: 1.8, heads: 6.7, build: "broad",
  skin: "#B57655",
  hair: { style: "crop", color: "#4A4442" },
  face: { beard: 0.95, beardColor: "#47403D", beardGrey: "#A79D93", iris: "#5A3A28", brow: "#3A302D", lip: "#9A5A4E", browW: 1.15, eyeScale: 1.0, nose: 1.1, jaw: 1.15 },
  body: { shoulder: 1.0, waist: 1.02, limb: 1.0 },
  outfit: {
    top: "workJacket", topColor: BRAND.amber, trim: "#2D3647", stripes: true,
    lower: "workPants", lowerColor: "#34404F",
    shoes: "boots", shoeColor: "#5C3D2C",
    gloves: "#3E434B",
  },
  accessories: ["helmet", "headlamp", "toolbelt", "kneepads"],
  palette: {
    tape: "#C9D4D6", seam: "#25303F", helmet: "#EDE6D8", helmetDark: "#C9C0B2", leather: "#6C4733", sole: "#2A2526",
    toe: "#7A5638", metal: "#9AA6AE", dark: "#23262E", wood: "#8A6040", lash: "#2A1F1C",
  },
};

/** NOOR: office passenger (bystander / alternative person at risk). Early 30s, slim, deep brown skin, high bun,
 *  round-cornered glasses, slate-plum blazer over a cream blouse, lanyard + ID, flats. Same builder, same DNA. */
export const NOOR: CharacterSpec = {
  id: "noor", name: "Noor", role: "office passenger",
  heightM: 1.66, heads: 6.5, build: "slim",
  skin: "#7B4B36",
  hair: { style: "bun", color: "#1F1A1D" },
  face: { beard: 0, iris: "#3A2416", brow: "#1E1716", lip: "#7E4440", browW: 0.85, eyeScale: 1.06, nose: 0.9, jaw: 0.75 },
  body: { shoulder: 0.95, waist: 0.9, hip: 1.12, limb: 0.95, depth: 0.95 },
  outfit: {
    top: "blazer", topColor: "#5E5470", trim: "#4A425A", under: "#E6DCCB",
    lower: "trousers", lowerColor: "#2B2E38",
    shoes: "flats", shoeColor: "#6E4430",
  },
  accessories: ["glasses", "lanyard", "watch"],
  palette: { seam: "#3E3750", accent: "#3A4150", card: "#ECE8DF", dark: "#221C20", metal: "#B8B2A6", sole: "#2A2224", lash: "#120D0C" },
};

/** recolour any cast member as THE person at risk of an episode (amber outer layer, per the colour code) */
export const asAtRisk = (s: CharacterSpec): CharacterSpec => ({ ...s, outfit: { ...s.outfit, topColor: BRAND.amber } });
export const CAST = { RAFA, NOOR };
