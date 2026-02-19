import { Show, type Component } from "solid-js";

interface ErrorStateProps {
  /** The error object from createResource (used to extract a message). */
  error?: unknown;
  /** Override the default title ("Something went wrong"). */
  title?: string;
  /** Override the subtitle derived from the error message. */
  message?: string;
  /** Called when the user clicks "Try again". Omit to hide the retry button. */
  onRetry?: () => void;
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred. Please try again.";
}

const ErrorState: Component<ErrorStateProps> = (props) => {
  const displayMessage = () =>
    props.message ?? extractMessage(props.error);

  return (
    <div class="empty-state" role="alert">
      <div class="empty-state__title">
        {props.title ?? "Something went wrong"}
      </div>
      <p style="max-width: 420px; margin: 0 auto;">
        {displayMessage()}
      </p>
      <Show when={props.onRetry}>
        <button
          class="btn btn--outline"
          style="margin-top: var(--gap-md);"
          onClick={props.onRetry}
        >
          Try again
        </button>
      </Show>
    </div>
  );
};

export default ErrorState;
