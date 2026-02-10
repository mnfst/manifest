'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar, Clock, ExternalLink, Maximize2 } from 'lucide-react';
import { useMemo } from 'react';
import type { Post } from './types';
import { demoPostDetailData } from './demo/blogging';

// DOM-based allowlist HTML sanitizer for post content
const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
  'span', 'div', 'img', 'figure', 'figcaption', 'hr',
]);
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel', 'title']),
  img: new Set(['src', 'alt', 'width', 'height']),
  '*': new Set(['class', 'id']),
};
const DANGEROUS_URL = /^\s*(javascript|data):/i;

function sanitizeNode(node: Node, doc: Document): void {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === 3 /* TEXT */) continue;
    if (child.nodeType !== 1 /* ELEMENT */) {
      child.remove();
      continue;
    }
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      // Unwrap: keep text content, discard the tag
      while (el.firstChild) node.insertBefore(el.firstChild, el);
      el.remove();
      continue;
    }
    // Strip disallowed attributes
    const tagAllowed = ALLOWED_ATTRS[tag];
    const globalAllowed = ALLOWED_ATTRS['*'];
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (!tagAllowed?.has(name) && !globalAllowed?.has(name)) {
        el.removeAttribute(attr.name);
      }
    }
    // Block dangerous URL schemes on href/src
    for (const urlAttr of ['href', 'src']) {
      const val = el.getAttribute(urlAttr);
      if (val && DANGEROUS_URL.test(val)) el.removeAttribute(urlAttr);
    }
    sanitizeNode(el, doc);
  }
}

