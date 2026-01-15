/**
 * Preview background configurations for component screenshots.
 * Each category has a distinct gradient to make previews visually distinguishable.
 */

export interface PreviewBackground {
  gradient: string
  className: string
}

export const categoryBackgrounds: Record<string, PreviewBackground> = {
  form: {
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    className: 'from-indigo-500 to-purple-600'
  },
  payment: {
    gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    className: 'from-emerald-500 to-green-400'
  },
  messaging: {
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    className: 'from-pink-400 to-rose-500'
  },
  events: {
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
    className: 'from-violet-500 to-pink-500'
  },
  blogging: {
    gradient: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)',
    className: 'from-amber-400 to-red-500'
  },
  list: {
    gradient: 'linear-gradient(135deg, #00c6fb 0%, #005bea 100%)',
    className: 'from-cyan-400 to-blue-600'
  },
  miscellaneous: {
    gradient: 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)',
    className: 'from-teal-400 to-emerald-600'
  },
  selection: {
    gradient: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)',
    className: 'from-red-400 to-orange-400'
  },
  status: {
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    className: 'from-blue-500 to-blue-700'
  },
  social: {
    gradient: 'linear-gradient(135deg, #1DA1F2 0%, #0D8BD9 100%)',
    className: 'from-sky-500 to-sky-600'
  },
  map: {
    gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    className: 'from-emerald-600 to-emerald-700'
  }
}

export const defaultBackground: PreviewBackground = {
  gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  className: 'from-indigo-500 to-purple-600'
}

/**
 * Get the background configuration for a given category.
 */
export function getPreviewBackground(category: string): PreviewBackground {
  return categoryBackgrounds[category] || defaultBackground
}

/**
 * Preview viewport dimensions for consistent screenshots.
 * Using 1200x630 which is the optimal resolution for og:image (Open Graph).
 * This provides the best display across social media platforms.
 */
export const PREVIEW_VIEWPORT = {
  width: 1200,
  height: 630
} as const

/**
 * Preview container padding (px).
 */
export const PREVIEW_PADDING = 48
