import { Show, type Component, type JSX } from "solid-js";

interface Props {
  text?: string;
  children?: JSX.Element;
}

const InfoTooltip: Component<Props> = (props) => {
  return (
    <span class="info-tooltip" tabindex="0" role="note" aria-label={props.text ?? ""}>
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
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span class="info-tooltip__bubble">
        <Show when={props.children} fallback={props.text}>
          {props.children}
        </Show>
      </span>
    </span>
  );
};

export default InfoTooltip;
