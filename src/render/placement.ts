// Where each node's name label and unit boxes sit, so they stay clear of the streets and of each other.
// Render-only layout data for the spec §2 schematic.
export type Side = 'n' | 's' | 'e' | 'w';

export const placement: Record<string, { label: Side; units: Side }> = {
  N1: { label: 'e', units: 'w' },
  N2: { label: 'n', units: 's' },
  N3: { label: 's', units: 'n' },
  N4: { label: 'n', units: 's' },
  N5: { label: 'e', units: 'w' },
  N6: { label: 'w', units: 's' },
  N7: { label: 'e', units: 's' },
  N8: { label: 'n', units: 's' },
  N9: { label: 'w', units: 'e' },
  N10: { label: 'n', units: 's' },
  N11: { label: 'w', units: 'w' },
  N12: { label: 'w', units: 'e' },
  N13: { label: 'w', units: 's' },
  N14: { label: 'e', units: 's' },
  N15: { label: 'w', units: 'n' },
};

export const defaultPlacement = { label: 'n' as Side, units: 's' as Side };
