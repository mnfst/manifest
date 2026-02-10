// Demo data for Blogging category components
// This file contains sample data used for component previews and documentation

import type { Post } from '../types';

// Single post for PostCard default
export const demoPost: Post = {
  title: 'Getting Started with Agentic UI Components',
  excerpt:
    'Learn how to build conversational interfaces with our comprehensive component library designed for AI-powered applications.',
  coverImage: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800',
  author: {
    name: 'Sarah Chen',
    avatar: 'https://i.pravatar.cc/150?u=sarah',
  },
  publishedAt: '2024-01-15',
  readTime: '5 min read',
  tags: ['Tutorial', 'Components'],
  category: 'Tutorial',
};

// Demo content for PostDetail (HTML content for full article view)
export const demoPostContent = `
  <p>Building modern AI-powered applications requires a new approach to UI design. Traditional web components don't always translate well to conversational interfaces, where context and flow are paramount.</p>

  <p>Our Agentic UI component library provides a collection of purpose-built components that work seamlessly within chat interfaces. From payment flows to product displays, each component is designed with the unique constraints of conversational UIs in mind.</p>

  <h2>Key Features</h2>
  <p>Each component supports three display modes: inline (within the chat flow), fullscreen (for complex interactions), and picture-in-picture (persistent visibility). This flexibility allows you to create rich, interactive experiences without breaking the conversational flow.</p>

  <p>Components are designed mobile-first and touch-friendly, ensuring a great experience across all devices. They automatically adapt to light and dark themes, and integrate seamlessly with MCP tools for backend communication.</p>
`;

// Related posts for PostDetail
export const demoRelatedPosts: Post[] = [
  {
    title: 'Designing for Conversational Interfaces',
    excerpt:
      'Best practices for creating intuitive UI components that work within chat environments.',
    coverImage: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800',
    author: { name: 'Alex Rivera', avatar: 'https://i.pravatar.cc/150?u=alex' },
    publishedAt: '2024-01-12',
    readTime: '8 min read',
    tags: ['Design', 'UX'],
    category: 'Design',
    url: 'https://example.com/posts/designing-conversational-interfaces',
  },
  {
    title: 'MCP Integration Patterns',
    excerpt: 'How to leverage Model Context Protocol for seamless backend communication.',
    coverImage: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
    author: { name: 'Jordan Kim', avatar: 'https://i.pravatar.cc/150?u=jordan' },
    publishedAt: '2024-01-10',
    readTime: '12 min read',
    tags: ['MCP', 'Backend'],
    category: 'Development',
    url: 'https://example.com/posts/mcp-integration-patterns',
  },
];

// Full PostDetail demo data (combines post, content, and relatedPosts)
export const demoPostDetailData = {
  post: {
    ...demoPost,
    tags: ['Tutorial', 'Components', 'AI', 'React', 'TypeScript'],
  },
  content: demoPostContent,
  relatedPosts: demoRelatedPosts,
};

