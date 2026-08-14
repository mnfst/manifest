import { Show, type Component } from 'solid-js';
import type { AuthType, CustomProviderData } from '../services/api.js';
import { providerIcon, customProviderLogo } from './ProviderIcon.js';
import { authBadgeFor } from './AuthBadge.js';
import { customProviderColor } from '../services/formatters.js';

interface DragGhostProps {
  /** Whether a touch drag is in flight. */
  show: boolean;
  /** Pointer position the ghost follows. */
  x: number;
  y: number;
  providerId?: string;
  authType?: AuthType | string | null;
  /** Model label shown on the ghost card. */
  label: string;
  customProvider?: CustomDataLike;
}

/** Loose shape of CustomProviderData so the ghost doesn't import the full type. */
interface CustomDataLike {
  name?: string;
  base_url?: string;
}

/**
 * Floating clone of the model chip/card that follows the finger during a
 * touch drag. Rendered fixed at the pointer position, pointer-events: none so
 * it never intercepts the gesture, and visually identical to the routing
 * chips so the user always sees exactly what they are dragging.
 */
const DragGhost: Component<DragGhostProps> = (props) => (
  <Show when={props.show}>
    <div
      class="drag-ghost"
      style={`transform: translate3d(${props.x}px, ${props.y}px, 0) translate(-50%, -115%);`}
      aria-hidden="true"
    >
      <span class="drag-ghost__icon">
        <Show
          when={props.providerId?.startsWith('custom:')}
          fallback={props.providerId ? providerIcon(props.providerId, 14) : null}
        >
          {(() => {
            const logo = customProviderLogo(
              props.customProvider?.name ?? '',
              14,
              props.customProvider?.base_url,
            );
            return (
              logo ?? (
                <span
                  style={`background: ${customProviderColor(props.customProvider?.name ?? '')}; width: 14px; height: 14px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 8px; color: #fff;`}
                >
                  {(props.customProvider?.name ?? 'C').charAt(0).toUpperCase()}
                </span>
              )
            );
          })()}
        </Show>
        {props.authType ? authBadgeFor(props.authType, 8) : null}
      </span>
      <span class="drag-ghost__label">{props.label}</span>
    </div>
  </Show>
);

export default DragGhost;
