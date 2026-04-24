import type { ValueTransformer } from 'typeorm';

/**
 * TypeORM's DECIMAL/NUMERIC columns round-trip as strings because the `pg`
 * driver never automatically coerces them (an arbitrary-precision decimal
 * doesn't always fit in a JS number). Every entity column typed `number` on
 * the TS side would otherwise lie to callers — `JSON.stringify` ships
 * `"0.000042"` instead of `0.000042`, and downstream arithmetic / `toFixed`
 * blows up. This transformer applies `parseFloat` on read (null preserved)
 * and pass-through on write; the precision we accept here is the same
 * precision `Number(...)` callsites are already accepting, so nothing gets
 * worse. Where we genuinely need arbitrary-precision decimals we'd keep the
 * column as `string` in the entity type.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined): number | null | undefined => value,
  from: (value: string | number | null | undefined): number | null => {
    if (value == null) return null;
    if (typeof value === 'number') return value;
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  },
};
