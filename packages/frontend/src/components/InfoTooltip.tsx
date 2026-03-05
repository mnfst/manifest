import { createSignal, type Component } from 'solid-js';

interface Props {
  text: string;
}

const InfoTooltip: Component<Props> = (props) => {
  const [expanded, setExpanded] = createSignal(false);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded(!expanded());
    } else if (e.key === 'Escape') {
      setExpanded(false);
    }
  };

  return (
    <span
      class="info-tooltip"
      classList={{ 'info-tooltip--active': expanded() }}
      tabindex="0"
      role="button"
      aria-label={`Info: ${props.text}`}
      aria-expanded={expanded()}
      onKeyDown={handleKeyDown}
      onClick={() => setExpanded(!expanded())}
      onFocusOut={() => setExpanded(false)}
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
      <span class="info-tooltip__bubble" role="tooltip">
        {props.text}
      </span>
    </span>
  );
};

export default InfoTooltip;
