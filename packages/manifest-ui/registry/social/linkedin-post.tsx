"use client"

import { Repeat2 } from "lucide-react"

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
    author?: string
    /** Author's professional headline or title. */
    headline?: string
    /** Avatar letter fallback or image URL for the profile picture. */
    avatar?: string
    /** Post text content (supports line breaks and hashtags). */
    content?: string
    /** Time since posted (e.g., "2h"). */
    time?: string
    /** URL to the original LinkedIn post. */
    postUrl?: string
  }
  actions?: {
    /** URL for the repost action. If provided, shows the repost button in footer. */
    repostUrl?: string
  }
}

const defaultData = {
  author: "Manifest",
  headline: "Manifest UI | 10K+ Developers",
  avatar: "M",
  content: "Excited to announce our latest milestone!\n\nWe've just crossed 10,000 developers using Manifest to build agentic UIs. Thank you to everyone who believed in our vision.\n\nWhat's next? We're working on something big. Stay tuned!\n\n#AI #AgenticUI #Developer #Startup",
  time: "2h"
}

/** LinkedIn logo icon component */
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

/**
 * A LinkedIn post embed component with professional styling.
 * Displays author info and content with optional repost action.
 *
 * Features:
 * - Author avatar with headline
 * - Multi-line content with hashtag support
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
 *     postUrl: "https://linkedin.com/posts/..."
 *   }}
 *   actions={{
 *     repostUrl: "https://linkedin.com/shareArticle?..."
 *   }}
 * />
 * ```
 */
export function LinkedInPost({ data, actions }: LinkedInPostProps) {
  const {
    author = defaultData.author,
    headline = defaultData.headline,
    avatar = defaultData.avatar,
    content = defaultData.content,
    time = defaultData.time,
    postUrl
  } = data ?? {}

  const { repostUrl } = actions ?? {}

  return (
    <div className="rounded-xl border bg-card">
      <div className="p-4">
        <div className="flex gap-3">
          <div className="h-12 w-12 rounded-full bg-[#0A66C2] text-white flex items-center justify-center font-semibold shrink-0">
            {avatar}
          </div>
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
        <p className="text-sm mt-3 whitespace-pre-wrap">{content}</p>
      </div>

      {/* Footer with repost button - only shows if repostUrl is provided */}
      {repostUrl && (
        <div className="px-4 py-2 border-t">
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
  )
}
