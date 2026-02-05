'use client';

import { Repeat2 } from 'lucide-react';
import type { JSX } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import { demoLinkedInPost } from './demo/social';

/** Reaction type for LinkedIn posts */
type ReactionType = 'like' | 'celebrate' | 'support' | 'love' | 'insightful' | 'funny';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LinkedInPostProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the LinkedInPost component, which displays a LinkedIn-style
 * post with professional author info.
 */
export interface LinkedInPostProps {
  data?: {
    /** Author's display name. */
    author?: string;
    /** Author's professional headline or title. */
    headline?: string;
    /** Avatar letter fallback or image URL for the profile picture. */
    avatar?: string;
    /** Post text content (supports line breaks and hashtags). */
    content?: string;
    /** Time since posted (e.g., "2h"). */
    time?: string;
    /** Optional image URL for the post. */
    image?: string;
    /** Number of reactions (e.g., "1,234" or "1.2K"). */
    reactions?: string;
    /** Top reaction types to display (max 3 icons shown). */
    topReactions?: ReactionType[];
    /** Number of comments (e.g., "56"). */
    comments?: string;
    /** Number of reposts (e.g., "12"). */
    reposts?: string;
    /** URL to the original LinkedIn post. If provided, shows the LinkedIn icon. */
    postUrl?: string;
    /** URL for the repost action. If provided, shows the repost button in footer. */
    repostUrl?: string;
  };
  appearance?: {
    /** Maximum number of lines to show before truncating. @default 3 */
    maxLines?: number;
  };
}

