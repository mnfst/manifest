import { createSignal, For, Show, onMount, onCleanup, type JSX } from 'solid-js';

export const FEEDBACK_TAGS = [
  'Not expected tier',
  'Poor answer quality',
  'Too slow',
  'Buggy',
  'Other',
] as const;

export interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (tags: string[], details: string) => void;
}

export default function FeedbackModal(props: FeedbackModalProps): JSX.Element {
  const [selectedTags, setSelectedTags] = createSignal<string[]>([]);
  const [details, setDetails] = createSignal('');

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function handleSubmit() {
    props.onSubmit(selectedTags(), details());
    setSelectedTags([]);
    setDetails('');
  }

  function handleClose() {
    setSelectedTags([]);
    setDetails('');
    props.onClose();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && props.open) handleClose();
  }

  onMount(() => document.addEventListener('keydown', onKeyDown));
  onCleanup(() => document.removeEventListener('keydown', onKeyDown));

  return (
    <Show when={props.open}>
      <div
        class="modal-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <div
          class="modal feedback-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Share feedback"
        >
          <div class="modal__header">
            <span class="modal__title">Share feedback</span>
            <button class="modal__close" onClick={handleClose} aria-label="Close" type="button">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
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
          <div style="padding: 12px var(--gap-lg);">
            <div class="feedback-modal__tags">
              <For each={FEEDBACK_TAGS as unknown as string[]}>
                {(tag) => (
                  <button
                    type="button"
                    class={`feedback-tag${selectedTags().includes(tag) ? ' feedback-tag--selected' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                )}
              </For>
            </div>
            <textarea
              class="feedback-modal__textarea"
              placeholder="Share details (optional)"
              value={details()}
              onInput={(e) => setDetails(e.currentTarget.value)}
              maxLength={2000}
            />
            <div class="feedback-modal__footer">
              <button type="button" class="btn btn--primary" onClick={handleSubmit}>
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
