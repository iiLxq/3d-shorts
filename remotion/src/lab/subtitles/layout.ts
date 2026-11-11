// Shared layout rules (used by the component AND the validator).
export const W = 1080;
export const H = 1920;
export const BAND = { top: 1250, bottom: 1450, center: 1350 }; // subtitle band (y)
export const HARD_BOTTOM = 1536; // nothing below (Shorts UI)
export const SIDE_MARGIN = 60;
export const MAX_TEXT_W = 820; // advance width; with outline+stamp allowance stays within x 100..980: clear of the right-hand Shorts buttons
export const BASE_SIZE = 104; // px at 1080 wide
export const EMPH_SCALE = 1.12;
export const MIN_SIZE = 78;

export type Measure = (text: string, fontPx: number) => number;

/** Find the font size that fits maxW; returns size, width, lines (1, or 2 when even MIN_SIZE is too wide). */
export function fitText(text: string, measure: Measure, base = BASE_SIZE, maxW = MAX_TEXT_W): { size: number; width: number; lines: string[] } {
  let size = base;
  let w = measure(text, size);
  if (w > maxW) size = Math.max(MIN_SIZE, Math.floor((base * maxW) / w));
  w = measure(text, size);
  if (w <= maxW) return { size, width: w, lines: [text] };
  // two lines at a balanced split
  const words = text.split(" ");
  let bestI = 1, bestD = 1e9;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(measure(words.slice(0, i).join(" "), MIN_SIZE) - measure(words.slice(i).join(" "), MIN_SIZE));
    if (d < bestD) { bestD = d; bestI = i; }
  }
  const lines = [words.slice(0, bestI).join(" "), words.slice(bestI).join(" ")];
  return { size: MIN_SIZE, width: Math.max(...lines.map((l) => measure(l, MIN_SIZE))), lines };
}

export type FontKey = "montserrat-xb" | "montserrat-black" | "archivo-black" | "barlow-sc-bold" | "poppins-xb";
export const FONTS: Record<FontKey, { family: string; file: string; label: string; weight: number; scale: number }> = {
  "montserrat-xb": { family: "SubMontserratXB", file: "fonts/Montserrat-ExtraBold.ttf", label: "Montserrat ExtraBold", weight: 800, scale: 1 },
  "montserrat-black": { family: "SubMontserratBlack", file: "fonts/Montserrat-Black.ttf", label: "Montserrat Black", weight: 900, scale: 1 },
  "archivo-black": { family: "SubArchivoBlack", file: "fonts/ArchivoBlack-Regular.ttf", label: "Archivo Black", weight: 400, scale: 1 },
  "barlow-sc-bold": { family: "SubBarlowSCBold", file: "fonts/BarlowSemiCondensed-Bold.ttf", label: "Barlow Semi Condensed Bold", weight: 700, scale: 1.18 },
  "poppins-xb": { family: "SubPoppinsXB", file: "fonts/Poppins-ExtraBold.ttf", label: "Poppins ExtraBold", weight: 800, scale: 1 },
};

export const TONE_COLORS = { white: "#FFFFFF", danger: "#FF3B3B", safe: "#39FF88", person: "#FFB020" } as const;
