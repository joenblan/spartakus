// Every colour, font and drawing size used by the renderer and the UI. No colour literals anywhere else.

export const colors = {
  paper: '#f4efe3', // newsprint
  paperDusk: '#e2d6c0',
  ink: '#2b2925',
  inkSoft: '#6b665c',
  street: '#4a4844',
  label: '#2b2925',
  nodeFill: '#f9f6ee',
  /** Faction colours: used for crowds, units, buttons, log entries and score. */
  faction: {
    L: { main: '#8b1a1a', fill: '#c9837a' }, // left camp: deep red
    G: { main: '#5d6355', fill: '#a3a897' }, // government: field grey
    N: { main: '#a07a2c', fill: '#d8c08a' }, // neutral / civilian: muted ochre
  },
  energy: '#d08a1e', // amber (spec §8)
  fear: '#6c4a9e', // violet (spec §8)
  barBack: '#d9d2c3',
  panicFlash: '#f4efe3',
  destination: '#8b1a1a',
  duskTint: 'rgba(60, 40, 80, 0.10)',
  button: '#f9f6ee',
  buttonActive: '#2b2925',
  buttonActiveText: '#f9f6ee',
};

export const fonts = {
  /** Headings and the event log: newspaper serif. */
  serif: 'Georgia, "Times New Roman", Times, serif',
  /** Numbers and buttons. */
  sans: 'Helvetica, Arial, sans-serif',
};

export const sizes = {
  topBar: 48,
  /** x positions in the top bar */
  topBarX: { title: 16, clock: 260, clockNote: 324, credibility: 380, fear: 520, controls: 680 },
  meterWidth: 100,
  destinationAlpha: 0.5,
  margin: 70,
  outline: 2,
  nodeRadius: 6,
  edgeWidth: { boulevard: 7, street: 4, square: 5, bridge: 4 } as Record<string, number>,
  bridgeDash: [6, 4],
  reportedDash: [5, 4],
  /** Blob radius = blobK × √size, clamped. */
  blobK: 0.28,
  blobMin: 8,
  blobMax: 40,
  bar: { width: 34, height: 4, gap: 2 },
  unit: { w: 132, h: 30, gap: 10, offset: 22 },
  labelGap: 12,
  halo: 3,
  labelSize: 12,
  numberSize: 11,
  headingSize: 16,
  stack: 0.9, // spacing between crowds at one node, in blob radii
  /** Minimum gap between two blobs as a share of their summed radii; overlapping blobs are pushed apart. */
  blobSeparation: 1.05,
  separationPasses: 4,
  panicFlashMs: 300,
};