function sanitizeHtml(html: string): string {
  if (typeof document === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  sanitizeNode(doc.body, doc);
  return doc.body.innerHTML;
}

function TagList({
  tags,
  maxVisible = 2,
  size = 'default',
}: {
  tags: string[];
  maxVisible?: number;
  size?: 'small' | 'default';
}) {
  const visibleTags = tags.slice(0, maxVisible);
  const remainingTags = tags.slice(maxVisible);
  const hasMore = remainingTags.length > 0;

  const tagClass =
    size === 'small'
      ? 'rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium'
      : 'rounded-full bg-muted px-3 py-1 text-xs font-medium';

  return (
    <>
      {visibleTags.map((tag) => (
        <span key={tag} className={tagClass}>
          {tag}
        </span>
      ))}
      {hasMore && (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`${tagClass} cursor-default`}>+{remainingTags.length}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{remainingTags.join(', ')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PostDetailProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the PostDetail component, a full post detail view with Medium-style typography.
 */
export interface PostDetailProps {
  data?: {
    /** The main blog post to display. */
    post?: Post;
    /** HTML content of the post body. */
    content?: string;
    /** Related posts to show at the bottom of the article. */
    relatedPosts?: Post[];
  };
  actions?: {
    /** Called when the back button is clicked. */
    onBack?: () => void;
    /** Called when the read more button is clicked (inline mode). */
    onReadMore?: () => void;
    /** Called when a related post is clicked. */
    onReadRelated?: (post: Post) => void;
  };
  appearance?: {
    /**
     * Whether to show the cover image.
     * @default true
     */
    showCover?: boolean;
    /**
     * Whether to show author information.
     * @default true
     */
    showAuthor?: boolean;
    /**
     * Display mode for the component.
     * - inline: Compact card view with truncated content
     * - pip: Picture-in-picture view with truncated content
     * - fullscreen: Full article view with complete content
     * @default "fullscreen"
     */
    displayMode?: 'inline' | 'pip' | 'fullscreen';
  };
}

/**
 * A full post detail component with Medium-style typography.
 * Supports inline preview and fullscreen reading modes.
 *
 * Features:
 * - Medium-style typography and spacing
 * - Cover image display
 * - Author info with avatar
 * - Tag list with overflow tooltip
 * - Related posts section
 * - Inline (truncated) and fullscreen modes
 * - MCP Apps display mode integration
 *
 * @component
 * @example
 * ```tsx
 * <PostDetail
 *   data={{
 *     post: {
 *       id: "1",
 *       title: "Getting Started",
 *       excerpt: "Learn the basics...",
 *       coverImage: "https://example.com/cover.jpg",
 *       author: { name: "Sarah Chen", avatar: "https://example.com/avatar.jpg" },
 *       publishedAt: "2024-01-15",
 *       readTime: "5 min read",
 *       tags: ["Tutorial", "Components"],
 *       category: "Tutorial"
 *     },
 *     content: "<p>Full post content here...</p>",
 *     relatedPosts: [...]
 *   }}
 *   actions={{
 *     onReadMore: () => console.log("Expand to fullscreen"),
 *     onReadRelated: (post) => console.log("Read related:", post.title)
 *   }}
 *   appearance={{
 *     showCover: true,
 *     showAuthor: true,
 *     displayMode: "fullscreen"
 *   }}
 * />
 * ```
 */
export function PostDetail({ data, actions, appearance }: PostDetailProps) {
  const resolved: NonNullable<PostDetailProps['data']> = data ?? demoPostDetailData;
  const post = resolved.post;
  const rawContent = resolved.content;
  const content = useMemo(() => rawContent ? sanitizeHtml(rawContent) : undefined, [rawContent]);
  const relatedPosts = resolved.relatedPosts ?? [];
  const onReadMore = actions?.onReadMore;
  const showCover = appearance?.showCover ?? true;
  const showAuthor = appearance?.showAuthor ?? true;

  const displayMode = appearance?.displayMode ?? 'inline';

  const handleReadMore = () => {
    onReadMore?.();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Inline mode - card view with truncated content
  if (displayMode === 'inline') {
    return (
      <div className="flex flex-col sm:flex-row gap-4 rounded-lg border bg-card p-3">
        {showCover && post?.coverImage && (
          <div className="aspect-video sm:aspect-square sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-md">
            <img
              src={post.coverImage}
              alt={post?.title || ''}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {post?.category && (
                  <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {post.category}
                  </p>
                )}

                {post?.title && (
                  <h1 className="line-clamp-2 text-sm font-bold leading-tight">{post.title}</h1>
                )}
              </div>
              <button
                onClick={handleReadMore}
                className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Expand to fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>

            {post?.excerpt && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{post.excerpt}</p>
            )}

            {post?.tags && post.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                <TagList tags={post.tags} maxVisible={2} size="small" />
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {showAuthor && post?.author?.avatar && (
                <img
                  src={post.author.avatar}
                  alt={post?.author?.name || ''}
                  className="h-4 w-4 rounded-full"
                />
              )}
              {showAuthor && post?.author?.name && <span>{post.author.name}</span>}
              {post?.publishedAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(post.publishedAt)}
                </span>
              )}
              {post?.readTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {post.readTime}
                </span>
              )}
            </div>

            <Button size="sm" onClick={handleReadMore}>
              Read
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // PiP mode - horizontal layout with image on left, similar to post-card horizontal
  if (displayMode === 'pip') {
    return (
      <div className="flex flex-col sm:flex-row gap-4 rounded-lg border bg-card p-3">
        {showCover && post?.coverImage && (
          <div className="aspect-video sm:aspect-square sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-md">
            <img
              src={post.coverImage}
              alt={post?.title || ''}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            {post?.category && (
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {post.category}
              </p>
            )}

            {post?.title && (
              <h1 className="line-clamp-2 text-sm font-bold leading-tight">{post.title}</h1>
            )}

            {post?.excerpt && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{post.excerpt}</p>
            )}

            {post?.tags && post.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                <TagList tags={post.tags} maxVisible={2} size="small" />
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {showAuthor && post?.author?.avatar && (
                <img
                  src={post.author.avatar}
                  alt={post?.author?.name || ''}
                  className="h-4 w-4 rounded-full"
                />
              )}
              {showAuthor && post?.author?.name && <span>{post.author.name}</span>}
              {post?.publishedAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(post.publishedAt)}
                </span>
              )}
              {post?.readTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {post.readTime}
                </span>
              )}
            </div>
            <Button size="sm" onClick={handleReadMore}>
              Read
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Fullscreen mode
  return (
    <div className="min-h-screen fs-mode bg-background">
      <article className="mx-auto w-full max-w-[680px] px-6 py-10">
        {showCover && post?.coverImage && (
          <div className="aspect-video w-full overflow-hidden rounded-lg mb-8">
            <img
              src={post.coverImage}
              alt={post?.title || ''}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        {post?.category && (
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {post.category}
          </p>
        )}

        {post?.title && (
          <h1 className="text-[32px] font-bold leading-[1.25] tracking-tight md:text-[42px]">
            {post.title}
          </h1>
        )}

        {post?.tags && post.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <TagList tags={post.tags} maxVisible={2} size="default" />
          </div>
        )}

        {showAuthor && post?.author && (
          <div className="mt-8 flex items-center gap-4 border-b pb-8">
            {post.author.avatar && (
              <img
                src={post.author.avatar}
                alt={post.author.name || ''}
                className="h-12 w-12 rounded-full"
              />
            )}
            <div>
              {post.author.name && <p className="font-medium">{post.author.name}</p>}
              {(post?.publishedAt || post?.readTime) && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {post?.publishedAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(post.publishedAt)}
                    </span>
                  )}
                  {post?.readTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {post.readTime}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Medium-style content */}
        <div className="mt-10">
          {post?.excerpt && (
            <p className="text-[21px] leading-[1.8] text-muted-foreground mb-8">{post.excerpt}</p>
          )}
          {content && (
            <div
              className="
                text-[21px] leading-[1.8] tracking-[-0.003em]
                [&>p]:mb-8
                [&>h2]:text-[26px] [&>h2]:font-bold [&>h2]:mt-12 [&>h2]:mb-4 [&>h2]:leading-[1.3]
                [&>h3]:text-[22px] [&>h3]:font-bold [&>h3]:mt-10 [&>h3]:mb-3 [&>h3]:leading-[1.3]
                [&>ul]:mb-8 [&>ul]:pl-6 [&>ul>li]:mb-2
                [&>ol]:mb-8 [&>ol]:pl-6 [&>ol>li]:mb-2
                [&>blockquote]:border-l-4 [&>blockquote]:border-foreground [&>blockquote]:pl-6 [&>blockquote]:my-8 [&>blockquote]:italic
              "
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}
        </div>

        {relatedPosts && relatedPosts.length > 0 && (
          <div className="mt-16 border-t pt-10">
            <h3 className="mb-6 text-lg font-semibold">Related Posts</h3>
            <div className="space-y-4">
              {relatedPosts.map((related) => (
                <a
                  key={related.title || related.url}
                  href={related.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-4 rounded-lg p-3 text-left transition-colors hover:bg-muted cursor-pointer"
                >
                  {related.coverImage && (
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                      <img
                        src={related.coverImage}
                        alt={related.title || ''}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {related.title && <p className="font-medium">{related.title}</p>}
                    {related.excerpt && (
                      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                        {related.excerpt}
                      </p>
                    )}
                    {related.readTime && (
                      <p className="mt-1 text-xs text-muted-foreground">{related.readTime}</p>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
