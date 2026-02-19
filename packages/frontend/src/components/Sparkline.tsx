import type { Component } from "solid-js";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

// Module-level counter for unique SVG gradient IDs across Sparkline instances
let idCounter = 0;

const Sparkline: Component<SparklineProps> = (props) => {
  const gradId = `spark-grad-${idCounter++}`;
  const w = () => props.width ?? 200;
  const h = () => props.height ?? 50;
  const color = () => props.color ?? "hsl(178, 75%, 44%)";

  const pathData = () => {
    const points = props.data;
    if (!points.length) return null;

    const max = Math.max(...points, 1);
    const stepX = w() / Math.max(points.length - 1, 1);
    const padding = 2;
    const usableH = h() - padding * 2;

    const coords = points.map((v, i) => ({
      x: Math.round(i * stepX * 10) / 10,
      y: Math.round((padding + usableH - (v / max) * usableH) * 10) / 10,
    }));

    const line = coords.map((c, i) => (i === 0 ? `M${c.x},${c.y}` : `L${c.x},${c.y}`)).join(" ");
    const last = coords[coords.length - 1]!;
    const area = `${line} L${last.x},${h()} L0,${h()} Z`;

    return { line, area };
  };

  return (
    <svg width={w()} height={h()} viewBox={`0 0 ${w()} ${h()}`} preserveAspectRatio="none" style="display: block;">
      {pathData() && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color={color()} stop-opacity="0.15" />
              <stop offset="100%" stop-color={color()} stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d={pathData()!.area} fill={`url(#${gradId})`} />
          <path d={pathData()!.line} fill="none" stroke={color()} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </>
      )}
    </svg>
  );
};

export default Sparkline;
