import { Show, type Component } from 'solid-js';
import { t } from '../i18n/index.js';

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
  if (typeof error === 'string') return error;
  return t('error.unexpected');
}

const ErrorState: Component<ErrorStateProps> = (props) => {
  const displayMessage = () => props.message ?? extractMessage(props.error);

  return (
    <div class="empty-state" role="alert">
      <div class="empty-state__title">{props.title ?? t('error.title')}</div>
      <p style="max-width: 420px; margin: 0 auto;">{displayMessage()}</p>
      <Show when={props.onRetry}>
        <button
          class="btn btn--outline btn--sm"
          style="margin-top: var(--gap-md);"
          onClick={props.onRetry}
        >
          {t('error.retry')}
        </button>
      </Show>
    </div>
  );
};

export default ErrorState;
