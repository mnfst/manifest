import { createSignal, Show, type Component } from 'solid-js';
import type { NewsItem } from '../services/news.js';

interface Props {
  item: NewsItem;
}

const dismissKey = (id: string) => `news_dismissed_${id}`;

const readDismissed = (id: string): boolean => {
  try {
    return !!localStorage.getItem(dismissKey(id));
  } catch {
    return false;
  }
};

const NewsBanner: Component<Props> = (props) => {
  const [dismissed, setDismissed] = createSignal(readDismissed(props.item.id));

  const dismiss = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      localStorage.setItem(dismissKey(props.item.id), '1');
    } catch {
      /* ignore storage failures (private mode, quota, etc.) */
    }
    setDismissed(true);
  };

  return (
    <Show when={!dismissed()}>
      <a class="news-banner" href={props.item.href} target="_blank" rel="noopener noreferrer">
        <img
          src={props.item.thumbnail}
          alt={props.item.title}
          class="news-banner__thumb"
          loading="lazy"
        />
        <div class="news-banner__body">
          <div class="news-banner__title">{props.item.title}</div>
          <p class="news-banner__blurb">{props.item.blurb}</p>
          <span class="news-banner__cta">{props.item.cta} &rarr;</span>
        </div>
        <button type="button" class="news-banner__dismiss" aria-label="Dismiss" onClick={dismiss}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </a>
    </Show>
  );
};

export default NewsBanner;
