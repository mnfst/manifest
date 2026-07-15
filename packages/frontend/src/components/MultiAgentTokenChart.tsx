import { createSignal, For, Show, type Component } from 'solid-js';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import '../styles/agent-chart-tooltip.css';
import { getHslA } from '../services/theme.js';
import { formatNumber, formatCost } from '../services/formatters.js';
import {
  useChartLifecycle,
  createBaseAxes,
  parseTimestamps,
  createTimeScaleRange,
  createFormatLegendTimestamp,
  formatLegendTokens,
  isMultiDayRange,
  fillDailyGaps,
} from '../services/chart-utils.js';

export const AGENT_COLORS = [
  '#1cc4bf',
  '#2430F0',
  '#FE076E',
  '#9531F9',
  '#FDCF3B',
  '#0F1683',
  '#26d9d3',
  '#F97316',
  '#10B981',
  '#EC4899',
  '#8B5CF6',
  '#06B6D4',
  '#F59E0B',
  '#6366F1',
  '#14B8A6',
  '#E11D48',
  '#7C3AED',
  '#0EA5E9',
  '#84CC16',
  '#D946EF',
];

interface TooltipState {
  visible: boolean;
  left: number;
  top: number;
  alignRight: boolean;
  date: string;
  entries: Array<{ agent: string; value: number; color: string }>;
  total: number;
}

