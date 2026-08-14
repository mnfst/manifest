export const OUTPUT_MODALITIES = ['text'] as const;

export type OutputModality = (typeof OUTPUT_MODALITIES)[number];

export const DEFAULT_OUTPUT_MODALITY: OutputModality = 'text';

export function isOutputModality(value: unknown): value is OutputModality {
  return typeof value === 'string' && (OUTPUT_MODALITIES as readonly string[]).includes(value);
}
