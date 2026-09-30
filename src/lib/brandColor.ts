const PALETTE = ['#EF9F27', '#1D9E75', '#7F77DD', '#D85A30', '#378ADD', '#D4537E', '#639922']

// Brands have no colour field yet, so each one gets a stable colour from its name.
export function brandColor(seed: string): string {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}
