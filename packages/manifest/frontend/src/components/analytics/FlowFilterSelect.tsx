import type { FlowOption } from '@manifest/shared';

interface FlowFilterSelectProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  flows: FlowOption[];
}

/**
 * Dropdown select for filtering analytics by flow.
 */
export function FlowFilterSelect({ value, onChange, flows }: FlowFilterSelectProps) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="px-3 py-1.5 text-sm border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
    >
      <option value="">All Flows</option>
      {flows.map((flow) => (
        <option key={flow.id} value={flow.id}>
          {flow.name}
        </option>
      ))}
    </select>
  );
}
