// Shared types for Blogging category components

/**
 * Represents a blog post with metadata.
 * @interface Post
 * @property {string} [title] - Post title
 * @property {string} [excerpt] - Brief description or summary
 * @property {string} [coverImage] - URL of the cover image
 * @property {object} [author] - Author information
 * @property {string} [author.name] - Author's display name
 * @property {string} [author.avatar] - Author's avatar URL
 * @property {string} [publishedAt] - ISO date string of publication
 * @property {string} [readTime] - Estimated read time (e.g., "5 min read")
 * @property {string[]} [tags] - Array of tag labels
 * @property {string} [category] - Category name
 * @property {string} [url] - External URL for the post
 */
export interface Post {
  title?: string
  excerpt?: string
  coverImage?: string
  author?: {
    name?: string
    avatar?: string
  }
  publishedAt?: string
  readTime?: string
  tags?: string[]
  category?: string
  url?: string
}