interface MultiAgentTokenChartProps {
  agents: string[];
  timeseries: Array<Record<string, number | string>>;
  range: string;
  colorMap?: Record<string, string>;
  onHoverValues?: (values: Record<string, number> | null) => void;
  /** When set (e.g. "Requests"), y-axis formats as plain numbers instead of token suffixes. */
  label?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTooltipDate(epochSec: number, multiDay: boolean): string {
  const d = new Date(epochSec * 1000);
  const day = d.getDate();
  const mon = MONTHS[d.getMonth()]!;
  const year = d.getFullYear();
  if (multiDay) return `${day} ${mon} ${year}`;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${mon} ${year}, ${hh}:${mm}`;
}

const MultiAgentTokenChart: Component<MultiAgentTokenChartProps> = (props) => {
  let el!: HTMLDivElement;
  let rawData: number[][] = [];
  const isCost = () => props.label === 'Cost';
  const fmtVal = (v: number) => (isCost() ? (formatCost(v) ?? '$0.00') : formatNumber(v));

  const [tooltip, setTooltip] = createSignal<TooltipState>({
    visible: false,
    left: 0,
    top: 0,
    alignRight: false,
    date: '',
    entries: [],
    total: 0,
  });

  const bucketKey = () => (props.range === '24h' ? 'hour' : 'date');

  const buildData = (): uPlot.AlignedData => {
    const key = bucketKey();
    const filled = fillDailyGaps(props.timeseries as any[], props.range, key, (k) => {
      const row: Record<string, number | string> = { [key]: k };
      for (const agent of props.agents) row[agent] = 0;
      return row;
    });

    const timestamps = parseTimestamps(filled as any[]);

    rawData = props.agents.map((agent) =>
      filled.map((d: any) => Math.max(0, Number(d[agent] ?? 0))),
    );

    const cumulative: number[][] = [];
    for (let i = 0; i < props.agents.length; i++) {
      const prev = i > 0 ? cumulative[i - 1]! : timestamps.map(() => 0);
      cumulative.push(rawData[i]!.map((v, j) => v + (prev[j] ?? 0)));
    }

    const reversed = [...cumulative].reverse();
    return [timestamps, ...reversed];
  };

  useChartLifecycle({
    el: () => el,
    data: () => props.timeseries,
    buildData,
    structureKey: () => `${props.range}::${props.agents.join(',')}`,
    buildChart() {
      if (!el) return null;
      const w = el.clientWidth || el.getBoundingClientRect().width;
      if (w === 0) return null;

      const axisColor = getHslA('--foreground', 0.55);
      const gridColor = getHslA('--foreground', 0.05);

      const bars = uPlot.paths.bars!({ size: [1, 20], gap: 2 });
      const reversedAgents = [...props.agents].reverse();
      const multiDay = isMultiDayRange(props.range);

      // Per-agent fallback color, keyed on the agent's ORIGINAL index in
      // props.agents (not the reversed render order), so each series gets a
      // distinct color instead of all collapsing onto AGENT_COLORS[0]. An
      // explicit colorMap entry still takes precedence.
      const colorFor = (agent: string) => {
        const i = props.agents.indexOf(agent);
        return props.colorMap?.[agent] ?? AGENT_COLORS[i % AGENT_COLORS.length] ?? '#888';
      };

      const series: uPlot.Series[] = [
        { value: createFormatLegendTimestamp(props.range) },
        ...reversedAgents.map((agent) => ({
          label: agent,
          scale: 'y' as const,
          stroke: colorFor(agent),
          fill: colorFor(agent),
          width: 0,
          paths: bars,
          points: { show: false },
          value: formatLegendTokens,
        })),
      ];

      return new uPlot(
        {
          width: w,
          height: 260,
          padding: [16, 16, 0, 16],
          legend: { show: false },
          cursor: {
            x: true,
            y: false,
            points: { show: false },
            drag: { x: false, y: false },
            move: (u: uPlot, left: number, top: number) => {
              const idx = u.posToIdx(left);
              const snappedLeft =
                idx != null && u.data[0]?.[idx] != null
                  ? Math.round(u.valToPos(u.data[0][idx]!, 'x'))
                  : left;
              return [snappedLeft, top];
            },
          },
          hooks: {
            setCursor: [
              (u) => {
                const idx = u.cursor.idx;
                if (idx == null || idx < 0) {
                  props.onHoverValues?.(null);
                  setTooltip((prev) => ({ ...prev, visible: false }));
                  return;
                }

                // Raw (un-stacked) values
                const vals: Record<string, number> = {};
                const entries: TooltipState['entries'] = [];
                let total = 0;
                for (let i = 0; i < props.agents.length; i++) {
                  const agentName = props.agents[i]!;
                  const v = rawData[i]?.[idx] ?? 0;
                  vals[agentName] = v;
                  const color =
                    props.colorMap?.[agentName] ?? AGENT_COLORS[i % AGENT_COLORS.length] ?? '#888';
                  entries.push({ agent: agentName, value: v, color });
                  total += v;
                }
                props.onHoverValues?.(vals);

                // Sort entries by value descending
                entries.sort((a, b) => b.value - a.value);

                // Bar x position (pixel space)
                const timestamp = u.data[0]?.[idx];
                const barLeft = timestamp != null ? Math.round(u.valToPos(timestamp, 'x')) : 0;
                const chartWidth = u.bbox.width / devicePixelRatio;
                const pastHalf = barLeft > chartWidth / 2;

                const date = timestamp != null ? formatTooltipDate(timestamp, multiDay) : '';

                setTooltip({
                  visible: true,
                  left: barLeft,
                  top: 16,
                  alignRight: pastHalf,
                  date,
                  entries,
                  total,
                });
              },
            ],
          },
          scales: {
            x: {
              time: !multiDay,
              range: createTimeScaleRange(props.range, true),
            },
            y: {
              auto: true,
              range: (_u, _min, max) => [0, max > 0 ? max * 1.1 : 100] as [number, number],
            },
          },
          axes: (() => {
            const a = createBaseAxes(axisColor, gridColor, props.range);
            a[1] = {
              ...a[1]!,
              values: (u: uPlot, vals: number[]) =>
                vals.map((v) =>
                  // formatCost surfaces sub-cent values as "< $0.01" instead of
                  // rounding them to "$0.00".
                  isCost() ? (formatCost(v) ?? '$0.00') : formatLegendTokens(u, v),
                ),
            };
            return a;
          })(),
          series,
        },
        buildData(),
        el,
      );
    },
  });

  const tt = () => tooltip();
  const ROWS_PER_COL = 16;

  const visibleEntries = () => tt().entries.filter((e) => e.value > 0);
  const columns = () => {
    const items = visibleEntries();
    const cols: Array<typeof items> = [];
    for (let i = 0; i < items.length; i += ROWS_PER_COL) {
      cols.push(items.slice(i, i + ROWS_PER_COL));
    }
    return cols;
  };

  const hideTooltip = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
    props.onHoverValues?.(null);
  };

  return (
    <div style="position: relative; overflow: visible;" onMouseLeave={hideTooltip}>
      <div ref={el} style="width: 100%; min-height: 260px;" />
      <Show when={tt().visible && visibleEntries().length > 0}>
        <div
          class="agent-chart-tooltip"
          style={{
            left: tt().alignRight ? 'auto' : `${tt().left + 2}px`,
            right: tt().alignRight ? `${(el?.clientWidth ?? 0) - tt().left + 2}px` : 'auto',
            top: `${tt().top}px`,
          }}
        >
          <div class="agent-chart-tooltip__date">{tt().date}</div>
          <div class="agent-chart-tooltip__columns">
            <For each={columns()}>
              {(col) => (
                <div class="agent-chart-tooltip__list">
                  <For each={col}>
                    {(entry) => (
                      <div class="agent-chart-tooltip__row">
                        <span
                          class="agent-chart-tooltip__swatch"
                          style={{ background: entry.color }}
                        />
                        <span class="agent-chart-tooltip__name">{entry.agent}</span>
                        <span class="agent-chart-tooltip__value">{fmtVal(entry.value)}</span>
                      </div>
                    )}
                  </For>
                </div>
              )}
            </For>
          </div>
          <div class="agent-chart-tooltip__total">
            <span>Total</span>
            <span class="agent-chart-tooltip__total-value">{fmtVal(tt().total)}</span>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default MultiAgentTokenChart;
