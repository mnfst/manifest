import { For, type Component } from 'solid-js';

interface MiniBarsProps {
  /** One value per bar, oldest first. */
  data: number[];
  width?: number;
  height?: number;
}

/**
 * Inline bar chart for a table cell: one bar per bucket, scaled to the
 * largest value. Counts per day read better as bars than as a curve, which
 * suggests a continuous measure.
 */
const MiniBars: Component<MiniBarsProps> = (props) => {
  const w = () => props.width ?? 74;
  const h = () => props.height ?? 22;
  const gap = 2;
  const max = () => Math.max(...props.data, 1);
  const barWidth = () => {
    const n = Math.max(props.data.length, 1);
    return Math.max((w() - gap * (n - 1)) / n, 1);
  };

  return (
    <svg
      class="mini-bars"
      width={w()}
      height={h()}
      viewBox={`0 0 ${w()} ${h()}`}
      aria-hidden="true"
    >
      <For each={props.data}>
        {(value, i) => {
          const barHeight = () => Math.max(Math.round((value / max()) * h() * 10) / 10, 1);
          return (
            <rect
              x={i() * (barWidth() + gap)}
              y={h() - barHeight()}
              width={barWidth()}
              height={barHeight()}
              rx="1"
              fill="currentColor"
            />
          );
        }}
      </For>
    </svg>
  );
};

export default MiniBars;
