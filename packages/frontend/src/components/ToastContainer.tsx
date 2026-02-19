import { For, onMount, onCleanup, type Component } from "solid-js";
import { toasts, dismissToast, type Toast } from "../services/toast-store.js";

const icons: Record<string, string> = {
  error:
    '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  success:
    '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  warning:
    '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
};

const ToastItem: Component<{ toast: Toast }> = (props) => {
  let timer: ReturnType<typeof setTimeout>;

  onMount(() => {
    timer = setTimeout(() => dismissToast(props.toast.id), props.toast.duration);
  });

  onCleanup(() => clearTimeout(timer));

  return (
    <div
      class={`toast toast--${props.toast.type}`}
      role="alert"
      aria-live="assertive"
    >
      <svg
        class="toast__icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        innerHTML={icons[props.toast.type]}
      />
      <span class="toast__message">{props.toast.message}</span>
      <button
        class="toast__dismiss"
        onClick={() => dismissToast(props.toast.id)}
        aria-label="Dismiss notification"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
};

const ToastContainer: Component = () => {
  return (
    <div class="toast-container">
      <For each={toasts()}>
        {(t) => <ToastItem toast={t} />}
      </For>
    </div>
  );
};

export default ToastContainer;
