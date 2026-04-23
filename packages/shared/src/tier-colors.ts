export const TIER_COLORS = [
  'slate',
  'gray',
  'zinc',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
  'coral',
  'brown',
  'navy',
] as const;
export type TierColor = (typeof TIER_COLORS)[number];

export const DEFAULT_TIER_COLOR: TierColor = 'indigo';
