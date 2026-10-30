// Seeded PRNG (mulberry32). State is a single uint32 kept in SimState so a run can be snapshotted and replayed.

export function nextRandom(state: { rngState: number }): number {
  let a = (state.rngState = (state.rngState + 0x6d2b79f5) | 0);
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}

/** Uniform in [lo, hi). */
export function uniform(state: { rngState: number }, lo: number, hi: number): number {
  return lo + (hi - lo) * nextRandom(state);
}