// 15 posts for PostList default
export const demoPosts: Post[] = [
  {
    title: 'Getting Started with Agentic UI Components',
    excerpt:
      'Learn how to build conversational interfaces with our comprehensive component library designed for AI-powered applications.',
    coverImage: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800',
    author: {
      name: 'Sarah Chen',
      avatar: 'https://i.pravatar.cc/150?u=sarah',
    },
    publishedAt: '2024-01-15',
    readTime: '5 min read',
    tags: ['Tutorial', 'Components', 'AI'],
    category: 'Tutorial',
  },
  {
    title: 'Designing for Conversational Interfaces with Manifest UI',
    excerpt:
      'Best practices for creating intuitive UI components that work within chat environments.',
    coverImage: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800',
    author: {
      name: 'Alex Rivera',
      avatar: 'https://i.pravatar.cc/150?u=alex',
    },
    publishedAt: '2024-01-12',
    readTime: '8 min read',
    tags: ['Design', 'UX'],
    category: 'Design',
  },
  {
    title: 'MCP Integration Patterns',
    excerpt:
      'How to leverage Model Context Protocol for seamless backend communication in your agentic applications.',
    coverImage: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
    author: {
      name: 'Jordan Kim',
      avatar: 'https://i.pravatar.cc/150?u=jordan',
    },
    publishedAt: '2024-01-10',
    readTime: '12 min read',
    tags: ['MCP', 'Backend', 'Integration'],
    category: 'Development',
  },
  {
    title: 'Building Payment Flows in Chat',
    excerpt:
      'A complete guide to implementing secure, user-friendly payment experiences within conversational interfaces.',
    coverImage: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800',
    author: {
      name: 'Morgan Lee',
      avatar: 'https://i.pravatar.cc/150?u=morgan',
    },
    publishedAt: '2024-01-08',
    readTime: '10 min read',
    tags: ['Payments', 'Security'],
    category: 'Tutorial',
  },
  {
    title: 'Real-time Collaboration in AI Apps',
    excerpt:
      'Implementing WebSocket connections and real-time updates for collaborative agentic experiences.',
    coverImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    author: {
      name: 'Casey Taylor',
      avatar: 'https://i.pravatar.cc/150?u=casey',
    },
    publishedAt: '2024-01-06',
    readTime: '15 min read',
    tags: ['WebSocket', 'Real-time', 'Collaboration'],
    category: 'Development',
  },
  {
    title: 'Accessibility in Chat Interfaces',
    excerpt:
      'Making your conversational UI accessible to all users with screen readers and keyboard navigation.',
    coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
    author: {
      name: 'Jamie Park',
      avatar: 'https://i.pravatar.cc/150?u=jamie',
    },
    publishedAt: '2024-01-04',
    readTime: '9 min read',
    tags: ['Accessibility', 'A11y', 'UX'],
    category: 'Design',
  },
  {
    title: 'State Management for Complex Workflows',
    excerpt:
      'Managing complex multi-step workflows in agentic applications using modern state patterns.',
    coverImage: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800',
    author: {
      name: 'Drew Martinez',
      avatar: 'https://i.pravatar.cc/150?u=drew',
    },
    publishedAt: '2024-01-02',
    readTime: '11 min read',
    tags: ['State', 'Workflow', 'Architecture'],
    category: 'Development',
  },
  {
    title: 'Testing Conversational Components',
    excerpt: 'Strategies for unit testing and integration testing of chat-based UI components.',
    coverImage: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800',
    author: {
      name: 'Riley Johnson',
      avatar: 'https://i.pravatar.cc/150?u=riley',
    },
    publishedAt: '2023-12-30',
    readTime: '8 min read',
    tags: ['Testing', 'Quality', 'CI/CD'],
    category: 'Development',
  },
  {
    title: 'Theming and Dark Mode Support',
    excerpt: 'Implementing flexible theming systems with dark mode for agentic UI components.',
    coverImage: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=800',
    author: {
      name: 'Avery Williams',
      avatar: 'https://i.pravatar.cc/150?u=avery',
    },
    publishedAt: '2023-12-28',
    readTime: '7 min read',
    tags: ['Theming', 'Dark Mode', 'CSS'],
    category: 'Design',
  },
  {
    title: 'Performance Optimization Techniques',
    excerpt: 'Optimizing render performance and reducing bundle size in chat applications.',
    coverImage: 'https://images.unsplash.com/photo-1518173946687-a2e8a36af77a?w=800',
    author: {
      name: 'Quinn Anderson',
      avatar: 'https://i.pravatar.cc/150?u=quinn',
    },
    publishedAt: '2023-12-25',
    readTime: '13 min read',
    tags: ['Performance', 'Optimization', 'React'],
    category: 'Development',
  },
  {
    title: 'Error Handling and Recovery',
    excerpt:
      'Graceful error handling patterns and user-friendly recovery flows in conversational UIs.',
    coverImage: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800',
    author: {
      name: 'Sage Thompson',
      avatar: 'https://i.pravatar.cc/150?u=sage',
    },
    publishedAt: '2023-12-22',
    readTime: '10 min read',
    tags: ['Error Handling', 'UX', 'Resilience'],
    category: 'Development',
  },
  {
    title: 'Internationalization Best Practices',
    excerpt: 'Making your agentic UI components work across languages and locales.',
    coverImage: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=800',
    author: {
      name: 'Blake Garcia',
      avatar: 'https://i.pravatar.cc/150?u=blake',
    },
    publishedAt: '2023-12-20',
    readTime: '9 min read',
    tags: ['i18n', 'Localization', 'Global'],
    category: 'Design',
  },
  {
    title: 'Mobile-First Chat Design',
    excerpt: 'Designing conversational interfaces that work beautifully on mobile devices.',
    coverImage: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800',
    author: {
      name: 'Charlie Brown',
      avatar: 'https://i.pravatar.cc/150?u=charlie',
    },
    publishedAt: '2023-12-18',
    readTime: '8 min read',
    tags: ['Mobile', 'Responsive', 'Design'],
    category: 'Design',
  },
  {
    title: 'Analytics and User Insights',
    excerpt: 'Tracking user interactions and deriving insights from conversational UI usage.',
    coverImage: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800',
    author: {
      name: 'Sydney Chen',
      avatar: 'https://i.pravatar.cc/150?u=sydney',
    },
    publishedAt: '2023-12-15',
    readTime: '11 min read',
    tags: ['Analytics', 'Insights', 'Data'],
    category: 'Tutorial',
  },
  {
    title: 'Building Reusable Component Libraries',
    excerpt: 'Creating a scalable component library for agentic UIs that teams can share.',
    coverImage: 'https://images.unsplash.com/photo-1465056836900-8f1e940f2114?w=800',
    author: {
      name: 'Taylor Swift',
      avatar: 'https://i.pravatar.cc/150?u=taylor',
    },
    publishedAt: '2023-12-12',
    readTime: '14 min read',
    tags: ['Components', 'Library', 'Scalability'],
    category: 'Development',
  },
];
