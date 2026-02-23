import { createSignal, createResource, Show, For, createMemo, type Component } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import ErrorState from "../components/ErrorState.jsx";
import { getModelPrices } from "../services/api.js";

interface ModelPrice {
  model_name: string;
  provider: string;
  input_price_per_million: number;
  output_price_per_million: number;
  capability_vision: boolean;
  capability_tool_calling: boolean;
  capability_reasoning: boolean;
  capability_structured_output: boolean;
}

interface ModelPricesData {
  models: ModelPrice[];
  lastSyncedAt: string | null;
}

type SortKey = "model_name" | "provider" | "input_price_per_million" | "output_price_per_million";
type SortDir = "asc" | "desc";

const CAPABILITIES = [
  { key: "capability_vision" as const, icon: "bx-message-image", title: "Multimodal", desc: "Can understand and analyze images sent in prompts." },
  { key: "capability_tool_calling" as const, icon: "bx-webhook", title: "Tool Calling", desc: "Can call external functions and APIs to take actions." },
  { key: "capability_reasoning" as const, icon: "bx-brain", title: "Reasoning", desc: "Can think step-by-step through complex problems." },
  { key: "capability_structured_output" as const, icon: "bx-bracket-curly", title: "Structured Output", desc: "Can reliably output valid JSON matching a given schema." },
];

function CapabilityIcon(props: { enabled: boolean; icon: string; title: string; desc: string }) {
  return (
    <span
      class="info-tooltip"
      style={{ "margin-left": "0" }}
    >
      <i
        class={`bxd ${props.icon}`}
        style={{
          "font-size": "16px",
          color: props.enabled ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
          opacity: props.enabled ? 1 : 0.4,
          "--bx-duotone-secondary-opacity": props.enabled ? "0.8" : "0.4",
        }}
      />
      <span class="info-tooltip__bubble">
        <strong>{props.title}</strong>
        {props.desc}
      </span>
    </span>
  );
}

function formatPrice(price: number): string {
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 1) return `$${price.toFixed(3)}`;
  return `$${price.toFixed(2)}`;
}

const ModelPrices: Component = () => {
  const [data, { refetch }] = createResource(() => getModelPrices() as Promise<ModelPricesData>);
  const [sortKey, setSortKey] = createSignal<SortKey>("provider");
  const [sortDir, setSortDir] = createSignal<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey() === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedModels = createMemo(() => {
    const models = data()?.models;
    if (!models) return [];
    const key = sortKey();
    const dir = sortDir();
    return [...models].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === "string" && typeof bv === "string") {
        return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return dir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  });

  const indicator = (key: SortKey) => {
    if (sortKey() !== key) return "";
    return sortDir() === "asc" ? " \u25B2" : " \u25BC";
  };

  const formatSyncTime = (ts: string | null) => {
    if (!ts) return "Never";
    const d = new Date(ts);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div class="container--full">
      <Title>Model Prices | Manifest</Title>
      <Meta name="description" content="Compare per-token pricing across all major LLM providers." />
      <div class="page-header">
        <div>
          <h1>Model Prices</h1>
          <span class="breadcrumb">What each AI model costs to use</span>
        </div>
        <Show when={data()?.lastSyncedAt}>
          <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
            Last updated: {formatSyncTime(data()!.lastSyncedAt)}
          </span>
        </Show>
      </div>

      <Show when={!data.loading} fallback={
        <div class="panel">
          <div class="skeleton skeleton--text" style="width: 120px; height: 16px; margin-bottom: 16px;" />
          <For each={[1, 2, 3, 4, 5, 6, 7, 8]}>
            {() => (
              <div style="display: flex; gap: 16px; padding: 12px 0; border-bottom: 1px solid hsl(var(--border));">
                <div class="skeleton skeleton--text" style="width: 200px; height: 14px;" />
                <div class="skeleton skeleton--text" style="width: 80px; height: 14px;" />
                <div class="skeleton skeleton--text" style="width: 100px; height: 14px;" />
                <div class="skeleton skeleton--text" style="width: 100px; height: 14px;" />
              </div>
            )}
          </For>
        </div>
      }>
        <Show when={!data.error} fallback={
          <ErrorState error={data.error} onRetry={refetch} />
        }>
        <div class="panel">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--gap-lg);">
            <div>
              <div class="panel__title" style="margin-bottom: 0;">
                {sortedModels().length} models
              </div>
              <p style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); margin: 4px 0 0;">
                Tokens are units of text that AI models process. "Send" is what you give the model, "Receive" is what it returns.
              </p>
            </div>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th class="data-table__sortable" onClick={() => handleSort("model_name")}>
                  Model{indicator("model_name")}
                </th>
                <th class="data-table__sortable" onClick={() => handleSort("provider")}>
                  Provider{indicator("provider")}
                </th>
                <th>
                  Capabilities
                  <span class="info-tooltip">
                    <i class="bxd bx-info-circle info-tooltip__icon" style={{ "font-size": "14px", "--bx-duotone-secondary-opacity": "1", color: "hsl(var(--muted-foreground))" }} />
                    <span class="info-tooltip__bubble">
                      <strong>How to read icons</strong>
                      Solid icons are supported by the model. Faded icons are not.
                    </span>
                  </span>
                </th>
                <th class="data-table__sortable" onClick={() => handleSort("input_price_per_million")}>
                  Cost to send / 1M tokens{indicator("input_price_per_million")}
                </th>
                <th class="data-table__sortable" onClick={() => handleSort("output_price_per_million")}>
                  Cost to receive / 1M tokens{indicator("output_price_per_million")}
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={sortedModels()}>
                {(model) => (
                  <tr>
                    <td style="font-family: var(--font-mono); font-size: var(--font-size-sm);">
                      {model.model_name}
                    </td>
                    <td>{model.provider}</td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <For each={CAPABILITIES}>
                          {(cap) => (
                            <CapabilityIcon
                              enabled={model[cap.key]}
                              icon={cap.icon}
                              title={cap.title}
                              desc={cap.desc}
                            />
                          )}
                        </For>
                      </div>
                    </td>
                    <td style="font-family: var(--font-mono);">
                      {formatPrice(model.input_price_per_million)}
                    </td>
                    <td style="font-family: var(--font-mono);">
                      {formatPrice(model.output_price_per_million)}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        </Show>
      </Show>
    </div>
  );
};

export default ModelPrices;
