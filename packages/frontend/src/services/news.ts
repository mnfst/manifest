/**
 * Lightweight, code-managed "News" banner shown on the Overview page.
 *
 * To publish a new item: edit `CURRENT_NEWS` below (give it a fresh `id` so the
 * banner re-shows to everyone who dismissed the previous one). Set it to `null`
 * to hide the banner entirely.
 *
 * Constraints: the thumbnail must be self-hosted under `public/` and `href`
 * opens in a new tab — Manifest's CSP forbids external images/iframes.
 */
export interface NewsItem {
  /** Stable id — drives per-item dismissal persistence. Bump it for new news. */
  id: string;
  title: string;
  blurb: string;
  /** Self-hosted thumbnail path under `public/` (e.g. `/news/foo.jpg`). */
  thumbnail: string;
  /** External URL opened in a new tab when the card is clicked. */
  href: string;
  /** Call-to-action label, e.g. `Watch` or `Read`. */
  cta: string;
}

export const CURRENT_NEWS: NewsItem | null = {
  id: 'best-ai-subscription-2026-06',
  title: "The best AI subscription isn't the one you think",
  blurb: 'Discover our AI subscription tier list and pick the plan that actually fits you.',
  thumbnail: '/news/best-ai-subscription.jpg',
  href: 'https://www.youtube.com/watch?v=scA_qaC9c08',
  cta: 'Watch',
};
