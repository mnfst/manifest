// Demo data for Blogging category components
// This file contains sample data used for component previews and documentation

import type { Post } from '../post-card'

// Single post for PostCard default
export const demoPost: Post = {
  title: 'Getting Started with Agentic UI Components',
  excerpt:
    'Learn how to build conversational interfaces with our comprehensive component library designed for AI-powered applications.',
  coverImage:
    '/demo/images/tech-react.jpg',
  author: {
    name: 'Sarah Chen',
    avatar: '/demo/avatars/sarah-150.jpg'
  },
  publishedAt: '2024-01-15',
  readTime: '5 min read',
  tags: ['Tutorial', 'Components'],
  category: 'Tutorial'
}

// 15 posts for PostList default
export const demoPosts: Post[] = [
  {
    title: 'Getting Started with Agentic UI Components',
    excerpt:
      'Learn how to build conversational interfaces with our comprehensive component library designed for AI-powered applications.',
    coverImage:
      '/demo/images/tech-react.jpg',
    author: {
      name: 'Sarah Chen',
      avatar: '/demo/avatars/sarah-150.jpg'
    },
    publishedAt: '2024-01-15',
    readTime: '5 min read',
    tags: ['Tutorial', 'Components', 'AI'],
    category: 'Tutorial'
  },
  {
    title: 'Designing for Conversational Interfaces',
    excerpt:
      'Best practices for creating intuitive UI components that work within chat environments.',
    coverImage:
      '/demo/images/tech-ux.jpg',
    author: {
      name: 'Alex Rivera',
      avatar: '/demo/avatars/alex-150.jpg'
    },
    publishedAt: '2024-01-12',
    readTime: '8 min read',
    tags: ['Design', 'UX'],
    category: 'Design'
  },
  {
    title: 'MCP Integration Patterns',
    excerpt:
      'How to leverage Model Context Protocol for seamless backend communication in your agentic applications.',
    coverImage:
      '/demo/images/tech-cloud.jpg',
    author: {
      name: 'Jordan Kim',
      avatar: '/demo/avatars/jordan-150.jpg'
    },
    publishedAt: '2024-01-10',
    readTime: '12 min read',
    tags: ['MCP', 'Backend', 'Integration'],
    category: 'Development'
  },
  {
    title: 'Building Payment Flows in Chat',
    excerpt:
      'A complete guide to implementing secure, user-friendly payment experiences within conversational interfaces.',
    coverImage:
      '/demo/images/tech-ecommerce.jpg',
    author: {
      name: 'Morgan Lee',
      avatar: '/demo/avatars/morgan-150.jpg'
    },
    publishedAt: '2024-01-08',
    readTime: '10 min read',
    tags: ['Payments', 'Security'],
    category: 'Tutorial'
  },
  {
    title: 'Real-time Collaboration in AI Apps',
    excerpt:
      'Implementing WebSocket connections and real-time updates for collaborative agentic experiences.',
    coverImage:
      '/demo/images/tech-team.jpg',
    author: {
      name: 'Casey Taylor',
      avatar: '/demo/avatars/casey-150.jpg'
    },
    publishedAt: '2024-01-06',
    readTime: '15 min read',
    tags: ['WebSocket', 'Real-time', 'Collaboration'],
    category: 'Development'
  },
  {
    title: 'Accessibility in Chat Interfaces',
    excerpt:
      'Making your conversational UI accessible to all users with screen readers and keyboard navigation.',
    coverImage:
      '/demo/images/tech-women.jpg',
    author: {
      name: 'Jamie Park',
      avatar: '/demo/avatars/jamie-150.jpg'
    },
    publishedAt: '2024-01-04',
    readTime: '9 min read',
    tags: ['Accessibility', 'A11y', 'UX'],
    category: 'Design'
  },
  {
    title: 'State Management for Complex Workflows',
    excerpt:
      'Managing complex multi-step workflows in agentic applications using modern state patterns.',
    coverImage:
      '/demo/images/tech-dashboard.jpg',
    author: {
      name: 'Drew Martinez',
      avatar: '/demo/avatars/drew-150.jpg'
    },
    publishedAt: '2024-01-02',
    readTime: '11 min read',
    tags: ['State', 'Workflow', 'Architecture'],
    category: 'Development'
  },
  {
    title: 'Testing Conversational Components',
    excerpt:
      'Strategies for unit testing and integration testing of chat-based UI components.',
    coverImage:
      '/demo/images/tech-remote.jpg',
    author: {
      name: 'Riley Johnson',
      avatar: '/demo/avatars/riley-150.jpg'
    },
    publishedAt: '2023-12-30',
    readTime: '8 min read',
    tags: ['Testing', 'Quality', 'CI/CD'],
    category: 'Development'
  },
  {
    title: 'Theming and Dark Mode Support',
    excerpt:
      'Implementing flexible theming systems with dark mode for agentic UI components.',
    coverImage:
      '/demo/images/tech-code.jpg',
    author: {
      name: 'Avery Williams',
      avatar: '/demo/avatars/avery-150.jpg'
    },
    publishedAt: '2023-12-28',
    readTime: '7 min read',
    tags: ['Theming', 'Dark Mode', 'CSS'],
    category: 'Design'
  },
  {
    title: 'Performance Optimization Techniques',
    excerpt:
      'Optimizing render performance and reducing bundle size in chat applications.',
    coverImage:
      '/demo/images/tech-seo.jpg',
    author: {
      name: 'Quinn Anderson',
      avatar: '/demo/avatars/quinn-150.jpg'
    },
    publishedAt: '2023-12-25',
    readTime: '13 min read',
    tags: ['Performance', 'Optimization', 'React'],
    category: 'Development'
  },
  {
    title: 'Error Handling and Recovery',
    excerpt:
      'Graceful error handling patterns and user-friendly recovery flows in conversational UIs.',
    coverImage:
      '/demo/images/tech-debug.jpg',
    author: {
      name: 'Sage Thompson',
      avatar: '/demo/avatars/sage-150.jpg'
    },
    publishedAt: '2023-12-22',
    readTime: '10 min read',
    tags: ['Error Handling', 'UX', 'Resilience'],
    category: 'Development'
  },
  {
    title: 'Internationalization Best Practices',
    excerpt:
      'Making your agentic UI components work across languages and locales.',
    coverImage:
      '/demo/images/tech-marketing.jpg',
    author: {
      name: 'Blake Garcia',
      avatar: '/demo/avatars/blake-150.jpg'
    },
    publishedAt: '2023-12-20',
    readTime: '9 min read',
    tags: ['i18n', 'Localization', 'Global'],
    category: 'Design'
  },
  {
    title: 'Mobile-First Chat Design',
    excerpt:
      'Designing conversational interfaces that work beautifully on mobile devices.',
    coverImage:
      '/demo/images/tech-mobile.jpg',
    author: {
      name: 'Charlie Brown',
      avatar: '/demo/avatars/charlie-150.jpg'
    },
    publishedAt: '2023-12-18',
    readTime: '8 min read',
    tags: ['Mobile', 'Responsive', 'Design'],
    category: 'Design'
  },
  {
    title: 'Analytics and User Insights',
    excerpt:
      'Tracking user interactions and deriving insights from conversational UI usage.',
    coverImage:
      '/demo/images/tech-dashboard.jpg',
    author: {
      name: 'Sydney Chen',
      avatar: '/demo/avatars/sydney-150.jpg'
    },
    publishedAt: '2023-12-15',
    readTime: '11 min read',
    tags: ['Analytics', 'Insights', 'Data'],
    category: 'Tutorial'
  },
  {
    title: 'Building Reusable Component Libraries',
    excerpt:
      'Creating a scalable component library for agentic UIs that teams can share.',
    coverImage:
      '/demo/images/tech-design.jpg',
    author: {
      name: 'Taylor Swift',
      avatar: '/demo/avatars/taylor-150.jpg'
    },
    publishedAt: '2023-12-12',
    readTime: '14 min read',
    tags: ['Components', 'Library', 'Scalability'],
    category: 'Development'
  }
]
