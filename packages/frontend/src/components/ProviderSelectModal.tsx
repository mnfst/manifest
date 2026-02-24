import { createSignal, For, Show, type Component } from "solid-js";
import { PROVIDERS } from "../services/providers.js";
import { providerIcon } from "./ProviderIcon.js";
import { connectProvider, disconnectProvider, type RoutingProvider } from "../services/api.js";
import { toast } from "../services/toast-store.js";

interface Props {
  providers: RoutingProvider[];
  onClose: () => void;
  onUpdate: () => void;
}

const ProviderSelectModal: Component<Props> = (props) => {
  const [busy, setBusy] = createSignal<string | null>(null);
  const [expanded, setExpanded] = createSignal<string | null>(null);
  const [keyInputs, setKeyInputs] = createSignal<Record<string, string>>({});

  const getProvider = (provId: string) =>
    props.providers.find((p) => p.provider === provId);

  const isConnected = (provId: string): boolean => {
    const p = getProvider(provId);
    return !!p && p.is_active && p.has_api_key;
  };

  const toggleExpand = (provId: string) => {
    setExpanded((cur) => (cur === provId ? null : provId));
  };

  const getKeyInput = (provId: string) => keyInputs()[provId] ?? "";

  const setKeyInput = (provId: string, value: string) => {
    setKeyInputs((prev) => ({ ...prev, [provId]: value }));
  };

  const handleConnect = async (provId: string) => {
    const key = getKeyInput(provId);
    const isOllama = provId === "ollama";
    if (!isOllama && !key.trim()) return;

    setBusy(provId);
    try {
      await connectProvider({
        provider: provId,
        apiKey: isOllama ? undefined : key.trim(),
      });
      toast.success(`${provId} connected`);
      setKeyInput(provId, "");
      setExpanded(null);
      props.onUpdate();
    } catch {
      // error toast from fetchMutate
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async (provId: string) => {
    setBusy(provId);
    try {
      const result = await disconnectProvider(provId);
      if (result?.notifications?.length) {
        for (const msg of result.notifications) {
          toast.error(msg);
        }
      }
      setExpanded(null);
      props.onUpdate();
    } catch {
      // error toast from fetchMutate
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      class="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
      onKeyDown={(e) => { if (e.key === "Escape") props.onClose(); }}
    >
      <div
        class="modal-card"
        style="max-width: 480px; padding: 0;"
        role="dialog"
        aria-modal="true"
        aria-labelledby="provider-modal-title"
      >
        <div class="routing-modal__header">
          <div>
            <div class="routing-modal__title" id="provider-modal-title">Connect providers</div>
            <div class="routing-modal__subtitle">
              Add your API keys to enable routing through each provider
            </div>
          </div>
          <button class="modal__close" onClick={props.onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div class="provider-modal__list">
          <For each={PROVIDERS}>
            {(prov) => {
              const connected = () => isConnected(prov.id);
              const isExpanded = () => expanded() === prov.id;
              const isBusy = () => busy() === prov.id;
              const isOllama = prov.id === "ollama";

              return (
                <div>
                  <button
                    class="provider-toggle"
                    classList={{ "provider-toggle--active": connected() }}
                    onClick={() => toggleExpand(prov.id)}
                    disabled={isBusy()}
                    aria-expanded={isExpanded()}
                  >
                    <span class="provider-toggle__icon">
                      {providerIcon(prov.id, 20) ?? (
                        <span
                          class="provider-card__logo-letter"
                          style={{ background: prov.color }}
                        >
                          {prov.initial}
                        </span>
                      )}
                    </span>
                    <span class="provider-toggle__info">
                      <span class="provider-toggle__name">{prov.name}</span>
                      <span class="provider-toggle__subtitle">{prov.subtitle}</span>
                    </span>
                    <span
                      class="provider-toggle__badge"
                      classList={{ "provider-toggle__badge--connected": connected() }}
                    >
                      {connected() ? "Connected" : "Not connected"}
                    </span>
                  </button>

                  <Show when={isExpanded()}>
                    <div class="provider-toggle__expand">
                      <Show when={!isOllama}>
                        <div class="provider-toggle__key-row">
                          <input
                            class="provider-toggle__key-input"
                            type="password"
                            placeholder={connected() ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : `Enter ${prov.name} API key`}
                            aria-label={`${prov.name} API key`}
                            value={getKeyInput(prov.id)}
                            onInput={(e) => setKeyInput(prov.id, e.currentTarget.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleConnect(prov.id);
                            }}
                          />
                          <button
                            class="btn btn--primary btn--sm"
                            disabled={isBusy() || !getKeyInput(prov.id).trim()}
                            onClick={() => handleConnect(prov.id)}
                          >
                            {connected() ? "Update key" : "Connect"}
                          </button>
                        </div>
                      </Show>

                      <Show when={isOllama}>
                        <div class="provider-toggle__key-row">
                          <span style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground));">
                            No API key required for local models
                          </span>
                          <Show when={!connected()}>
                            <button
                              class="btn btn--primary btn--sm"
                              disabled={isBusy()}
                              onClick={() => handleConnect(prov.id)}
                            >
                              Connect
                            </button>
                          </Show>
                        </div>
                      </Show>

                      <Show when={connected()}>
                        <div class="provider-toggle__key-row" style="margin-top: 8px;">
                          <button
                            class="btn btn--outline btn--sm provider-toggle__disconnect-btn"
                            disabled={isBusy()}
                            onClick={() => handleDisconnect(prov.id)}
                          >
                            Disconnect
                          </button>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>

        <div class="provider-modal__footer">
          <button class="btn btn--primary" onClick={props.onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

export default ProviderSelectModal;
