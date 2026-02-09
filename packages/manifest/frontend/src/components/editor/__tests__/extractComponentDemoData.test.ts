import { describe, it, expect } from 'vitest';
import { extractComponentDemoData } from '../extractComponentDemoData';

// ─── Helpers ────────────────────────────────────────────────────

/** Build a minimal files array with a component and demo file. */
function makeFiles(
  componentCode: string,
  demoCode: string,
  componentPath = 'registry/social/linkedin-post.tsx',
  demoPath = 'registry/social/demo/social.ts',
): Array<{ path: string; content: string }> {
  return [
    { path: componentPath, content: componentCode },
    { path: demoPath, content: demoCode },
  ];
}

// ─── Demo file fixtures ─────────────────────────────────────────

const SIMPLE_DEMO = `
export const demoLinkedInPost = {
  author: 'Manifest',
  headline: 'Open Source',
  content: 'Hello world',
};

export const demoXPost = {
  author: 'X User',
  username: 'xuser',
};
`;

const OBJECT_WRAP_DEMO = `
export const demoPost = {
  title: 'Getting Started',
  excerpt: 'Learn how to build...',
};

export const demoPosts = [
  { title: 'Post 1' },
  { title: 'Post 2' },
];
`;

const ARRAY_DEMO = `
export const demoTextMessages = [
  { content: 'Hello', avatarFallback: 'A' },
  { content: 'World', avatarFallback: 'B' },
];
`;

const MULTI_KEY_DEMO = `
export const demoMapLocations = [
  { lat: 40.7, lng: -74.0, title: 'NYC' },
];
export const demoMapCenter = { lat: 40.7, lng: -74.0 };
export const demoMapZoom = 12;
`;

// ─── Tests ──────────────────────────────────────────────────────