/** Parses content and styles hashtags and links */
function formatContent(content: string): React.ReactNode[] {
  // Regex to match hashtags and URLs
  const pattern = /(#\w+)|(https?:\/\/[^\s]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const hashtag = match[1];
    const url = match[2];

    if (hashtag) {
      // Style hashtag
      parts.push(
        <span key={match.index} className="font-semibold" style={{ color: '#0a66c2' }}>
          {hashtag}
        </span>
      );
    } else if (url) {
      // Style link
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold hover:underline"
          style={{ color: '#0a66c2' }}
        >
          {url}
        </a>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

/** LinkedIn logo icon component */
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

/** Reaction icon components - Official LinkedIn reaction SVGs */
const reactionIcons: Record<ReactionType, JSX.Element> = {
  like: (
    <svg viewBox="0 0 48 48" className="h-5 w-5">
      <circle cx="24" cy="24" r="22" fill="#378fe9" />
      <path
        d="M25.22 19.08H11.76A2.7 2.7 0 009 22a2.85 2.85 0 002.91 2.67h.5A2.43 2.43 0 0010 27.18a2.52 2.52 0 002.31 2.5 2.51 2.51 0 001.05 4.45 2.54 2.54 0 00-.19 1.87 2.69 2.69 0 002.66 2H23a11.51 11.51 0 002.8-.37l4.52-1.32c.27-.08 4.19 0 6 0 3.15-.12 4-14.57 0-14.57 0 0-1.45.05-1.73 0s-.46-.6-1.25-1.45l-.07-.09c-1.15-1.24-2.45-2.85-3.37-3.75-2.24-2.19-4.08-4.07-5.38-6.92-.73-1.62-.81-2.35-2.35-2.35a2.45 2.45 0 00-2.1 2.56 23.77 23.77 0 00.32 2.52 23.64 23.64 0 003.1 6.92"
        fill="#d0e8ff"
        fillRule="evenodd"
      />
      <path
        d="M25.22 19.08H11.76a2.76 2.76 0 00-2.76 3 2.84 2.84 0 002.92 2.64h.5a2.43 2.43 0 00-2.37 2.51 2.52 2.52 0 002.31 2.5h0a2.51 2.51 0 001.05 4.45 2.51 2.51 0 00-.24 1.82 2.69 2.69 0 002.66 2H23a12.08 12.08 0 002.8-.36l4.52-1.32c.27-.08 4.19 0 6 0 3.15-.12 4-14.57 0-14.57h-1.73c-.28 0-.46-.59-1.25-1.44l-.07-.09c-1.15-1.25-2.45-2.85-3.37-3.76-2.24-2.18-4.08-4.06-5.38-6.92-.73-1.61-.81-2.41-2.35-2.34a2.32 2.32 0 00-1.58.8 2.35 2.35 0 00-.52 1.71 23.45 23.45 0 00.32 2.52 23.32 23.32 0 003.1 6.89"
        fill="none"
        stroke="#004182"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  ),
  celebrate: (
    <svg viewBox="0 0 48 48" className="h-5 w-5">
      <circle cx="24" cy="24" r="22" fill="#6dae4f" />
      <path
        d="M45.57 31l-1.42-1.07s-.59-5.63-1.61-6.71a18.45 18.45 0 01-3.81-7.49c-.49-1.67-.83-2.26-2.33-2.29a2.29 2.29 0 00-2 2.52 17.11 17.11 0 00.21 2.25c.55 2.92 1.15 5.31 1.23 5.45L22.3 13.53c-1-.77-2.49-1.11-3.49.22s-.19 2.55.83 3.32l7.07 5.32L28.83 24l-11.32-8.53c-1-.77-2.49-1.11-3.48.22s-.2 2.55.82 3.32l7.07 5.32 4.25 3.19L17 20.6c-1-.76-2.48-1.11-3.48.22s-.19 2.56.82 3.32l7.08 5.33L25 32.13l-7.1-5.33c-1-.76-2.46-1.14-3.42.13a2.37 2.37 0 00.76 3.41l12.67 9.47c2.24 1.67 6.26 1.89 6.2 1.89a19.63 19.63 0 002.44 1.3 10.12 10.12 0 006.36-4 15 15 0 002.66-8z"
        fill="#ddf6d1"
        fillRule="evenodd"
      />
      <path
        d="M15.57 5.44l.7 3.12M25.49 9.25l-2.6 1.85M21.48 4.87l-1.9 5"
        fill="none"
        stroke="#165209"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M45.42 31A7 7 0 0144 28.61c-.16-.67-.2-1.36-.33-2-.19-1-.36-2.59-1.12-3.4a18.45 18.45 0 01-3.81-7.49c-.49-1.67-.83-2.26-2.33-2.29a2.29 2.29 0 00-2 2.52 17.11 17.11 0 00.21 2.25c.55 2.92 1.15 5.31 1.23 5.45L22.3 13.53c-1-.77-2.49-1.11-3.49.22s-.19 2.55.83 3.32l7.07 5.32L28.83 24l-11.32-8.53c-1-.77-2.49-1.11-3.48.22s-.2 2.55.82 3.32l7.07 5.32 4.25 3.19L17 20.6c-1-.76-2.48-1.11-3.48.22s-.19 2.56.82 3.32l7.08 5.33L25 32.13l-7.1-5.33c-1-.76-2.46-1.14-3.42.13a2.37 2.37 0 00.76 3.41l12.67 9.47a8.29 8.29 0 003.55 1.56c.57.1 1.17.16 1.83.28a9.08 9.08 0 012.73.92 2.6 2.6 0 001.9.15 11.78 11.78 0 005.55-4.06 11.28 11.28 0 002.19-6.25 2.61 2.61 0 00-.24-1.41zM37.07 24.58L34.94 23"
        fill="none"
        stroke="#165209"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  ),
  support: (
    <svg viewBox="0 0 48 48" className="h-5 w-5">
      <circle cx="24" cy="24" r="22" fill="#bba9d1" />
      <path
        d="M42.46 40.81a68.7 68.7 0 01-10.61-1h-.19a60.42 60.42 0 01-7.87-1.64c-2.29-.69-4.54-1.58-6.73-2.44l-1-.38c-2.09-.81-3.75-1.49-5.29-2.14l-.58-.24a21.88 21.88 0 01-2.68-1.27C6.34 31 6 30.06 6.49 29v-.09a1.77 1.77 0 011.74-1h.13a4.69 4.69 0 01.53 0c1.9.21 7.41 2.3 8.5 2.72l3.55.12H21l8 .28c-.62-.57-2.2-1.57-6-2.57-.73-.18-1.4-.39-1.56-.93a2.16 2.16 0 01.7-2.26 2.86 2.86 0 011.69-.39 8.72 8.72 0 012.09.25c.4.1.74.21 1 .31a12.13 12.13 0 002.59.58 27 27 0 014.29.98c4.48 1.2 5.35 3.45 5.92 4.81-.18-.56 0-.15.08-.36l.13-.17h.69c.77 0 2.23-.08 2.25-.08.37 0 2.1-.43 2.1-.08a18.84 18.84 0 01-2 9.41.61.61 0 01-.43.3z"
        fill="#eae2f3"
      />
      <path
        d="M17.81 10.09a4.52 4.52 0 00-6.4-.08l-.07.08a4.7 4.7 0 000 6.58l7 7.07 7-7.08a4.71 4.71 0 000-6.57 4.5 4.5 0 00-6.46 0l-.52.52z"
        fill="#ecaa96"
        fillRule="evenodd"
      />
      <path
        d="M45.79 31.2c.32.23.33 2.66-.37 4.79a10.73 10.73 0 01-3.05 4.16c-.37.34-13.21-1.15-16.29-1.66S8 31.29 7.37 31s-.63-2.65 1-3.13 5.93 2.1 8.59 2.33 8.78.47 11 .47-2-1.51-3.11-1.91S22 28 21.64 26.9s.83-1.9 1.82-1.9a29.24 29.24 0 015.31 1.26 18.66 18.66 0 017 1.13A8.06 8.06 0 0140 31.2c.32.61 5.46-.2 5.79 0z"
        fill="none"
        stroke="#493d57"
        strokeWidth="2"
      />
      <path
        d="M9.2 27.44c-.66-1.93.42-2.94 1.64-2.94s2.5 1.22 4.54 2.59A48.66 48.66 0 0022 30.5"
        fill="none"
        stroke="#493d57"
        strokeWidth="2"
      />
      <path
        d="M17.92 9.45a5 5 0 00-7 7L18.47 24l7.59-7.55a4.93 4.93 0 001.37-4.32 5 5 0 00-2.71-3.63 4.81 4.81 0 00-2.18-.5 4.93 4.93 0 00-3.49 1.47l-.58.54z"
        fill="none"
        stroke="#77280c"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  ),
  love: (
    <svg viewBox="0 0 48 48" className="h-5 w-5">
      <circle cx="24" cy="24" r="22" fill="#df704d" />
      <path
        d="M23.08 14.6a8.21 8.21 0 00-11.66 0 8.35 8.35 0 000 11.76L24 39l12.58-12.64a8.35 8.35 0 000-11.75 8.13 8.13 0 00-11.63 0l-.94.9z"
        fill="#fff3f0"
        stroke="#77280c"
        fillRule="evenodd"
      />
      <path
        d="M23.08 14.44a8.18 8.18 0 00-11.66 0 8.35 8.35 0 000 11.76L24 38.83 36.58 26.2a8.37 8.37 0 000-11.76 8.11 8.11 0 00-11.62 0l-.94.9z"
        fill="none"
        stroke="#77280c"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M23 15.71a9.93 9.93 0 01.84 1.2 1 1 0 001.72-1 13 13 0 00-1.15-1.6 1 1 0 00-1.76.39 1 1 0 00.35 1.01z"
        fill="#77280c"
        fillRule="evenodd"
      />
    </svg>
  ),
  insightful: (
    <svg viewBox="0 0 48 48" className="h-5 w-5">
      <circle cx="24" cy="24" r="22" fill="#f5bb5c" />
      <path
        d="M26.58 41h-5a1.68 1.68 0 01-1.68-1.68v-4.2h8.4v4.2A1.69 1.69 0 0126.58 41z"
        fill="#ffe1b2"
        fillRule="evenodd"
      />
      <path
        d="M19.87 35.92v-.84a10 10 0 00-.48-3.08 10.08 10.08 0 00-1.62-2.51 10.23 10.23 0 01-3.77-7.8v-.05a10.08 10.08 0 1120.16 0 10.55 10.55 0 01-4 8l-.13.11a3.75 3.75 0 00-.57.62 5.43 5.43 0 00-.72 1.47 10.05 10.05 0 00-.47 3.22v.84"
        fill="#fcf0de"
        fillRule="evenodd"
      />
      <path
        d="M14 7.36l2.12 2.77M35 7.36l-2.12 2.77M24.06 4v4.2"
        fill="none"
        stroke="#5d3b01"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M22.3 13.86a7 7 0 00-3.84 2.08 7.85 7.85 0 00-2.14 3.8"
        fill="none"
        stroke="#fff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <path
        d="M26.58 41h-5a1.68 1.68 0 01-1.68-1.68v-4.2h8.4v4.2A1.69 1.69 0 0126.58 41z"
        fill="none"
        stroke="#5d3b01"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M19.86 35.92v-.84a10 10 0 00-.48-3.08 5.7 5.7 0 00-.82-1.49 8.06 8.06 0 00-1.16-1.31 11.05 11.05 0 01-1.17-1.2A10.53 10.53 0 0114 21.66v-.05a10.08 10.08 0 1117.88 6.28 12.25 12.25 0 01-1.79 1.81 3.54 3.54 0 00-.62.66 5.74 5.74 0 00-.72 1.47 10.34 10.34 0 00-.47 3.22v.84"
        fill="none"
        stroke="#5d3b01"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  ),
  funny: (
    <svg viewBox="0 0 48 48" className="h-5 w-5">
      <circle cx="24" cy="24" r="22" fill="#44bfd3" />
      <circle cx="24" cy="24" r="16" fill="#d5f9fe" stroke="#104e58" strokeWidth="1.8" />
      <path
        d="M14.67,21.01l-.19,.3,.68,.7,.42-.26c1.82-1.12,4.02-1.45,6.08-.9l.46-.86c-2.28-1.99-5.79-1.5-7.45,1.02Z"
        fill="#104e58"
      />
      <path
        d="M33.44,21.34c-1.46-2.65-4.92-3.39-7.35-1.59l-.28,.21,.41,.89h0c2.23-.52,4.59-.11,6.51,1.15l.71-.66Z"
        fill="#104e58"
      />
      <path
        d="M19.49,14.23c-1.34-.06-3.99,.27-5.49,2.77"
        fill="none"
        stroke="#104e58"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M29,14.72c1.34-.06,3.99,.27,5.49,2.77"
        fill="none"
        stroke="#104e58"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M31.59,26h-15.18c-.69,0-1.18,.76-.93,1.48,1.1,3.13,3.24,7.47,8.51,7.47s7.42-4.34,8.51-7.47c.25-.72-.24-1.48-.93-1.48Z"
        fill="#2199ac"
      />
      <path
        d="M24,30c-4,0-6.62,1.74-5,3,.91,.71,3,1.49,5,1.5,2,0,4.26-.76,5-1.5,1.26-1.26-1-3-5-3Z"
        fill="#d5f9fe"
      />
      <path
        d="M31.56,25.1h-15.11c-1.4,0-2.47,1.38-1.97,2.76,.58,1.61,1.46,3.6,2.94,5.21,1.51,1.63,3.63,2.83,6.59,2.83s5.08-1.2,6.59-2.83c1.48-1.6,2.36-3.6,2.94-5.21,.5-1.38-.57-2.76-1.97-2.76Zm-2.29,6.74c-1.21,1.31-2.87,2.26-5.26,2.26s-4.06-.95-5.26-2.26c-1.24-1.33-2.02-3.06-2.57-4.59-.05-.15,.05-.35,.28-.35h15.11c.22,0,.33,.2,.28,.35-.55,1.53-1.33,3.26-2.57,4.59Z"
        fill="#104e58"
      />
    </svg>
  ),
};

/**
 * A LinkedIn post embed component with professional styling.
 * Displays author info and content with optional repost action.
 *
 * Features:
 * - Author avatar with headline
 * - Multi-line content with hashtag support
 * - Optional post image
 * - Expandable content with "...more" button
 * - LinkedIn icon link to original post (optional)
 * - Repost button in footer (optional, footer only shows if repostUrl provided)
 *
 * @component
 * @example
 * ```tsx
 * <LinkedInPost
 *   data={{
 *     author: "Manifest",
 *     headline: "Building the future of AI",
 *     avatar: "M",
 *     content: "Excited to share our latest update!",
 *     time: "2h",
 *     image: "https://images.pexels.com/photos/417173/pexels-photo-417173.jpeg"
 *   }}
 *   actions={{
 *     postUrl: "https://linkedin.com/posts/...",
 *     repostUrl: "https://linkedin.com/shareArticle?..."
 *   }}
 *   appearance={{
 *     maxLines: 3
 *   }}
 * />
 * ```
 */
export function LinkedInPost({ data, appearance }: LinkedInPostProps) {
  const resolved: NonNullable<LinkedInPostProps['data']> = data ?? demoLinkedInPost;
  const {
    author,
    headline,
    avatar,
    content,
    time,
    image,
    reactions,
    topReactions,
    comments,
    reposts,
    postUrl,
    repostUrl,
  } = resolved;

  const { maxLines = 3 } = appearance ?? {};

  const hasEngagement = reactions || comments || reposts;

  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const contentRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (el) {
      // Check if content is truncated
      setIsTruncated(el.scrollHeight > el.clientHeight);
    }
  }, [content, maxLines]);

  const handleExpand = () => {
    setIsExpanded(true);
  };

  return (
    <div className="rounded-xl border bg-card">
      <div className="p-4">
        <div className="flex gap-3">
          {avatar && (
            <div className="h-12 w-12 rounded-full bg-[#0A66C2] text-white flex items-center justify-center font-semibold shrink-0">
              {avatar}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-sm">{author}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{headline}</p>
                <p className="text-xs text-muted-foreground">{time}</p>
              </div>
              {postUrl && (
                <a
                  href={postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0A66C2] hover:text-[#004182] transition-colors"
                  aria-label="View on LinkedIn"
                >
                  <LinkedInIcon className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <p
            ref={contentRef}
            className="text-sm whitespace-pre-wrap"
            style={
              !isExpanded
                ? {
                    WebkitLineClamp: maxLines,
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }
                : undefined
            }
          >
            {content ? formatContent(content) : null}
          </p>
          {isTruncated && !isExpanded && (
            <button
              onClick={handleExpand}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              ...more
            </button>
          )}
        </div>
      </div>

      {/* Image section */}
      {image && (
        <div className="w-full">
          <img src={image} alt="Post image" className="w-full object-cover max-h-[400px]" />
        </div>
      )}

      {/* Engagement stats - reactions, comments, reposts */}
      {hasEngagement && (
        <div className="px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            {topReactions && topReactions.length > 0 && (
              <div className="flex -space-x-1">
                {topReactions.slice(0, 3).map((type, idx) => (
                  <div
                    key={type}
                    className="ring-2 ring-card rounded-full"
                    style={{ zIndex: 3 - idx }}
                  >
                    {reactionIcons[type]}
                  </div>
                ))}
              </div>
            )}
            {reactions && <span className="ml-1">{reactions}</span>}
          </div>
          <div className="flex items-center gap-3">
            {comments && <span>{comments} comments</span>}
            {reposts && <span>{reposts} reposts</span>}
          </div>
        </div>
      )}

      {/* Footer with repost button - only shows if repostUrl is provided */}
      {repostUrl && (
        <div className="px-4 py-2 border-t flex justify-end">
          <a
            href={repostUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-md transition-colors text-sm text-muted-foreground"
          >
            <Repeat2 className="h-5 w-5" />
            <span>Repost</span>
          </a>
        </div>
      )}
    </div>
  );
}
