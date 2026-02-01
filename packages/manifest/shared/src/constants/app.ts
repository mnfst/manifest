import type { LayoutTemplate, LayoutTemplateConfig } from '../types/app.js';

/**
 * Layout registry with Manifest UI block information
 */
export const LAYOUT_REGISTRY: Record<LayoutTemplate, LayoutTemplateConfig> = {
  'stat-card': {
    manifestBlock: '@manifest/stats',
    installCommand: 'npx shadcn@latest add @manifest/stats',
    useCase: 'KPIs, dashboard stats, metrics overview',
    actions: [], // Read-only, no actions
  },
  'post-list': {
    manifestBlock: '@manifest/post-list',
    installCommand: 'npx shadcn@latest add @manifest/post-list',
    useCase: 'Blog posts, article lists, content feeds',
    actions: [
      {
        name: 'onReadMore',
        label: 'Read More',
        description: 'Triggered when user clicks Read More on a post',
      },
    ],
    sampleData: {
      posts: [
        {
          id: '1',
          title: 'Sample Post',
          excerpt: 'This is a sample post excerpt',
          author: { name: 'Author Name' },
          publishedAt: '2026-01-08',
        },
      ],
    },
  },
  'blank-component': {
    manifestBlock: '@manifest/blank',
    installCommand: '',
    useCase: 'Custom UI components with 4-argument pattern (data, appearance, control, actions)',
    actions: [],
  },
};