describe('extractComponentDemoData', () => {
  describe('simple variable fallback (e.g., LinkedInPost)', () => {
    it('returns the correct export value for `data ?? demoLinkedInPost`', () => {
      const component = `
        import { demoLinkedInPost } from './demo/social';
        export function LinkedInPost({ data }: Props) {
          const resolved = data ?? demoLinkedInPost;
          return null;
        }
      `;
      const result = extractComponentDemoData(makeFiles(component, SIMPLE_DEMO));

      expect(result).toBeDefined();
      expect(result).toHaveProperty('author', 'Manifest');
      expect(result).toHaveProperty('headline', 'Open Source');
      expect(result).toHaveProperty('content', 'Hello world');
    });

    it('returns only the referenced export, not all exports', () => {
      const component = `
        import { demoLinkedInPost } from './demo/social';
        export function LinkedInPost({ data }: Props) {
          const resolved = data ?? demoLinkedInPost;
          return null;
        }
      `;
      const result = extractComponentDemoData(makeFiles(component, SIMPLE_DEMO));

      // Should NOT contain fields from demoXPost
      expect(result).not.toHaveProperty('username');
    });
  });

  describe('object literal fallback (e.g., PostCard)', () => {
    it('returns wrapped object for `data ?? { post: demoPost }`', () => {
      const component = `
        import { demoPost } from './demo/blogging';
        export function PostCard({ data }: Props) {
          const resolved = data ?? { post: demoPost }
          return null;
        }
      `;
      const files = makeFiles(
        component,
        OBJECT_WRAP_DEMO,
        'registry/blogging/post-card.tsx',
        'registry/blogging/demo/blogging.ts',
      );
      const result = extractComponentDemoData(files);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('post');
      expect((result as { post: { title: string } }).post.title).toBe('Getting Started');
    });

    it('returns wrapped array for `data ?? { posts: demoPosts }`', () => {
      const component = `
        import { demoPosts } from './demo/blogging';
        export function PostList({ data }: Props) {
          const resolved = data ?? { posts: demoPosts }
          return null;
        }
      `;
      const files = makeFiles(
        component,
        OBJECT_WRAP_DEMO,
        'registry/blogging/post-list.tsx',
        'registry/blogging/demo/blogging.ts',
      );
      const result = extractComponentDemoData(files);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('posts');
      expect(Array.isArray((result as { posts: unknown[] }).posts)).toBe(true);
      expect((result as { posts: Array<{ title: string }> }).posts).toHaveLength(2);
    });
  });

  describe('array access fallback (e.g., MessageBubble)', () => {
    it('returns the first element for `data ?? demoTextMessages[0]`', () => {
      const component = `
        import { demoTextMessages } from './demo/messaging';
        export function MessageBubble({ data }: Props) {
          const resolved = data ?? demoTextMessages[0]
          return null;
        }
      `;
      const files = makeFiles(
        component,
        ARRAY_DEMO,
        'registry/messaging/message-bubble.tsx',
        'registry/messaging/demo/messaging.ts',
      );
      const result = extractComponentDemoData(files);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('content', 'Hello');
      expect(result).toHaveProperty('avatarFallback', 'A');
    });
  });

  describe('multi-key object fallback (e.g., MapCarousel)', () => {
    it('returns object with multiple demo exports', () => {
      const component = `
        import { demoMapLocations, demoMapCenter, demoMapZoom } from './demo/map';
        export function MapCarousel({ data }: Props) {
          const resolvedData = data ?? { locations: demoMapLocations, center: demoMapCenter, zoom: demoMapZoom }
          return null;
        }
      `;
      const files = makeFiles(
        component,
        MULTI_KEY_DEMO,
        'registry/map/map-carousel.tsx',
        'registry/map/demo/map.ts',
      );
      const result = extractComponentDemoData(files);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('locations');
      expect(result).toHaveProperty('center');
      // zoom is a number primitive — filtered out by typeof check
      expect(Array.isArray((result as { locations: unknown[] }).locations)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('returns undefined when no files provided', () => {
      expect(extractComponentDemoData([])).toBeUndefined();
    });

    it('returns undefined when no .tsx component file exists', () => {
      const files = [
        { path: 'registry/social/demo/social.ts', content: SIMPLE_DEMO },
      ];
      expect(extractComponentDemoData(files)).toBeUndefined();
    });

    it('returns undefined when no demo file exists', () => {
      const component = `
        export function MyComponent({ data }: Props) {
          const resolved = data ?? {};
          return null;
        }
      `;
      const files = [
        { path: 'registry/misc/my-component.tsx', content: component },
      ];
      expect(extractComponentDemoData(files)).toBeUndefined();
    });

    it('returns undefined when component has no data ?? pattern', () => {
      const component = `
        export function MyComponent({ title }: Props) {
          return null;
        }
      `;
      const files = makeFiles(component, SIMPLE_DEMO);
      expect(extractComponentDemoData(files)).toBeUndefined();
    });

    it('handles demo files with TypeScript type imports', () => {
      const demoWithTypes = `
        import type { Post } from '../types';
        export const demoPost: Post = {
          title: 'Typed Post',
          excerpt: 'With type annotation',
        };
      `;
      const component = `
        import { demoPost } from './demo/blogging';
        export function PostCard({ data }: Props) {
          const resolved = data ?? { post: demoPost }
          return null;
        }
      `;
      const files = makeFiles(
        component,
        demoWithTypes,
        'registry/blogging/post-card.tsx',
        'registry/blogging/demo/blogging.ts',
      );
      const result = extractComponentDemoData(files);

      expect(result).toBeDefined();
      expect((result as { post: { title: string } }).post.title).toBe('Typed Post');
    });

    it('handles demo files with "use client" directive', () => {
      const demoWithDirective = `
        'use client';
        export const demoHero = { title: 'Hello' };
      `;
      const component = `
        import { demoHero } from './demo/misc';
        export function Hero({ data }: Props) {
          const resolved = data ?? demoHero;
          return null;
        }
      `;
      const files = makeFiles(
        component,
        demoWithDirective,
        'registry/misc/hero.tsx',
        'registry/misc/demo/misc.ts',
      );
      const result = extractComponentDemoData(files);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('title', 'Hello');
    });

    it('handles demo files with TypeScript `as` type assertions', () => {
      const demoWithAssertion = `
        export const demoLinkedInPost = {
          author: 'Test',
          reactions: ['like', 'love'] as ('like' | 'love')[],
        };
      `;
      const component = `
        import { demoLinkedInPost } from './demo/social';
        export function LinkedInPost({ data }: Props) {
          const resolved = data ?? demoLinkedInPost;
          return null;
        }
      `;
      const files = makeFiles(component, demoWithAssertion);
      const result = extractComponentDemoData(files);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('author', 'Test');
      expect(result).toHaveProperty('reactions');
      expect(Array.isArray((result as { reactions: string[] }).reactions)).toBe(true);
    });
  });
});
