import { For, Show, type Component } from 'solid-js';

interface CostBarChartProps {
  /** One value per day, oldest first. */
  values: number[];
  /** Labels for the first, middle and last x positions. */
  labels: string[];
  /** Bar colour. Defaults to the rose chart token. */
  color?: string;
  /** Accessible description of what the bars are. */
  ariaLabel: string;
  /** Value formatter for the aria summary and tooltips. */
  format?: (value: number) => string;
  height?: number;
}

const W = 320;
const GAP = 1.5;

/**
 * Dependency-free SVG bars, one per day. Kept as plain SVG (not uPlot) so it
 * renders in tests and needs no lazy chunk.
 */
const CostBarChart: Component<CostBarChartProps> = (props) => {
  const h = () => props.height ?? 96;
  const color = () => props.color ?? 'hsl(var(--chart-4))';
  const fmt = () => props.format ?? ((v: number) => v.toFixed(2));
  const max = () => Math.max(...props.values, 0.000001);
  const barWidth = () =>
    (W - GAP * Math.max(props.values.length - 1, 0)) / Math.max(props.values.length, 1);
  const total = () => props.values.reduce((a, b) => a + b, 0);

  return (
    <div class="bar-chart">
      <Show
        when={props.values.length > 0}
        fallback={<div class="bar-chart__empty">No data for this period yet.</div>}
      >
        <svg
          class="bar-chart__svg"
          viewBox={`0 0 ${W} ${h()}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${props.ariaLabel}. Total ${fmt()(total())}.`}
        >
          <line
            x1="0"
            y1={h() - 0.5}
            x2={W}
            y2={h() - 0.5}
            stroke="hsl(var(--border))"
            stroke-width="1"
            vector-effect="non-scaling-stroke"
          />
          <For each={props.values}>
            {(v, i) => {
              const bh = () => Math.max(1, (v / max()) * (h() - 8));
              return (
                <rect
                  x={(i() * (barWidth() + GAP)).toFixed(2)}
                  y={(h() - bh()).toFixed(2)}
                  width={barWidth().toFixed(2)}
                  height={bh().toFixed(2)}
                  rx="1"
                  fill={color()}
                  opacity={i() === props.values.length - 1 ? 1 : 0.75}
                >
                  <title>{fmt()(v)}</title>
                </rect>
              );
            }}
          </For>
        </svg>
        <div class="bar-chart__axis">
          <For each={props.labels}>{(label) => <span>{label}</span>}</For>
        </div>
      </Show>
    </div>
  );
};

export default CostBarChart;
