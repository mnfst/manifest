import { createSignal, onCleanup, type Component } from 'solid-js';
import { Portal } from 'solid-js/web';

interface Props {
  text: string;
}

const InfoTooltip: Component<Props> = (props) => {
  const [expanded, setExpanded] = createSignal(false);
  const [pos, setPos] = createSignal<{
    top: number;
    left: number;
    placement: 'above' | 'below';
  } | null>(null);
  let iconRef: HTMLSpanElement | undefined;

  const updatePos = () => {
    if (!iconRef) return;
    const rect = iconRef.getBoundingClientRect();
    const placement = rect.top < 72 ? 'below' : 'above';
    const left = Math.min(Math.max(rect.left + rect.width / 2, 16), window.innerWidth - 16);
    setPos({
      top: placement === 'above' ? rect.top - 8 : rect.bottom + 8,
      left,
      placement,
    });
  };

  const show = () => {
    updatePos();
    setExpanded(true);
  };

  const hide = () => setExpanded(false);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (expanded()) hide();
      else show();
    } else if (e.key === 'Escape') {
      hide();
    }
  };

  // Clean up on unmount
  onCleanup(hide);

  return (
    <span
      ref={iconRef}
      class="info-tooltip"
      classList={{ 'info-tooltip--active': expanded() }}
      tabindex="0"
      role="button"
      aria-label={`Info: ${props.text}`}
      aria-expanded={expanded()}
      onKeyDown={handleKeyDown}
      onClick={() => (expanded() ? hide() : show())}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusOut={hide}
    >
      <svg
        class="info-tooltip__icon"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      {expanded() && pos() && (
        <Portal>
          <span
            class="info-tooltip__bubble"
            role="tooltip"
            style={{
              position: 'fixed',
              top: `${pos()!.top}px`,
              left: `${pos()!.left}px`,
              transform:
                pos()!.placement === 'above' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            }}
          >
            {props.text}
          </span>
        </Portal>
      )}
    </span>
  );
};

export default InfoTooltip;
