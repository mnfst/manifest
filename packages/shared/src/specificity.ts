export const SPECIFICITY_CATEGORIES = [
  'coding',
  'web_browsing',
  'data_analysis',
  'image_generation',
  'video_generation',
  'social_media',
  'email_management',
  'calendar_management',
  'trading',
] as const;
export type SpecificityCategory = (typeof SPECIFICITY_CATEGORIES)[number];

export const SPECIFICITY_LABELS: Readonly<Record<SpecificityCategory, string>> = {
  coding: 'Coding',
  web_browsing: 'Web Browsing',
  data_analysis: 'Data Analysis',
  image_generation: 'Image Generation',
  video_generation: 'Video Generation',
  social_media: 'Social Media',
  email_management: 'Email',
  calendar_management: 'Calendar',
  trading: 'Trading',
};

export const SPECIFICITY_DESCRIPTIONS: Readonly<Record<SpecificityCategory, string>> = {
  coding: 'Write, debug, and refactor code.',
  web_browsing: 'Navigate pages, search, and extract content.',
  data_analysis: 'Crunch numbers, run stats, build charts.',
  image_generation: 'Create and edit images, logos, visuals.',
  video_generation: 'Produce clips, animations, and edits.',
  social_media: 'Draft posts, plan content, track engagement.',
  email_management: 'Compose, reply, and manage your inbox.',
  calendar_management: 'Book meetings, check availability, reschedule.',
  trading: 'Analyze markets, place trades, track positions.',
};
