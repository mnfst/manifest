'use client';

import { blockCategories } from '@/lib/blocks-categories';
import { cn } from '@/lib/utils';
import { useExternalDepCount } from '@/components/blocks/dependency-viewer';
import { ChevronRight, Github, Package, Zap } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

// Form components
import { ContactForm } from '@/registry/form/contact-form';
import { DateTimePicker } from '@/registry/form/date-time-picker';
import { IssueReportForm } from '@/registry/form/issue-report-form';

// Blogging components
import { PostCardDemo } from '@/components/blocks/post-card-demo';
import { PostDetailDemo } from '@/components/blocks/post-detail-demo';
import { PostListDemo } from '@/components/blocks/post-list-demo';
import { demoPost, demoPosts, demoPostDetailData } from '@/registry/blogging/demo/blogging';
import { PostDetail } from '@/registry/blogging/post-detail';
import { PostList } from '@/registry/blogging/post-list';

// Events components
import { EventCard } from '@/registry/events/event-card';
import { EventConfirmation } from '@/registry/events/event-confirmation';
import { EventDetail } from '@/registry/events/event-detail';
import { EventList } from '@/registry/events/event-list';
import { TicketTierSelect } from '@/registry/events/ticket-tier-select';
import {
  demoEvent,
  demoEvents,
  demoEventDetails,
  demoTicketTiers,
  demoEventConfirmation,
} from '@/registry/events/demo/events';

// List components
import { TableDemo } from '@/components/blocks/table-demo';
import { ProductList } from '@/registry/list/product-list';
import { Table } from '@/registry/list/table';
import {
  demoProducts,
  demoApiUsageColumns,
  demoApiUsageRows,
  demoModelsColumns,
  demoModelsRows,
  demoExportColumns,
  demoExportRows,
} from '@/registry/list/demo/list';

// Payment components
import { AmountInput } from '@/registry/payment/amount-input';
import { OrderConfirm } from '@/registry/payment/order-confirm';
import { PaymentConfirmed } from '@/registry/payment/payment-confirmed';
import {
  demoOrderConfirm,
  demoPaymentConfirmed,
} from '@/registry/payment/demo/payment';

// Messaging components
import { ChatConversation } from '@/registry/messaging/chat-conversation';
import {
  ImageMessageBubble,
  MessageBubble,
  MessageWithReactions,
  VoiceMessageBubble,
} from '@/registry/messaging/message-bubble';

// Selection components
import { OptionList } from '@/registry/selection/option-list';
import { QuickReply } from '@/registry/selection/quick-reply';
import { TagSelect } from '@/registry/selection/tag-select';
import {
  demoOptions,
  demoQuickReplies,
  demoTags,
} from '@/registry/selection/demo/selection';

// Social components
import { InstagramPost } from '@/registry/social/instagram-post';
import { LinkedInPost } from '@/registry/social/linkedin-post';
import { XPost } from '@/registry/social/x-post';
import { YouTubePost } from '@/registry/social/youtube-post';
import {
  demoXPost,
  demoInstagramPost,
  demoYouTubePost,
} from '@/registry/social/demo/social';

// Map components
import { MapCarousel } from '@/registry/map/map-carousel';
import { demoMapLocations, demoMapCenter, demoMapZoom } from '@/registry/map/demo/map';

// Status components
import { ProgressSteps } from '@/registry/status/progress-steps';
import { StatusBadge } from '@/registry/status/status-badge';
import { demoProgressSteps } from '@/registry/status/demo/status';

// Miscellaneous components
import { Hero } from '@/registry/miscellaneous/hero';
import { StatCard } from '@/registry/miscellaneous/stat-card';
import {
  demoStats,
  demoHeroDefault,
  demoHeroTwoLogos,
  demoHeroWithTechLogos,
  demoHeroMinimal,
} from '@/registry/miscellaneous/demo/miscellaneous';
import { demoMessages } from '@/registry/messaging/demo/messaging';

// UI components
import { VariantSection, VariantSectionHandle } from '@/components/blocks/variant-section';

// SEO components
import { Breadcrumb } from '@/components/seo/breadcrumb';

// Types for the new structure
interface BlockVariant {
  id: string;
  name: string;
  component: React.ReactNode;
  pipComponent?: React.ReactNode;
  fullscreenComponent?: React.ReactNode;
  usageCode?: string;
}

type LayoutMode = 'inline' | 'fullscreen' | 'pip';

interface BlockGroup {
  id: string;
  name: string;
  description: string;
  registryName: string;
  layouts: LayoutMode[];
  actionCount: number;
  variants: BlockVariant[];
}

interface Category {
  id: string;
  name: string;
  blocks: BlockGroup[];
}

// Import categories data - this is the same data structure from the main page
// In a production app, this would be in a shared file
const categories: Category[] = [
  {
    id: 'blogging',
    name: 'Blogging',
    blocks: [
      {
        id: 'post-card',
        name: 'Post Card',
        description:
          'Display blog posts with various layouts and styles. Click "Read" to see fullscreen mode.',
        registryName: 'post-card',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <PostCardDemo data={{ post: demoPost }} />,
            fullscreenComponent: <PostDetail data={demoPostDetailData} appearance={{ displayMode: 'fullscreen' }} />,
            usageCode: `<PostCard
  data={{
    post: {
      id: "1",
      title: "Getting Started with Agentic UI Components",
      excerpt: "Learn how to build conversational interfaces with our comprehensive component library designed for AI-powered applications.",
      coverImage: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800",
      author: {
        name: "Sarah Chen",
        avatar: "https://i.pravatar.cc/150?u=sarah"
      },
      publishedAt: "2024-01-15",
      readTime: "5 min read",
      tags: ["Tutorial", "Components"],
      category: "Tutorial"
    },
    content: \`
      <p>Building modern AI-powered applications requires a new approach to UI design. Traditional web components don't always translate well to conversational interfaces, where context and flow are paramount.</p>

      <p>Our Agentic UI component library provides a collection of purpose-built components that work seamlessly within chat interfaces. From payment flows to product displays, each component is designed with the unique constraints of conversational UIs in mind.</p>

      <h2>Key Features</h2>
      <p>Each component supports three display modes: inline (within the chat flow), fullscreen (for complex interactions), and picture-in-picture (persistent visibility). This flexibility allows you to create rich, interactive experiences without breaking the conversational flow.</p>

      <p>Components are designed mobile-first and touch-friendly, ensuring a great experience across all devices. They automatically adapt to light and dark themes, and integrate seamlessly with MCP tools for backend communication.</p>

      <h2>Getting Started</h2>
      <p>To begin using Agentic UI components, install the package via npm or yarn. Each component is fully typed with TypeScript and includes comprehensive documentation with examples.</p>

      <p>The components follow a consistent props pattern with data, actions, appearance, and control categories, making them predictable and easy to integrate into your existing codebase.</p>
    \`
  }}
  appearance={{
    variant: "default",
    showImage: true,
    showAuthor: true,
    showCategory: true
  }}
  actions={{
    onReadMore: (post) => console.log("Read more:", post.title)
  }}
/>`,
          },
          {
            id: 'no-image',
            name: 'Without Image',
            component: <PostCardDemo data={{ post: demoPost }} appearance={{ showImage: false }} />,
            fullscreenComponent: <PostDetail data={demoPostDetailData} appearance={{ displayMode: 'fullscreen' }} />,
            usageCode: `<PostCard
  data={{
    post: {
      id: "2",
      title: "Designing for Conversational Interfaces",
      excerpt: "Best practices for creating intuitive UI components that work within chat environments.",
      author: { name: "Alex Rivera", avatar: "https://i.pravatar.cc/150?u=alex" },
      publishedAt: "2024-01-12",
      readTime: "8 min read",
      tags: ["Design", "UX"],
      category: "Design"
    },
    content: \`
      <p>Conversational interfaces present unique design challenges that traditional web design principles don't fully address. Users interact with chat-based UIs differently, expecting quick responses and contextual awareness.</p>

      <h2>Understanding the Context</h2>
      <p>In a conversational UI, every component exists within a flow. Unlike traditional web pages where users can freely navigate, chat interfaces guide users through a linear experience. This means your components must be self-contained yet contextually aware.</p>

      <p>The key is to provide just enough information without overwhelming the user. Use progressive disclosure to reveal details as needed, and always provide clear actions for the next step.</p>

      <h2>Visual Hierarchy in Chat</h2>
      <p>With limited screen real estate, visual hierarchy becomes crucial. Use typography, spacing, and color to guide the user's attention to the most important elements. Avoid cluttered layouts that compete for attention.</p>

      <p>Remember that users are often multitasking when using chat interfaces. Your components should be scannable and easy to understand at a glance.</p>
    \`
  }}
  appearance={{
    showImage: false,
    showAuthor: true,
    showCategory: true
  }}
  actions={{
    onReadMore: (post) => console.log("Read more:", post.title)
  }}
/>`,
          },
          {
            id: 'compact',
            name: 'Compact',
            component: <PostCardDemo data={{ post: demoPost }} appearance={{ variant: 'compact' }} />,
            fullscreenComponent: <PostDetail data={demoPostDetailData} appearance={{ displayMode: 'fullscreen' }} />,
            usageCode: `<PostCard
  data={{
    post: {
      id: "3",
      title: "MCP Integration Patterns",
      excerpt: "How to leverage Model Context Protocol for seamless backend communication.",
      author: { name: "Jordan Kim", avatar: "https://i.pravatar.cc/150?u=jordan" },
      publishedAt: "2024-01-10",
      readTime: "12 min read",
      tags: ["MCP", "Backend"],
      category: "Development"
    },
    content: \`
      <p>The Model Context Protocol (MCP) provides a standardized way for AI applications to communicate with backend services. Understanding the common integration patterns will help you build more robust and maintainable applications.</p>

      <h2>Request-Response Pattern</h2>
      <p>The most common pattern is simple request-response. Your frontend sends a request to the MCP server, which processes it and returns a response. This works well for simple queries and CRUD operations.</p>

      <p>For more complex scenarios, consider using streaming responses. MCP supports server-sent events, allowing you to receive partial results as they become available.</p>

      <h2>Tool Registration</h2>
      <p>MCP tools are the building blocks of your backend integration. Each tool defines a specific capability that the AI can invoke. Design your tools to be atomic and composable for maximum flexibility.</p>

      <p>When registering tools, provide clear descriptions and parameter schemas. This helps the AI understand when and how to use each tool effectively.</p>

      <h2>Error Handling</h2>
      <p>Robust error handling is essential for production applications. MCP provides structured error responses that you should propagate to your UI components gracefully.</p>
    \`
  }}
  appearance={{
    variant: "compact",
    showAuthor: true,
    showCategory: true
  }}
  actions={{
    onReadMore: (post) => console.log("Read more:", post.title)
  }}
/>`,
          },
          {
            id: 'horizontal',
            name: 'Horizontal',
            component: <PostCardDemo data={{ post: demoPost }} appearance={{ variant: 'horizontal' }} />,
            fullscreenComponent: <PostDetail data={demoPostDetailData} appearance={{ displayMode: 'fullscreen' }} />,
            usageCode: `<PostCard
  data={{
    post: {
      id: "4",
      title: "Building Payment Flows in Chat",
      excerpt: "A complete guide to implementing secure, user-friendly payment experiences within conversational interfaces.",
      coverImage: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800",
      author: { name: "Morgan Lee", avatar: "https://i.pravatar.cc/150?u=morgan" },
      publishedAt: "2024-01-08",
      readTime: "10 min read",
      tags: ["Payments", "Security"],
      category: "Tutorial"
    },
    content: \`
      <p>Integrating payment flows within conversational interfaces requires careful consideration of security, user experience, and regulatory compliance. This guide walks you through the essential patterns and best practices.</p>

      <h2>Security First</h2>
      <p>Never handle raw credit card data in your chat interface. Instead, use tokenization services like Stripe or PayPal that provide secure, PCI-compliant payment forms. These services handle the sensitive data and return a token you can safely use.</p>

      <p>Always use HTTPS and implement proper authentication. Consider adding additional verification steps for high-value transactions.</p>

      <h2>User Experience</h2>
      <p>Payment flows should be quick and intuitive. Show clear pricing information upfront, and provide progress indicators throughout the checkout process. Users should always know where they are and what's coming next.</p>

      <p>Offer multiple payment methods when possible. Some users prefer cards, others prefer digital wallets like Apple Pay or Google Pay. The more options you provide, the higher your conversion rates.</p>

      <h2>Confirmation and Receipts</h2>
      <p>Always provide clear confirmation after a successful payment. Include order details, expected delivery dates, and contact information for support. Consider sending a follow-up message or email with the receipt.</p>
    \`
  }}
  appearance={{
    variant: "horizontal",
    showImage: true,
    showAuthor: true,
    showCategory: true
  }}
  actions={{
    onReadMore: (post) => console.log("Read more:", post.title)
  }}
/>`,
          },
          {
            id: 'covered',
            name: 'Covered',
            component: <PostCardDemo data={{ post: demoPost }} appearance={{ variant: 'covered' }} />,
            fullscreenComponent: <PostDetail data={demoPostDetailData} appearance={{ displayMode: 'fullscreen' }} />,
            usageCode: `<PostCard
  data={{
    post: {
      id: "5",
      title: "The Future of AI-Powered Interfaces",
      excerpt: "Exploring how agentic UIs are transforming the way users interact with AI applications.",
      coverImage: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800",
      author: { name: "Taylor Swift", avatar: "https://i.pravatar.cc/150?u=taylor" },
      publishedAt: "2024-01-05",
      readTime: "7 min read",
      tags: ["AI", "Future"],
      category: "Insights"
    },
    content: \`
      <p>The rise of large language models has fundamentally changed how we think about user interfaces. Traditional GUIs gave way to conversational interfaces, and now we're seeing the emergence of agentic UIs - interfaces that can act autonomously on behalf of users.</p>

      <h2>From Passive to Active</h2>
      <p>Traditional UIs are passive - they wait for user input and respond accordingly. Agentic UIs, however, can anticipate user needs, suggest actions, and even take initiative when appropriate. This shift requires a new design paradigm.</p>

      <p>The key challenge is building trust. Users need to feel in control even when the AI is taking actions on their behalf. Clear communication about what the AI is doing and why is essential.</p>

      <h2>The Role of Context</h2>
      <p>Agentic UIs excel when they understand context. By maintaining awareness of the user's goals, history, and preferences, these interfaces can provide more relevant and timely assistance.</p>

      <p>The Model Context Protocol (MCP) provides the foundation for this contextual awareness, allowing AI systems to access and integrate information from various sources.</p>

      <h2>Looking Ahead</h2>
      <p>As AI capabilities continue to advance, we can expect agentic UIs to become even more sophisticated. The interfaces of tomorrow will feel less like tools and more like intelligent assistants that truly understand and help achieve our goals.</p>
    \`
  }}
  appearance={{
    variant: "covered",
    showAuthor: true,
    showCategory: true
  }}
  actions={{
    onReadMore: (post) => console.log("Read more:", post.title)
  }}
/>`,
          },
        ],
      },
      {
        id: 'post-list',
        name: 'Post List',
        description: 'Display multiple posts in various layouts',
        registryName: 'post-list',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 1,
        variants: [
          {
            id: 'list',
            name: 'List',
            component: <PostListDemo data={{ posts: demoPosts }} appearance={{ variant: 'list' }} />,
            fullscreenComponent: (
              <PostList
                data={{ posts: demoPosts }}
                appearance={{
                  variant: 'fullwidth',
                  columns: 3,
                }}
              />
            ),
            usageCode: `<PostList
  data={{
    posts: [
      {
        id: "1",
        title: "Getting Started with Agentic UI Components",
        excerpt: "Learn how to build conversational interfaces with our comprehensive component library designed for AI-powered applications.",
        coverImage: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800",
        author: { name: "Sarah Chen", avatar: "https://i.pravatar.cc/150?u=sarah" },
        publishedAt: "2024-01-15",
        readTime: "5 min read",
        tags: ["Tutorial", "Components", "AI"],
        category: "Tutorial"
      },
      {
        id: "2",
        title: "Designing for Conversational Interfaces",
        excerpt: "Best practices for creating intuitive UI components that work within chat environments.",
        coverImage: "https://images.unsplash.com/photo-1559028012-481c04fa702d?w=800",
        author: { name: "Alex Rivera", avatar: "https://i.pravatar.cc/150?u=alex" },
        publishedAt: "2024-01-12",
        readTime: "8 min read",
        tags: ["Design", "UX"],
        category: "Design"
      },
      {
        id: "3",
        title: "MCP Integration Patterns",
        excerpt: "How to leverage Model Context Protocol for seamless backend communication in your agentic applications.",
        coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800",
        author: { name: "Jordan Kim", avatar: "https://i.pravatar.cc/150?u=jordan" },
        publishedAt: "2024-01-10",
        readTime: "12 min read",
        tags: ["MCP", "Backend", "Integration"],
        category: "Development"
      },
      {
        id: "4",
        title: "Building Payment Flows in Chat",
        excerpt: "A complete guide to implementing secure, user-friendly payment experiences within conversational interfaces.",
        coverImage: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800",
        author: { name: "Morgan Lee", avatar: "https://i.pravatar.cc/150?u=morgan" },
        publishedAt: "2024-01-08",
        readTime: "10 min read",
        tags: ["Payments", "Security"],
        category: "Tutorial"
      },
      {
        id: "5",
        title: "Real-time Collaboration in AI Apps",
        excerpt: "Implementing WebSocket connections and real-time updates for collaborative agentic experiences.",
        coverImage: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800",
        author: { name: "Casey Taylor", avatar: "https://i.pravatar.cc/150?u=casey" },
        publishedAt: "2024-01-06",
        readTime: "15 min read",
        tags: ["WebSocket", "Real-time", "Collaboration"],
        category: "Development"
      },
      {
        id: "6",
        title: "Accessibility in Chat Interfaces",
        excerpt: "Making your conversational UI accessible to all users with screen readers and keyboard navigation.",
        coverImage: "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=800",
        author: { name: "Jamie Park", avatar: "https://i.pravatar.cc/150?u=jamie" },
        publishedAt: "2024-01-04",
        readTime: "9 min read",
        tags: ["Accessibility", "A11y", "UX"],
        category: "Design"
      },
      {
        id: "7",
        title: "State Management for Complex Workflows",
        excerpt: "Managing complex multi-step workflows in agentic applications using modern state patterns.",
        coverImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
        author: { name: "Drew Martinez", avatar: "https://i.pravatar.cc/150?u=drew" },
        publishedAt: "2024-01-02",
        readTime: "11 min read",
        tags: ["State", "Workflow", "Architecture"],
        category: "Development"
      },
      {
        id: "8",
        title: "Testing Conversational Components",
        excerpt: "Strategies for unit testing and integration testing of chat-based UI components.",
        coverImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800",
        author: { name: "Riley Johnson", avatar: "https://i.pravatar.cc/150?u=riley" },
        publishedAt: "2023-12-30",
        readTime: "8 min read",
        tags: ["Testing", "Quality", "CI/CD"],
        category: "Development"
      },
      {
        id: "9",
        title: "Theming and Dark Mode Support",
        excerpt: "Implementing flexible theming systems with dark mode for agentic UI components.",
        coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800",
        author: { name: "Avery Williams", avatar: "https://i.pravatar.cc/150?u=avery" },
        publishedAt: "2023-12-28",
        readTime: "7 min read",
        tags: ["Theming", "Dark Mode", "CSS"],
        category: "Design"
      },
      {
        id: "10",
        title: "Performance Optimization Techniques",
        excerpt: "Optimizing render performance and reducing bundle size in chat applications.",
        coverImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800",
        author: { name: "Quinn Anderson", avatar: "https://i.pravatar.cc/150?u=quinn" },
        publishedAt: "2023-12-25",
        readTime: "13 min read",
        tags: ["Performance", "Optimization", "React"],
        category: "Development"
      },
      {
        id: "11",
        title: "Error Handling and Recovery",
        excerpt: "Graceful error handling patterns and user-friendly recovery flows in conversational UIs.",
        coverImage: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800",
        author: { name: "Sage Thompson", avatar: "https://i.pravatar.cc/150?u=sage" },
        publishedAt: "2023-12-22",
        readTime: "10 min read",
        tags: ["Error Handling", "UX", "Resilience"],
        category: "Development"
      },
      {
        id: "12",
        title: "Internationalization Best Practices",
        excerpt: "Making your agentic UI components work across languages and locales.",
        coverImage: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800",
        author: { name: "Blake Garcia", avatar: "https://i.pravatar.cc/150?u=blake" },
        publishedAt: "2023-12-20",
        readTime: "9 min read",
        tags: ["i18n", "Localization", "Global"],
        category: "Design"
      },
      {
        id: "13",
        title: "Mobile-First Chat Design",
        excerpt: "Designing conversational interfaces that work beautifully on mobile devices.",
        coverImage: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800",
        author: { name: "Charlie Brown", avatar: "https://i.pravatar.cc/150?u=charlie" },
        publishedAt: "2023-12-18",
        readTime: "8 min read",
        tags: ["Mobile", "Responsive", "Design"],
        category: "Design"
      },
      {
        id: "14",
        title: "Analytics and User Insights",
        excerpt: "Tracking user interactions and deriving insights from conversational UI usage.",
        coverImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
        author: { name: "Sydney Chen", avatar: "https://i.pravatar.cc/150?u=sydney" },
        publishedAt: "2023-12-15",
        readTime: "11 min read",
        tags: ["Analytics", "Insights", "Data"],
        category: "Tutorial"
      },
      {
        id: "15",
        title: "Building Reusable Component Libraries",
        excerpt: "Creating a scalable component library for agentic UIs that teams can share.",
        coverImage: "https://images.unsplash.com/photo-1558655146-d09347e92766?w=800",
        author: { name: "Taylor Swift", avatar: "https://i.pravatar.cc/150?u=taylor" },
        publishedAt: "2023-12-12",
        readTime: "14 min read",
        tags: ["Components", "Library", "Scalability"],
        category: "Development"
      }
    ]
  }}
  appearance={{
    variant: "list",
    showAuthor: true,
    showCategory: true
  }}
  actions={{
    onReadMore: (post) => console.log("Read more:", post.title)
  }}
/>`,
          },
          {
            id: 'grid',
            name: 'Grid',
            component: <PostListDemo data={{ posts: demoPosts }} appearance={{ variant: 'grid' }} />,
            fullscreenComponent: (
              <PostList
                data={{ posts: demoPosts }}
                appearance={{
                  variant: 'fullwidth',
                  columns: 3,
                }}
              />
            ),
            usageCode: `<PostList
  data={{
    posts: [
      {
        id: "1",
        title: "Getting Started with Agentic UI Components",
        excerpt: "Learn how to build conversational interfaces with our comprehensive component library designed for AI-powered applications.",
        coverImage: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800",
        author: { name: "Sarah Chen", avatar: "https://i.pravatar.cc/150?u=sarah" },
        publishedAt: "2024-01-15",
        readTime: "5 min read",
        tags: ["Tutorial", "Components", "AI"],
        category: "Tutorial"
      },
      {
        id: "2",
        title: "Designing for Conversational Interfaces",
        excerpt: "Best practices for creating intuitive UI components that work within chat environments.",
        coverImage: "https://images.unsplash.com/photo-1559028012-481c04fa702d?w=800",
        author: { name: "Alex Rivera", avatar: "https://i.pravatar.cc/150?u=alex" },
        publishedAt: "2024-01-12",
        readTime: "8 min read",
        tags: ["Design", "UX"],
        category: "Design"
      },
      {
        id: "3",
        title: "MCP Integration Patterns",
        excerpt: "How to leverage Model Context Protocol for seamless backend communication in your agentic applications.",
        coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800",
        author: { name: "Jordan Kim", avatar: "https://i.pravatar.cc/150?u=jordan" },
        publishedAt: "2024-01-10",
        readTime: "12 min read",
        tags: ["MCP", "Backend", "Integration"],
        category: "Development"
      },
      {
        id: "4",
        title: "Building Payment Flows in Chat",
        excerpt: "A complete guide to implementing secure, user-friendly payment experiences within conversational interfaces.",
        coverImage: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800",
        author: { name: "Morgan Lee", avatar: "https://i.pravatar.cc/150?u=morgan" },
        publishedAt: "2024-01-08",
        readTime: "10 min read",
        tags: ["Payments", "Security"],
        category: "Tutorial"
      },
      {
        id: "5",
        title: "Real-time Collaboration in AI Apps",
        excerpt: "Implementing WebSocket connections and real-time updates for collaborative agentic experiences.",
        coverImage: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800",
        author: { name: "Casey Taylor", avatar: "https://i.pravatar.cc/150?u=casey" },
        publishedAt: "2024-01-06",
        readTime: "15 min read",
        tags: ["WebSocket", "Real-time", "Collaboration"],
        category: "Development"
      },
      {
        id: "6",
        title: "Accessibility in Chat Interfaces",
        excerpt: "Making your conversational UI accessible to all users with screen readers and keyboard navigation.",
        coverImage: "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=800",
        author: { name: "Jamie Park", avatar: "https://i.pravatar.cc/150?u=jamie" },
        publishedAt: "2024-01-04",
        readTime: "9 min read",
        tags: ["Accessibility", "A11y", "UX"],
        category: "Design"
      },
      {
        id: "7",
        title: "State Management for Complex Workflows",
        excerpt: "Managing complex multi-step workflows in agentic applications using modern state patterns.",
        coverImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
        author: { name: "Drew Martinez", avatar: "https://i.pravatar.cc/150?u=drew" },
        publishedAt: "2024-01-02",
        readTime: "11 min read",
        tags: ["State", "Workflow", "Architecture"],
        category: "Development"
      },
      {
        id: "8",
        title: "Testing Conversational Components",
        excerpt: "Strategies for unit testing and integration testing of chat-based UI components.",
        coverImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800",
        author: { name: "Riley Johnson", avatar: "https://i.pravatar.cc/150?u=riley" },
        publishedAt: "2023-12-30",
        readTime: "8 min read",
        tags: ["Testing", "Quality", "CI/CD"],
        category: "Development"
      },
      {
        id: "9",
        title: "Theming and Dark Mode Support",
        excerpt: "Implementing flexible theming systems with dark mode for agentic UI components.",
        coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800",
        author: { name: "Avery Williams", avatar: "https://i.pravatar.cc/150?u=avery" },
        publishedAt: "2023-12-28",
        readTime: "7 min read",
        tags: ["Theming", "Dark Mode", "CSS"],
        category: "Design"
      },
      {
        id: "10",
        title: "Performance Optimization Techniques",
        excerpt: "Optimizing render performance and reducing bundle size in chat applications.",
        coverImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800",
        author: { name: "Quinn Anderson", avatar: "https://i.pravatar.cc/150?u=quinn" },
        publishedAt: "2023-12-25",
        readTime: "13 min read",
        tags: ["Performance", "Optimization", "React"],
        category: "Development"
      },
      {
        id: "11",
        title: "Error Handling and Recovery",
        excerpt: "Graceful error handling patterns and user-friendly recovery flows in conversational UIs.",
        coverImage: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800",
        author: { name: "Sage Thompson", avatar: "https://i.pravatar.cc/150?u=sage" },
        publishedAt: "2023-12-22",
        readTime: "10 min read",
        tags: ["Error Handling", "UX", "Resilience"],
        category: "Development"
      },
      {
        id: "12",
        title: "Internationalization Best Practices",
        excerpt: "Making your agentic UI components work across languages and locales.",
        coverImage: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800",
        author: { name: "Blake Garcia", avatar: "https://i.pravatar.cc/150?u=blake" },
        publishedAt: "2023-12-20",
        readTime: "9 min read",
        tags: ["i18n", "Localization", "Global"],
        category: "Design"
      },
      {
        id: "13",
        title: "Mobile-First Chat Design",
        excerpt: "Designing conversational interfaces that work beautifully on mobile devices.",
        coverImage: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800",
        author: { name: "Charlie Brown", avatar: "https://i.pravatar.cc/150?u=charlie" },
        publishedAt: "2023-12-18",
        readTime: "8 min read",
        tags: ["Mobile", "Responsive", "Design"],
        category: "Design"
      },
      {
        id: "14",
        title: "Analytics and User Insights",
        excerpt: "Tracking user interactions and deriving insights from conversational UI usage.",
        coverImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
        author: { name: "Sydney Chen", avatar: "https://i.pravatar.cc/150?u=sydney" },
        publishedAt: "2023-12-15",
        readTime: "11 min read",
        tags: ["Analytics", "Insights", "Data"],
        category: "Tutorial"
      },
      {
        id: "15",
        title: "Building Reusable Component Libraries",
        excerpt: "Creating a scalable component library for agentic UIs that teams can share.",
        coverImage: "https://images.unsplash.com/photo-1558655146-d09347e92766?w=800",
        author: { name: "Taylor Swift", avatar: "https://i.pravatar.cc/150?u=taylor" },
        publishedAt: "2023-12-12",
        readTime: "14 min read",
        tags: ["Components", "Library", "Scalability"],
        category: "Development"
      }
    ]
  }}
  appearance={{
    variant: "grid",
    columns: 2,
    showAuthor: true,
    showCategory: true
  }}
  actions={{
    onReadMore: (post) => console.log("Read more:", post.title)
  }}
/>`,
          },
          {
            id: 'carousel',
            name: 'Carousel',
            component: <PostListDemo data={{ posts: demoPosts }} appearance={{ variant: 'carousel' }} />,
            fullscreenComponent: (
              <PostList
                data={{ posts: demoPosts }}
                appearance={{
                  variant: 'fullwidth',
                  columns: 3,
                }}
              />
            ),
            usageCode: `<PostList
  data={{
    posts: [
      {
        id: "1",
        title: "Getting Started with Agentic UI Components",
        excerpt: "Learn how to build conversational interfaces with our comprehensive component library designed for AI-powered applications.",
        coverImage: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800",
        author: { name: "Sarah Chen", avatar: "https://i.pravatar.cc/150?u=sarah" },
        publishedAt: "2024-01-15",
        readTime: "5 min read",
        tags: ["Tutorial", "Components", "AI"],
        category: "Tutorial"
      },
      {
        id: "2",
        title: "Designing for Conversational Interfaces",
        excerpt: "Best practices for creating intuitive UI components that work within chat environments.",
        coverImage: "https://images.unsplash.com/photo-1559028012-481c04fa702d?w=800",
        author: { name: "Alex Rivera", avatar: "https://i.pravatar.cc/150?u=alex" },
        publishedAt: "2024-01-12",
        readTime: "8 min read",
        tags: ["Design", "UX"],
        category: "Design"
      },
      {
        id: "3",
        title: "MCP Integration Patterns",
        excerpt: "How to leverage Model Context Protocol for seamless backend communication in your agentic applications.",
        coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800",
        author: { name: "Jordan Kim", avatar: "https://i.pravatar.cc/150?u=jordan" },
        publishedAt: "2024-01-10",
        readTime: "12 min read",
        tags: ["MCP", "Backend", "Integration"],
        category: "Development"
      },
      {
        id: "4",
        title: "Building Payment Flows in Chat",
        excerpt: "A complete guide to implementing secure, user-friendly payment experiences within conversational interfaces.",
        coverImage: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800",
        author: { name: "Morgan Lee", avatar: "https://i.pravatar.cc/150?u=morgan" },
        publishedAt: "2024-01-08",
        readTime: "10 min read",
        tags: ["Payments", "Security"],
        category: "Tutorial"
      },
      {
        id: "5",
        title: "Real-time Collaboration in AI Apps",
        excerpt: "Implementing WebSocket connections and real-time updates for collaborative agentic experiences.",
        coverImage: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800",
        author: { name: "Casey Taylor", avatar: "https://i.pravatar.cc/150?u=casey" },
        publishedAt: "2024-01-06",
        readTime: "15 min read",
        tags: ["WebSocket", "Real-time", "Collaboration"],
        category: "Development"
      },
      {
        id: "6",
        title: "Accessibility in Chat Interfaces",
        excerpt: "Making your conversational UI accessible to all users with screen readers and keyboard navigation.",
        coverImage: "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=800",
        author: { name: "Jamie Park", avatar: "https://i.pravatar.cc/150?u=jamie" },
        publishedAt: "2024-01-04",
        readTime: "9 min read",
        tags: ["Accessibility", "A11y", "UX"],
        category: "Design"
      },
      {
        id: "7",
        title: "State Management for Complex Workflows",
        excerpt: "Managing complex multi-step workflows in agentic applications using modern state patterns.",
        coverImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
        author: { name: "Drew Martinez", avatar: "https://i.pravatar.cc/150?u=drew" },
        publishedAt: "2024-01-02",
        readTime: "11 min read",
        tags: ["State", "Workflow", "Architecture"],
        category: "Development"
      },
      {
        id: "8",
        title: "Testing Conversational Components",
        excerpt: "Strategies for unit testing and integration testing of chat-based UI components.",
        coverImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800",
        author: { name: "Riley Johnson", avatar: "https://i.pravatar.cc/150?u=riley" },
        publishedAt: "2023-12-30",
        readTime: "8 min read",
        tags: ["Testing", "Quality", "CI/CD"],
        category: "Development"
      },
      {
        id: "9",
        title: "Theming and Dark Mode Support",
        excerpt: "Implementing flexible theming systems with dark mode for agentic UI components.",
        coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800",
        author: { name: "Avery Williams", avatar: "https://i.pravatar.cc/150?u=avery" },
        publishedAt: "2023-12-28",
        readTime: "7 min read",
        tags: ["Theming", "Dark Mode", "CSS"],
        category: "Design"
      },
      {
        id: "10",
        title: "Performance Optimization Techniques",
        excerpt: "Optimizing render performance and reducing bundle size in chat applications.",
        coverImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800",
        author: { name: "Quinn Anderson", avatar: "https://i.pravatar.cc/150?u=quinn" },
        publishedAt: "2023-12-25",
        readTime: "13 min read",
        tags: ["Performance", "Optimization", "React"],
        category: "Development"
      },
      {
        id: "11",
        title: "Error Handling and Recovery",
        excerpt: "Graceful error handling patterns and user-friendly recovery flows in conversational UIs.",
        coverImage: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800",
        author: { name: "Sage Thompson", avatar: "https://i.pravatar.cc/150?u=sage" },
        publishedAt: "2023-12-22",
        readTime: "10 min read",
        tags: ["Error Handling", "UX", "Resilience"],
        category: "Development"
      },
      {
        id: "12",
        title: "Internationalization Best Practices",
        excerpt: "Making your agentic UI components work across languages and locales.",
        coverImage: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800",
        author: { name: "Blake Garcia", avatar: "https://i.pravatar.cc/150?u=blake" },
        publishedAt: "2023-12-20",
        readTime: "9 min read",
        tags: ["i18n", "Localization", "Global"],
        category: "Design"
      },
      {
        id: "13",
        title: "Mobile-First Chat Design",
        excerpt: "Designing conversational interfaces that work beautifully on mobile devices.",
        coverImage: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800",
        author: { name: "Charlie Brown", avatar: "https://i.pravatar.cc/150?u=charlie" },
        publishedAt: "2023-12-18",
        readTime: "8 min read",
        tags: ["Mobile", "Responsive", "Design"],
        category: "Design"
      },
      {
        id: "14",
        title: "Analytics and User Insights",
        excerpt: "Tracking user interactions and deriving insights from conversational UI usage.",
        coverImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
        author: { name: "Sydney Chen", avatar: "https://i.pravatar.cc/150?u=sydney" },
        publishedAt: "2023-12-15",
        readTime: "11 min read",
        tags: ["Analytics", "Insights", "Data"],
        category: "Tutorial"
      },
      {
        id: "15",
        title: "Building Reusable Component Libraries",
        excerpt: "Creating a scalable component library for agentic UIs that teams can share.",
        coverImage: "https://images.unsplash.com/photo-1558655146-d09347e92766?w=800",
        author: { name: "Taylor Swift", avatar: "https://i.pravatar.cc/150?u=taylor" },
        publishedAt: "2023-12-12",
        readTime: "14 min read",
        tags: ["Components", "Library", "Scalability"],
        category: "Development"
      }
    ]
  }}
  appearance={{
    variant: "carousel",
    showAuthor: true,
    showCategory: true
  }}
  actions={{
    onReadMore: (post) => console.log("Read more:", post.title)
  }}
/>`,
          },
        ],
      },
      {
        id: 'post-detail',
        name: 'Post Detail',
        description:
          'Full post view with Medium-style typography, cover image, author info, content, and related posts. Supports inline, pip, and fullscreen display modes.',
        registryName: 'post-detail',
        layouts: ['inline', 'pip', 'fullscreen'],
        actionCount: 3,
        variants: (() => {
          return [
            {
              id: 'default',
              name: 'Default',
              component: <PostDetailDemo data={demoPostDetailData} />,
              pipComponent: (
                <PostDetail data={demoPostDetailData} appearance={{ displayMode: 'pip' }} />
              ),
              fullscreenComponent: (
                <PostDetail data={demoPostDetailData} appearance={{ displayMode: 'fullscreen' }} />
              ),
              usageCode: `<PostDetail
  data={{
    post: {
      title: "Getting Started with Agentic UI Components",
      excerpt: "Learn how to build conversational interfaces with our comprehensive component library designed for AI-powered applications.",
      coverImage: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800",
      author: {
        name: "Sarah Chen",
        avatar: "https://i.pravatar.cc/150?u=sarah"
      },
      publishedAt: "2024-01-15",
      readTime: "5 min read",
      tags: ["Tutorial", "Components", "AI", "React", "TypeScript"],
      category: "Tutorial"
    },
    content: \`
      <p>Building modern AI-powered applications requires a new approach to UI design. Traditional web components don't always translate well to conversational interfaces, where context and flow are paramount.</p>

      <p>Our Agentic UI component library provides a collection of purpose-built components that work seamlessly within chat interfaces. From payment flows to product displays, each component is designed with the unique constraints of conversational UIs in mind.</p>

      <h2>Key Features</h2>
      <p>Each component supports three display modes: inline (within the chat flow), fullscreen (for complex interactions), and picture-in-picture (persistent visibility). This flexibility allows you to create rich, interactive experiences without breaking the conversational flow.</p>

      <p>Components are designed mobile-first and touch-friendly, ensuring a great experience across all devices. They automatically adapt to light and dark themes, and integrate seamlessly with MCP tools for backend communication.</p>
    \`,
    relatedPosts: [
      {
        title: "Designing for Conversational Interfaces",
        excerpt: "Best practices for creating intuitive UI components that work within chat environments.",
        coverImage: "https://images.unsplash.com/photo-1559028012-481c04fa702d?w=800",
        author: { name: "Alex Rivera", avatar: "https://i.pravatar.cc/150?u=alex" },
        publishedAt: "2024-01-12",
        readTime: "8 min read",
        tags: ["Design", "UX"],
        category: "Design",
        url: "https://example.com/posts/designing-conversational-interfaces"
      },
      {
        title: "MCP Integration Patterns",
        excerpt: "How to leverage Model Context Protocol for seamless backend communication.",
        coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800",
        author: { name: "Jordan Kim", avatar: "https://i.pravatar.cc/150?u=jordan" },
        publishedAt: "2024-01-10",
        readTime: "12 min read",
        tags: ["MCP", "Backend"],
        category: "Development",
        url: "https://example.com/posts/mcp-integration-patterns"
      }
    ]
  }}
  appearance={{
    showCover: true,
    showAuthor: true,
    // displayMode: "inline" | "pip" | "fullscreen"
    // - inline: Compact card with truncated content, "Read more" button
    // - pip: Minimal floating view with truncated content
    // - fullscreen: Full article view with complete content and related posts
    displayMode: "fullscreen"
  }}
  actions={{
    onBack: () => console.log("Back clicked"),
    onReadMore: () => console.log("Read more clicked (inline/pip modes)"),
    onReadRelated: (post) => console.log("Read related:", post.title)
  }}
/>`,
            },
          ];
        })(),
      },
    ],
  },
  {
    id: 'events',
    name: 'Events',
    blocks: [
      {
        id: 'event-card',
        name: 'Event Card',
        description: 'Display event information with various layouts.',
        registryName: 'event-card',
        layouts: ['inline'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <EventCard data={{ event: demoEvent }} />,
            usageCode: `<EventCard
  data={{
    event: {
      id: "evt-1",
      title: "NEON Vol. 9",
      category: "Music",
      venue: "Echoplex",
      neighborhood: "Echo Park",
      city: "Los Angeles",
      dateTime: "Tonight 9:00 PM - 3:00 AM",
      priceRange: "$45 - $150",
      image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800",
      vibeTags: ["High energy", "Late night", "Dressy"],
      ticketTiers: ["General Admission $45", "VIP Access $120"],
      eventSignal: "going-fast",
      organizerRating: 4.8,
      reviewCount: 12453,
      ageRestriction: "21+"
    }
  }}
  appearance={{
    variant: "default",
    showSignal: true,
    showTags: true,
    showRating: true
  }}
  actions={{
    onClick: (event) => console.log("Event clicked:", event.title)
  }}
/>`,
          },
          {
            id: 'compact',
            name: 'Compact',
            component: <EventCard data={{ event: demoEvent }} appearance={{ variant: 'compact' }} />,
            usageCode: `<EventCard
  data={{
    event: {
      id: "evt-today-2",
      title: "The Midnight Show",
      category: "Comedy",
      venue: "The Comedy Underground",
      neighborhood: "Santa Monica",
      city: "Los Angeles",
      dateTime: "Tonight 10:00 PM - 12:00 AM",
      priceRange: "$15 - $35",
      vibeTags: ["Social", "Late night", "Casual"],
      eventSignal: "popular",
      organizerRating: 4.7,
      reviewCount: 3241,
      discount: "TONIGHT ONLY - 40% OFF"
    }
  }}
  appearance={{
    variant: "compact",
    showSignal: true,
    showTags: true
  }}
  actions={{
    onClick: (event) => console.log("Event clicked:", event.title)
  }}
/>`,
          },
          {
            id: 'horizontal',
            name: 'Horizontal',
            component: <EventCard data={{ event: demoEvent }} appearance={{ variant: 'horizontal' }} />,
            usageCode: `<EventCard
  data={{
    event: {
      id: "evt-3",
      title: "Dawn Flow: Griffith Park",
      category: "Classes",
      venue: "Griffith Park",
      neighborhood: "Los Feliz",
      city: "Los Angeles",
      dateTime: "Tomorrow 6:00 AM - 8:00 AM",
      priceRange: "Free",
      vibeTags: ["Chill", "Wellness", "Outdoor"],
      eventSignal: "just-added",
      organizerRating: 4.9,
      reviewCount: 8764,
      discount: "FREE - First 50 Only"
    }
  }}
  appearance={{
    variant: "horizontal",
    showSignal: true,
    showTags: true
  }}
  actions={{
    onClick: (event) => console.log("Event clicked:", event.title)
  }}
/>`,
          },
          {
            id: 'covered',
            name: 'Covered',
            component: <EventCard data={{ event: demoEvent }} appearance={{ variant: 'covered' }} />,
            usageCode: `<EventCard
  data={{
    event: {
      id: "evt-5",
      title: "Lakers vs Celtics",
      category: "Sports",
      venue: "Crypto.com Arena",
      neighborhood: "Downtown",
      city: "Los Angeles",
      dateTime: "Friday 7:30 PM - 10:30 PM",
      priceRange: "$125 - $850",
      vibeTags: ["High energy", "Social", "Premium"],
      ticketTiers: ["Upper Level $125", "Lower Level $350", "Courtside $850"],
      eventSignal: "sales-end-soon",
      organizerRating: 4.5,
      reviewCount: 2341
    }
  }}
  appearance={{
    variant: "covered",
    showSignal: true,
    showTags: true,
    showRating: true
  }}
  actions={{
    onClick: (event) => console.log("Event clicked:", event.title)
  }}
/>`,
          },
        ],
      },
      {
        id: 'event-detail',
        name: 'Event Detail',
        description:
          'Detailed event view with organizer info, location, policies, FAQs, and ticket purchase.',
        registryName: 'event-detail',
        layouts: ['fullscreen'],
        actionCount: 5,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <EventDetail data={{ event: demoEventDetails }} />,
            usageCode: `<EventDetail
  data={{
    event: {
      id: "evt-4",
      title: "Meraki: Seth Troxler",
      category: "Nightlife",
      venue: "Celine Orlando",
      neighborhood: "Downtown",
      city: "Orlando",
      dateTime: "Saturday 10:00 PM - 4:00 AM",
      priceRange: "$35 - $65",
      vibeTags: ["High energy", "Late night", "Underground"],
      vibeDescription: "Raw, unfiltered techno in an authentic warehouse setting.",
      aiSummary: "Raw, unfiltered techno in an authentic warehouse setting. Perfect for underground music lovers.",
      lineup: ["Amelie Lens", "I Hate Models", "FJAAK"],
      ticketTiers: ["Early Bird (Sold Out)", "General Admission $57", "Table Service $260"],
      eventSignal: "going-fast",
      organizerRating: 4.6,
      reviewCount: 1876,
      venueRating: 4.8,
      ageRestriction: "21+",
      // EventDetails extended fields
      images: [
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800",
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800"
      ],
      description: "Experience the raw energy of underground techno.",
      attendeesCount: 537,
      friendsGoing: [
        { name: "Alex", avatar: "https://i.pravatar.cc/40?u=alex" },
        { name: "Sam", avatar: "https://i.pravatar.cc/40?u=sam" }
      ],
      organizer: {
        id: "1",
        name: "Midnight Lovers",
        image: "https://i.pravatar.cc/80?u=midnight",
        rating: 4.6,
        reviewCount: 1876,
        verified: true,
        followers: 1200,
        eventsCount: 154,
        hostingYears: 8,
        trackRecord: "great",
        responseRate: "very responsive"
      },
      address: "8827 Nasher Ave",
      coordinates: { lat: 29.7604, lng: -95.3698 },
      goodToKnow: {
        duration: "6 hours",
        doorsOpen: "10:00 PM",
        showtime: "10:30 PM",
        dressCode: "Casual",
        parking: "Limited, leave early to avoid long queues"
      },
      policies: {
        refund: "No refunds. Tickets are transferable.",
        entry: "Open 2 hours before event",
        idRequired: true,
        securityOnSite: true
      },
      faq: [
        { question: "What is the refund policy?", answer: "No refunds. Tickets are transferable." },
        { question: "When do doors open?", answer: "Open 2 hours before event." }
      ],
      relatedTags: ["Orlando Events", "Florida Nightlife", "Techno Parties"]
    }
  }}
  appearance={{
    showAiMatch: true,
    showMap: true
  }}
  actions={{
    onGetTickets: (event) => console.log("Get tickets for:", event.title),
    onShare: (event) => console.log("Share event:", event.title),
    onSave: (event) => console.log("Save event:", event.title),
    onBack: () => console.log("Navigate back"),
    onFollow: (organizer) => console.log("Follow organizer:", organizer?.name),
    onContact: (organizer) => console.log("Contact organizer:", organizer?.name)
  }}
/>`,
          },
        ],
      },
      {
        id: 'event-list',
        name: 'Event List',
        description:
          'Display a collection of events in grid, list, or carousel layouts. Fullscreen mode shows split-screen map view.',
        registryName: 'event-list',
        layouts: ['inline', 'fullscreen'],
        actionCount: 3,
        variants: [
          {
            id: 'grid',
            name: 'Grid',
            component: (
              <EventList
                data={{ title: 'Recommendations for you', events: demoEvents }}
                appearance={{ variant: 'grid' }}
              />
            ),
            fullscreenComponent: (
              <EventList
                data={{ title: 'Recommendations for you', events: demoEvents }}
                appearance={{ variant: 'fullwidth' }}
              />
            ),
            usageCode: `<EventList
  data={{
    title: "Recommendations for you",
    events: [
      { id: "evt-1", title: "NEON Vol. 9", category: "Music", venue: "Echoplex", neighborhood: "Echo Park", city: "Los Angeles", dateTime: "Tonight 9:00 PM - 3:00 AM", priceRange: "$45 - $150", image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800", coordinates: { lat: 34.0781, lng: -118.2606 }, vibeTags: ["High energy", "Late night"], eventSignal: "going-fast", organizerRating: 4.8, reviewCount: 12453, ageRestriction: "21+" },
      { id: "evt-2", title: "The Midnight Show", category: "Comedy", venue: "The Comedy Underground", neighborhood: "Santa Monica", city: "Los Angeles", dateTime: "Tonight 10:00 PM - 12:00 AM", priceRange: "$15 - $35", image: "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800", coordinates: { lat: 34.0195, lng: -118.4912 }, vibeTags: ["Social", "Late night"], eventSignal: "popular", organizerRating: 4.7, reviewCount: 3241, discount: "TONIGHT ONLY - 40% OFF" },
      { id: "evt-3", title: "Salsa Sundays @ Echo Park", category: "Classes", venue: "Echo Park Lake", neighborhood: "Echo Park", city: "Los Angeles", dateTime: "Saturday 6:00 PM - 10:00 PM", priceRange: "Free", image: "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=800", coordinates: { lat: 34.0731, lng: -118.2608 }, vibeTags: ["High energy", "Social"], eventSignal: "just-added", organizerRating: 4.9, reviewCount: 8764 },
      { id: "evt-4", title: "Dawn Flow: Griffith Park", category: "Classes", venue: "Griffith Park", neighborhood: "Los Feliz", city: "Los Angeles", dateTime: "Tomorrow 6:00 AM - 8:00 AM", priceRange: "Free", image: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800", coordinates: { lat: 34.1365, lng: -118.2943 }, vibeTags: ["Chill", "Wellness", "Outdoor"], organizerRating: 4.9, reviewCount: 8764, discount: "FREE - First 50 Only" },
      { id: "evt-5", title: "Lakers vs Celtics", category: "Sports", venue: "Crypto.com Arena", neighborhood: "Downtown", city: "Los Angeles", dateTime: "Friday 7:30 PM - 10:30 PM", priceRange: "$125 - $850", image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800", coordinates: { lat: 34.0430, lng: -118.2673 }, vibeTags: ["High energy", "Social", "Premium"], eventSignal: "sales-end-soon", organizerRating: 4.5, reviewCount: 2341 },
      { id: "evt-6", title: "Smorgasburg LA: Sunday Market", category: "Food & Drink", venue: "ROW DTLA", neighborhood: "Arts District", city: "Los Angeles", dateTime: "Sunday 10:00 AM - 4:00 PM", priceRange: "Free", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800", coordinates: { lat: 34.0341, lng: -118.2324 }, vibeTags: ["Family-friendly", "Outdoor", "Social"], organizerRating: 4.8, reviewCount: 5632 },
      { id: "evt-7", title: "LACMA After Hours", category: "Arts", venue: "LACMA", neighborhood: "Miracle Mile", city: "Los Angeles", dateTime: "Friday 7:00 PM - 11:00 PM", priceRange: "$35 - $75", image: "https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=800", coordinates: { lat: 34.0639, lng: -118.3592 }, vibeTags: ["Chill", "Date night", "Sophisticated"], organizerRating: 4.7, reviewCount: 1234, ageRestriction: "21+", discount: "MEMBER PRICE" },
      { id: "evt-8", title: "Blue Note Under Stars", category: "Music", venue: "Hollywood Bowl", neighborhood: "Hollywood Hills", city: "Los Angeles", dateTime: "Saturday 8:00 PM - 11:00 PM", priceRange: "$45 - $200", image: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800", coordinates: { lat: 34.1122, lng: -118.3391 }, vibeTags: ["Chill", "Date night", "Outdoor"], lineup: ["Kamasi Washington", "Thundercat", "Terrace Martin"], organizerRating: 4.8, reviewCount: 12453 },
      { id: "evt-9", title: "Meraki: Seth Troxler", category: "Nightlife", venue: "Sound Nightclub", neighborhood: "Hollywood", city: "Los Angeles", dateTime: "Saturday 10:00 PM - 4:00 AM", priceRange: "$35 - $65", image: "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800", coordinates: { lat: 34.0928, lng: -118.3287 }, vibeTags: ["High energy", "Late night", "Underground"], lineup: ["Amelie Lens", "I Hate Models", "FJAAK"], organizerRating: 4.6, reviewCount: 1876, ageRestriction: "21+" },
      { id: "evt-10", title: "Whitney Cummings + Friends", category: "Comedy", venue: "The Laugh Factory", neighborhood: "Hollywood", city: "Los Angeles", dateTime: "In 2 days 8:00 PM - 11:00 PM", priceRange: "$25 - $55", image: "https://images.unsplash.com/photo-1527224538127-2104bb71c51b?w=800", coordinates: { lat: 34.0901, lng: -118.3615 }, vibeTags: ["Chill", "Social", "Date night"], organizerRating: 4.7, reviewCount: 3241, ageRestriction: "18+" },
      { id: "evt-11", title: "Venice Beach Drum Circle", category: "Music", venue: "Venice Beach Boardwalk", neighborhood: "Venice", city: "Los Angeles", dateTime: "Sunday 4:00 PM - 8:00 PM", priceRange: "Free", image: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800", coordinates: { lat: 33.9850, lng: -118.4695 }, vibeTags: ["Outdoor", "Social", "Chill"], eventSignal: "popular", organizerRating: 4.6, reviewCount: 2145 },
      { id: "evt-12", title: "Rooftop Cinema: Blade Runner", category: "Film", venue: "Rooftop Cinema Club", neighborhood: "DTLA", city: "Los Angeles", dateTime: "Friday 8:30 PM - 11:00 PM", priceRange: "$25 - $45", image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800", coordinates: { lat: 34.0407, lng: -118.2468 }, vibeTags: ["Date night", "Views", "Chill"], organizerRating: 4.8, reviewCount: 892 },
      { id: "evt-13", title: "Dodgers vs Giants", category: "Sports", venue: "Dodger Stadium", neighborhood: "Elysian Park", city: "Los Angeles", dateTime: "Saturday 1:10 PM - 4:30 PM", priceRange: "$35 - $350", image: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800", coordinates: { lat: 34.0739, lng: -118.2400 }, vibeTags: ["Family-friendly", "Social", "High energy"], eventSignal: "few-tickets-left", organizerRating: 4.7, reviewCount: 15678 },
      { id: "evt-14", title: "Natural Wine Fair", category: "Food & Drink", venue: "Grand Central Market", neighborhood: "Downtown", city: "Los Angeles", dateTime: "Sunday 12:00 PM - 6:00 PM", priceRange: "$45 - $85", image: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800", coordinates: { lat: 34.0508, lng: -118.2490 }, vibeTags: ["Tasting", "Social", "Sophisticated"], eventSignal: "just-added", organizerRating: 4.5, reviewCount: 567, ageRestriction: "21+" },
      { id: "evt-15", title: "Meditation in the Gardens", category: "Wellness", venue: "The Getty Center", neighborhood: "Brentwood", city: "Los Angeles", dateTime: "Sunday 7:00 AM - 9:00 AM", priceRange: "Free", image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800", coordinates: { lat: 34.0780, lng: -118.4741 }, vibeTags: ["Wellness", "Outdoor", "Chill"], organizerRating: 4.9, reviewCount: 1234 }
    ]
  }}
  appearance={{ variant: "grid" }}
  actions={{
    onEventSelect: (event) => console.log("Event selected:", event.title)
  }}
/>`,
          },
          {
            id: 'list',
            name: 'List',
            component: (
              <EventList
                data={{ title: 'Recommendations for you', events: demoEvents }}
                appearance={{ variant: 'list' }}
              />
            ),
            fullscreenComponent: (
              <EventList
                data={{ title: 'Recommendations for you', events: demoEvents }}
                appearance={{ variant: 'fullwidth' }}
              />
            ),
            usageCode: `<EventList
  data={{
    title: "Recommendations for you",
    events: [
      { id: "evt-1", title: "NEON Vol. 9", category: "Music", venue: "Echoplex", neighborhood: "Echo Park", city: "Los Angeles", dateTime: "Tonight 9:00 PM - 3:00 AM", priceRange: "$45 - $150", image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800", coordinates: { lat: 34.0781, lng: -118.2606 }, vibeTags: ["High energy", "Late night"], eventSignal: "going-fast", organizerRating: 4.8, reviewCount: 12453, ageRestriction: "21+" },
      { id: "evt-2", title: "The Midnight Show", category: "Comedy", venue: "The Comedy Underground", neighborhood: "Santa Monica", city: "Los Angeles", dateTime: "Tonight 10:00 PM - 12:00 AM", priceRange: "$15 - $35", image: "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800", coordinates: { lat: 34.0195, lng: -118.4912 }, vibeTags: ["Social", "Late night"], eventSignal: "popular", organizerRating: 4.7, reviewCount: 3241, discount: "TONIGHT ONLY - 40% OFF" },
      { id: "evt-3", title: "Salsa Sundays @ Echo Park", category: "Classes", venue: "Echo Park Lake", neighborhood: "Echo Park", city: "Los Angeles", dateTime: "Saturday 6:00 PM - 10:00 PM", priceRange: "Free", image: "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=800", coordinates: { lat: 34.0731, lng: -118.2608 }, vibeTags: ["High energy", "Social"], eventSignal: "just-added", organizerRating: 4.9, reviewCount: 8764 },
      { id: "evt-4", title: "Dawn Flow: Griffith Park", category: "Classes", venue: "Griffith Park", neighborhood: "Los Feliz", city: "Los Angeles", dateTime: "Tomorrow 6:00 AM - 8:00 AM", priceRange: "Free", image: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800", coordinates: { lat: 34.1365, lng: -118.2943 }, vibeTags: ["Chill", "Wellness", "Outdoor"], organizerRating: 4.9, reviewCount: 8764, discount: "FREE - First 50 Only" },
      { id: "evt-5", title: "Lakers vs Celtics", category: "Sports", venue: "Crypto.com Arena", neighborhood: "Downtown", city: "Los Angeles", dateTime: "Friday 7:30 PM - 10:30 PM", priceRange: "$125 - $850", image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800", coordinates: { lat: 34.0430, lng: -118.2673 }, vibeTags: ["High energy", "Social", "Premium"], eventSignal: "sales-end-soon", organizerRating: 4.5, reviewCount: 2341 },
      { id: "evt-6", title: "Smorgasburg LA: Sunday Market", category: "Food & Drink", venue: "ROW DTLA", neighborhood: "Arts District", city: "Los Angeles", dateTime: "Sunday 10:00 AM - 4:00 PM", priceRange: "Free", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800", coordinates: { lat: 34.0341, lng: -118.2324 }, vibeTags: ["Family-friendly", "Outdoor", "Social"], organizerRating: 4.8, reviewCount: 5632 },
      { id: "evt-7", title: "LACMA After Hours", category: "Arts", venue: "LACMA", neighborhood: "Miracle Mile", city: "Los Angeles", dateTime: "Friday 7:00 PM - 11:00 PM", priceRange: "$35 - $75", image: "https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=800", coordinates: { lat: 34.0639, lng: -118.3592 }, vibeTags: ["Chill", "Date night", "Sophisticated"], organizerRating: 4.7, reviewCount: 1234, ageRestriction: "21+", discount: "MEMBER PRICE" },
      { id: "evt-8", title: "Blue Note Under Stars", category: "Music", venue: "Hollywood Bowl", neighborhood: "Hollywood Hills", city: "Los Angeles", dateTime: "Saturday 8:00 PM - 11:00 PM", priceRange: "$45 - $200", image: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800", coordinates: { lat: 34.1122, lng: -118.3391 }, vibeTags: ["Chill", "Date night", "Outdoor"], lineup: ["Kamasi Washington", "Thundercat", "Terrace Martin"], organizerRating: 4.8, reviewCount: 12453 },
      { id: "evt-9", title: "Meraki: Seth Troxler", category: "Nightlife", venue: "Sound Nightclub", neighborhood: "Hollywood", city: "Los Angeles", dateTime: "Saturday 10:00 PM - 4:00 AM", priceRange: "$35 - $65", image: "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800", coordinates: { lat: 34.0928, lng: -118.3287 }, vibeTags: ["High energy", "Late night", "Underground"], lineup: ["Amelie Lens", "I Hate Models", "FJAAK"], organizerRating: 4.6, reviewCount: 1876, ageRestriction: "21+" },
      { id: "evt-10", title: "Whitney Cummings + Friends", category: "Comedy", venue: "The Laugh Factory", neighborhood: "Hollywood", city: "Los Angeles", dateTime: "In 2 days 8:00 PM - 11:00 PM", priceRange: "$25 - $55", image: "https://images.unsplash.com/photo-1527224538127-2104bb71c51b?w=800", coordinates: { lat: 34.0901, lng: -118.3615 }, vibeTags: ["Chill", "Social", "Date night"], organizerRating: 4.7, reviewCount: 3241, ageRestriction: "18+" },
      { id: "evt-11", title: "Venice Beach Drum Circle", category: "Music", venue: "Venice Beach Boardwalk", neighborhood: "Venice", city: "Los Angeles", dateTime: "Sunday 4:00 PM - 8:00 PM", priceRange: "Free", image: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800", coordinates: { lat: 33.9850, lng: -118.4695 }, vibeTags: ["Outdoor", "Social", "Chill"], eventSignal: "popular", organizerRating: 4.6, reviewCount: 2145 },
      { id: "evt-12", title: "Rooftop Cinema: Blade Runner", category: "Film", venue: "Rooftop Cinema Club", neighborhood: "DTLA", city: "Los Angeles", dateTime: "Friday 8:30 PM - 11:00 PM", priceRange: "$25 - $45", image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800", coordinates: { lat: 34.0407, lng: -118.2468 }, vibeTags: ["Date night", "Views", "Chill"], organizerRating: 4.8, reviewCount: 892 },
      { id: "evt-13", title: "Dodgers vs Giants", category: "Sports", venue: "Dodger Stadium", neighborhood: "Elysian Park", city: "Los Angeles", dateTime: "Saturday 1:10 PM - 4:30 PM", priceRange: "$35 - $350", image: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800", coordinates: { lat: 34.0739, lng: -118.2400 }, vibeTags: ["Family-friendly", "Social", "High energy"], eventSignal: "few-tickets-left", organizerRating: 4.7, reviewCount: 15678 },
      { id: "evt-14", title: "Natural Wine Fair", category: "Food & Drink", venue: "Grand Central Market", neighborhood: "Downtown", city: "Los Angeles", dateTime: "Sunday 12:00 PM - 6:00 PM", priceRange: "$45 - $85", image: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800", coordinates: { lat: 34.0508, lng: -118.2490 }, vibeTags: ["Tasting", "Social", "Sophisticated"], eventSignal: "just-added", organizerRating: 4.5, reviewCount: 567, ageRestriction: "21+" },
      { id: "evt-15", title: "Meditation in the Gardens", category: "Wellness", venue: "The Getty Center", neighborhood: "Brentwood", city: "Los Angeles", dateTime: "Sunday 7:00 AM - 9:00 AM", priceRange: "Free", image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800", coordinates: { lat: 34.0780, lng: -118.4741 }, vibeTags: ["Wellness", "Outdoor", "Chill"], organizerRating: 4.9, reviewCount: 1234 }
    ]
  }}
  appearance={{ variant: "list" }}
  actions={{
    onEventSelect: (event) => console.log("Event selected:", event.title)
  }}
/>`,
          },
          {
            id: 'carousel',
            name: 'Carousel',
            component: (
              <EventList
                data={{ title: 'Recommendations for you', events: demoEvents }}
                appearance={{ variant: 'carousel' }}
              />
            ),
            fullscreenComponent: (
              <EventList
                data={{ title: 'Recommendations for you', events: demoEvents }}
                appearance={{ variant: 'fullwidth' }}
              />
            ),
            usageCode: `<EventList
  data={{
    title: "Recommendations for you",
    events: [
      { id: "evt-1", title: "NEON Vol. 9", category: "Music", venue: "Echoplex", neighborhood: "Echo Park", city: "Los Angeles", dateTime: "Tonight 9:00 PM - 3:00 AM", priceRange: "$45 - $150", image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800", coordinates: { lat: 34.0781, lng: -118.2606 }, vibeTags: ["High energy", "Late night"], eventSignal: "going-fast", organizerRating: 4.8, reviewCount: 12453, ageRestriction: "21+" },
      { id: "evt-2", title: "The Midnight Show", category: "Comedy", venue: "The Comedy Underground", neighborhood: "Santa Monica", city: "Los Angeles", dateTime: "Tonight 10:00 PM - 12:00 AM", priceRange: "$15 - $35", image: "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800", coordinates: { lat: 34.0195, lng: -118.4912 }, vibeTags: ["Social", "Late night"], eventSignal: "popular", organizerRating: 4.7, reviewCount: 3241, discount: "TONIGHT ONLY - 40% OFF" },
      { id: "evt-3", title: "Salsa Sundays @ Echo Park", category: "Classes", venue: "Echo Park Lake", neighborhood: "Echo Park", city: "Los Angeles", dateTime: "Saturday 6:00 PM - 10:00 PM", priceRange: "Free", image: "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=800", coordinates: { lat: 34.0731, lng: -118.2608 }, vibeTags: ["High energy", "Social"], eventSignal: "just-added", organizerRating: 4.9, reviewCount: 8764 },
      { id: "evt-4", title: "Dawn Flow: Griffith Park", category: "Classes", venue: "Griffith Park", neighborhood: "Los Feliz", city: "Los Angeles", dateTime: "Tomorrow 6:00 AM - 8:00 AM", priceRange: "Free", image: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800", coordinates: { lat: 34.1365, lng: -118.2943 }, vibeTags: ["Chill", "Wellness", "Outdoor"], organizerRating: 4.9, reviewCount: 8764, discount: "FREE - First 50 Only" },
      { id: "evt-5", title: "Lakers vs Celtics", category: "Sports", venue: "Crypto.com Arena", neighborhood: "Downtown", city: "Los Angeles", dateTime: "Friday 7:30 PM - 10:30 PM", priceRange: "$125 - $850", image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800", coordinates: { lat: 34.0430, lng: -118.2673 }, vibeTags: ["High energy", "Social", "Premium"], eventSignal: "sales-end-soon", organizerRating: 4.5, reviewCount: 2341 },
      { id: "evt-6", title: "Smorgasburg LA: Sunday Market", category: "Food & Drink", venue: "ROW DTLA", neighborhood: "Arts District", city: "Los Angeles", dateTime: "Sunday 10:00 AM - 4:00 PM", priceRange: "Free", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800", coordinates: { lat: 34.0341, lng: -118.2324 }, vibeTags: ["Family-friendly", "Outdoor", "Social"], organizerRating: 4.8, reviewCount: 5632 },
      { id: "evt-7", title: "LACMA After Hours", category: "Arts", venue: "LACMA", neighborhood: "Miracle Mile", city: "Los Angeles", dateTime: "Friday 7:00 PM - 11:00 PM", priceRange: "$35 - $75", image: "https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=800", coordinates: { lat: 34.0639, lng: -118.3592 }, vibeTags: ["Chill", "Date night", "Sophisticated"], organizerRating: 4.7, reviewCount: 1234, ageRestriction: "21+", discount: "MEMBER PRICE" },
      { id: "evt-8", title: "Blue Note Under Stars", category: "Music", venue: "Hollywood Bowl", neighborhood: "Hollywood Hills", city: "Los Angeles", dateTime: "Saturday 8:00 PM - 11:00 PM", priceRange: "$45 - $200", image: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800", coordinates: { lat: 34.1122, lng: -118.3391 }, vibeTags: ["Chill", "Date night", "Outdoor"], lineup: ["Kamasi Washington", "Thundercat", "Terrace Martin"], organizerRating: 4.8, reviewCount: 12453 },
      { id: "evt-9", title: "Meraki: Seth Troxler", category: "Nightlife", venue: "Sound Nightclub", neighborhood: "Hollywood", city: "Los Angeles", dateTime: "Saturday 10:00 PM - 4:00 AM", priceRange: "$35 - $65", image: "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800", coordinates: { lat: 34.0928, lng: -118.3287 }, vibeTags: ["High energy", "Late night", "Underground"], lineup: ["Amelie Lens", "I Hate Models", "FJAAK"], organizerRating: 4.6, reviewCount: 1876, ageRestriction: "21+" },
      { id: "evt-10", title: "Whitney Cummings + Friends", category: "Comedy", venue: "The Laugh Factory", neighborhood: "Hollywood", city: "Los Angeles", dateTime: "In 2 days 8:00 PM - 11:00 PM", priceRange: "$25 - $55", image: "https://images.unsplash.com/photo-1527224538127-2104bb71c51b?w=800", coordinates: { lat: 34.0901, lng: -118.3615 }, vibeTags: ["Chill", "Social", "Date night"], organizerRating: 4.7, reviewCount: 3241, ageRestriction: "18+" },
      { id: "evt-11", title: "Venice Beach Drum Circle", category: "Music", venue: "Venice Beach Boardwalk", neighborhood: "Venice", city: "Los Angeles", dateTime: "Sunday 4:00 PM - 8:00 PM", priceRange: "Free", image: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800", coordinates: { lat: 33.9850, lng: -118.4695 }, vibeTags: ["Outdoor", "Social", "Chill"], eventSignal: "popular", organizerRating: 4.6, reviewCount: 2145 },
      { id: "evt-12", title: "Rooftop Cinema: Blade Runner", category: "Film", venue: "Rooftop Cinema Club", neighborhood: "DTLA", city: "Los Angeles", dateTime: "Friday 8:30 PM - 11:00 PM", priceRange: "$25 - $45", image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800", coordinates: { lat: 34.0407, lng: -118.2468 }, vibeTags: ["Date night", "Views", "Chill"], organizerRating: 4.8, reviewCount: 892 },
      { id: "evt-13", title: "Dodgers vs Giants", category: "Sports", venue: "Dodger Stadium", neighborhood: "Elysian Park", city: "Los Angeles", dateTime: "Saturday 1:10 PM - 4:30 PM", priceRange: "$35 - $350", image: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800", coordinates: { lat: 34.0739, lng: -118.2400 }, vibeTags: ["Family-friendly", "Social", "High energy"], eventSignal: "few-tickets-left", organizerRating: 4.7, reviewCount: 15678 },
      { id: "evt-14", title: "Natural Wine Fair", category: "Food & Drink", venue: "Grand Central Market", neighborhood: "Downtown", city: "Los Angeles", dateTime: "Sunday 12:00 PM - 6:00 PM", priceRange: "$45 - $85", image: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800", coordinates: { lat: 34.0508, lng: -118.2490 }, vibeTags: ["Tasting", "Social", "Sophisticated"], eventSignal: "just-added", organizerRating: 4.5, reviewCount: 567, ageRestriction: "21+" },
      { id: "evt-15", title: "Meditation in the Gardens", category: "Wellness", venue: "The Getty Center", neighborhood: "Brentwood", city: "Los Angeles", dateTime: "Sunday 7:00 AM - 9:00 AM", priceRange: "Free", image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800", coordinates: { lat: 34.0780, lng: -118.4741 }, vibeTags: ["Wellness", "Outdoor", "Chill"], organizerRating: 4.9, reviewCount: 1234 }
    ]
  }}
  appearance={{ variant: "carousel" }}
  actions={{
    onEventSelect: (event) => console.log("Event selected:", event.title)
  }}
/>`,
          },
        ],
      },
      {
        id: 'ticket-tier-select',
        name: 'Ticket Tier Select',
        description: 'Select ticket tiers with quantity controls and order summary.',
        registryName: 'ticket-tier-select',
        layouts: ['inline'],
        actionCount: 2,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: (
              <TicketTierSelect
                data={{
                  event: {
                    title: 'Player Play Date',
                    date: 'Fri, Feb 06 · 2:00 pm',
                    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
                    currency: 'USD',
                  },
                  tiers: demoTicketTiers,
                }}
              />
            ),
            usageCode: `<TicketTierSelect
  data={{
    event: {
      title: "Player Play Date",
      date: "Fri, Feb 06 · 2:00 pm",
      image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800",
      currency: "USD"
    },
    tiers: [
      {
        id: "early-bird",
        name: "Early Bird",
        description: "Limited availability - best price!",
        price: 45,
        fee: 5.50,
        available: 12,
        maxPerOrder: 4
      },
      {
        id: "general",
        name: "General Admission",
        description: "Standard entry to the event",
        price: 65,
        fee: 7.25,
        available: 250,
        maxPerOrder: 8
      },
      {
        id: "vip",
        name: "VIP Access",
        description: "Premium experience with exclusive perks",
        price: 150,
        fee: 12.00,
        available: 20,
        maxPerOrder: 2
      }
    ]
  }}
  actions={{
    onCheckout: (selections, total) => console.log("Checkout:", selections, "Total:", total)
  }}
  appearance={{
    showOrderSummary: true
  }}
/>`,
          },
        ],
      },
      {
        id: 'event-confirmation',
        name: 'Event Confirmation',
        description: 'Order confirmation with event details, organizer follow, and social sharing.',
        registryName: 'event-confirmation',
        layouts: ['inline', 'fullscreen'],
        actionCount: 3,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <EventConfirmation data={demoEventConfirmation} />,
            usageCode: `<EventConfirmation
  data={{
    orderNumber: "#14040333743",
    eventTitle: "Cavity Free SF Children's Oral Health Strategic Plan Launch",
    ticketCount: 2,
    recipientEmail: "john@example.com",
    eventDate: "Thursday, February 19 · 9am - 12pm PST",
    eventLocation: "San Francisco, CA",
    organizer: {
      name: "CavityFree SF",
      image: "https://i.pravatar.cc/80?u=cavityfree"
    }
  }}
  actions={{
    onViewTickets: () => console.log("View tickets"),
    onFollowOrganizer: () => console.log("Follow organizer"),
    onShare: (platform) => console.log("Share on:", platform)
  }}
/>`,
          },
        ],
      },
    ],
  },
  {
    id: 'form',
    name: 'Forms',
    blocks: [
      {
        id: 'contact-form',
        name: 'Contact Form',
        description:
          'A complete contact form with name fields, phone number with country selector, email, message textarea, and file attachment.',
        registryName: 'contact-form',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <ContactForm />,
            fullscreenComponent: (
              <div className="max-w-[680px] mx-auto">
                <ContactForm />
              </div>
            ),
            usageCode: `<ContactForm
  data={{
    title: "Contact us",
    subtitle: "Fill out the form below and we'll get back to you as soon as possible.",
    submitLabel: "Send message",
    initialValues: {
      firstName: "John",
      lastName: "Doe",
      countryId: "us",
      countryCode: "+1",
      phoneNumber: "(555) 123-4567",
      email: "john.doe@example.com",
      message: "I'm interested in learning more about your services."
    }
  }}
  appearance={{
    showTitle: true
  }}
  actions={{
    onSubmit: (formData) => console.log(formData)
  }}
/>`,
          },
        ],
      },
      {
        id: 'date-time-picker',
        name: 'Date & Time Picker',
        description:
          'A Calendly-style date and time picker. Select a date to reveal available time slots, then select a time to show the Next button.',
        registryName: 'date-time-picker',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <DateTimePicker />,
            fullscreenComponent: (
              <div className="max-w-[680px] mx-auto">
                <DateTimePicker />
              </div>
            ),
            usageCode: `<DateTimePicker
  data={{
    title: "Select a Date & Time",
    availableDates: [
      new Date(2025, 0, 7),
      new Date(2025, 0, 8)
    ],
    availableTimeSlots: ["9:00am", "10:00am", "2:00pm"],
    timezone: "Eastern Time - US & Canada"
  }}
  appearance={{
    showTitle: true,
    showTimezone: true,
    weekStartsOn: "sunday" // "sunday" | "monday" | "saturday"
  }}
  actions={{
    onNext: (date, time) => console.log("Confirmed:", { date, time })
  }}
/>`,
          },
        ],
      },
      {
        id: 'issue-report-form',
        name: 'Issue Report Form',
        description:
          'A compact issue reporting form for team members with categories, subcategories, impact/urgency levels, and file attachments.',
        registryName: 'issue-report-form',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <IssueReportForm />,
            fullscreenComponent: (
              <div className="max-w-[680px] mx-auto">
                <IssueReportForm />
              </div>
            ),
            usageCode: `<IssueReportForm
  data={{
    title: "Report an Issue",
    teams: ["Engineering", "Product", "Design"],
    locations: ["New York - HQ", "San Francisco"],
    categories: {
      Software: ["Business App", "Email"],
      Hardware: ["Computer", "Monitor"]
    }
  }}
  appearance={{
    showTitle: true,
    compactMode: true
  }}
  actions={{
    onSubmit: (formData) => console.log("Issue reported:", formData)
  }}
/>`,
          },
        ],
      },
    ],
  },
  {
    id: 'list',
    name: 'List',
    blocks: [
      {
        id: 'product-list',
        name: 'Product List',
        description: 'Display products in various layouts',
        registryName: 'product-list',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 2,
        variants: [
          {
            id: 'list',
            name: 'List',
            component: <ProductList data={{ products: demoProducts }} appearance={{ variant: 'list' }} />,
            usageCode: `<ProductList
  data={{
    products: [
      {
        id: "1",
        name: "Air Force 1 '07",
        description: "Nike",
        price: 119,
        image: "https://ui.manifest.build/demo/shoe-1.png",
        rating: 4.9
      }
    ]
  }}
  appearance={{ variant: "list", currency: "EUR" }}
  actions={{ onSelectProduct: (product) => console.log(product) }}
/>`,
          },
          {
            id: 'grid',
            name: 'Grid',
            component: <ProductList data={{ products: demoProducts }} appearance={{ variant: 'grid' }} />,
            usageCode: `<ProductList
  data={{ products: [...] }}
  appearance={{ variant: "grid", columns: 4, currency: "USD" }}
  actions={{ onSelectProduct: (product) => console.log(product) }}
/>`,
          },
          {
            id: 'carousel',
            name: 'Carousel',
            component: <ProductList data={{ products: demoProducts }} appearance={{ variant: 'carousel' }} />,
            usageCode: `<ProductList
  data={{ products: [...] }}
  appearance={{ variant: "carousel" }}
  actions={{ onSelectProduct: (product) => console.log(product) }}
/>`,
          },
          {
            id: 'picker',
            name: 'Picker',
            component: <ProductList data={{ products: demoProducts }} appearance={{ variant: 'picker' }} />,
            usageCode: `<ProductList
  data={{ products: [...] }}
  appearance={{ variant: "picker", buttonLabel: "Add to cart" }}
  actions={{ onAddToCart: (products) => console.log("Cart:", products) }}
/>`,
          },
        ],
      },
      {
        id: 'table',
        name: 'Table',
        description: 'Data table with header, footer, expand to fullscreen, and optional selection',
        registryName: 'table',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 6,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <TableDemo data={{ title: 'API Usage', columns: demoApiUsageColumns, rows: demoApiUsageRows }} />,
            fullscreenComponent: (
              <Table data={{ title: 'API Usage', columns: demoApiUsageColumns, rows: demoApiUsageRows }} appearance={{ displayMode: 'fullscreen' }} />
            ),
            usageCode: `<Table
  data={{
    title: "API Usage",
    columns: [
      { header: "Model", accessor: "model", sortable: true },
      { header: "Total Tokens", accessor: "totalTokens", sortable: true, align: "right" }
    ],
    rows: [
      { model: "gpt-5", totalTokens: 2267482 },
      { model: "claude-3.5-sonnet", totalTokens: 647528 }
    ]
  }}
  appearance={{
    showHeader: true,
    showFooter: true,
    maxRows: 5
  }}
  actions={{
    onRefresh: () => console.log("Refreshing...")
  }}
/>`,
          },
          {
            id: 'single-select',
            name: 'Single Select',
            component: (
              <TableDemo data={{ title: 'Models', columns: demoModelsColumns, rows: demoModelsRows }} appearance={{ selectable: 'single' }} />
            ),
            fullscreenComponent: (
              <Table
                data={{ title: 'Models', columns: demoModelsColumns, rows: demoModelsRows }}
                appearance={{ selectable: 'single', displayMode: 'fullscreen' }}
              />
            ),
            usageCode: `<Table
  data={{ title: "Models", columns: [...], rows: [...] }}
  appearance={{ selectable: "single" }}
/>`,
          },
          {
            id: 'multi-select',
            name: 'Multi Select',
            component: (
              <TableDemo data={{ title: 'Export Data', columns: demoExportColumns, rows: demoExportRows }} appearance={{ selectable: 'multi' }} />
            ),
            fullscreenComponent: (
              <Table
                data={{ title: 'Export Data', columns: demoExportColumns, rows: demoExportRows }}
                appearance={{ selectable: 'multi', displayMode: 'fullscreen' }}
              />
            ),
            usageCode: `<Table
  data={{ title: "Export Data", columns: [...], rows: [...] }}
  appearance={{ selectable: "multi" }}
  actions={{
    onDownload: (rows) => console.log("Downloading..."),
    onShare: (rows) => console.log("Sharing...")
  }}
/>`,
          },
        ],
      },
    ],
  },
  {
    id: 'map',
    name: 'Map',
    blocks: [
      {
        id: 'map-carousel',
        name: 'Map Carousel',
        description: 'Interactive map with location markers and a draggable carousel of cards',
        registryName: 'map-carousel',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <MapCarousel data={{ locations: demoMapLocations, center: demoMapCenter, zoom: demoMapZoom }} />,
            fullscreenComponent: (
              <MapCarousel
                data={{ title: 'Hotels in San Francisco', locations: demoMapLocations, center: demoMapCenter, zoom: demoMapZoom }}
                appearance={{ displayMode: 'fullscreen' }}
                actions={{
                  onSelectLocation: (location) => console.log('Selected:', location.name),
                }}
              />
            ),
            usageCode: `<MapCarousel
  data={{
    title: "Hotels in San Francisco",
    locations: [
      {
        name: "FOUND Hotel Carlton",
        subtitle: "Downtown San Francisco",
        image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200",
        price: 284,
        priceLabel: "$284 total Jan 29 - Feb 1",
        priceSubtext: "USD • Includes taxes and fees",
        rating: 8.6,
        coordinates: [37.7879, -122.4137]
      },
      // ... more locations
    ],
    center: [37.7899, -122.4034],
    zoom: 12,
    mapStyle: "voyager"
  }}
  actions={{
    onSelectLocation: (location) => console.log("Selected:", location.name)
  }}
  appearance={{
    displayMode: "inline", // or "fullscreen" for split-screen layout
    mapHeight: "504px"
  }}
/>`,
          },
        ],
      },
    ],
  },
  {
    id: 'messaging',
    name: 'Messaging',
    blocks: [
      {
        id: 'message-bubble',
        name: 'Message Bubble',
        description: 'Chat message bubbles',
        registryName: 'chat-conversation',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'Text Messages',
            component: (
              <div className="space-y-3">
                <MessageBubble
                  data={{
                    content: 'Hey! How are you doing today?',
                    avatarUrl: 'https://i.pravatar.cc/150?u=sarah',
                    avatarFallback: 'S',
                    time: 'Dec 8, 10:30 AM',
                  }}
                />
                <MessageBubble
                  data={{
                    content: "I'm doing great, thanks for asking!",
                    avatarFallback: 'Y',
                    time: 'Dec 8, 10:31 AM',
                  }}
                  appearance={{ isOwn: true }}
                  control={{ status: 'read' }}
                />
              </div>
            ),
            usageCode: `<MessageBubble
  data={{
    content: "Hey! How are you doing today?",
    avatarUrl: "https://i.pravatar.cc/150?u=sarah",
    avatarFallback: "S",
    author: "Sarah",
    time: "10:30 AM"
  }}
/>

// Own message with status
<MessageBubble
  data={{ content: "I'm doing great!", avatarFallback: "Y", time: "10:31 AM" }}
  appearance={{ isOwn: true }}
  control={{ status: "read" }}
/>`,
          },
          {
            id: 'image',
            name: 'Image Messages',
            component: (
              <div className="space-y-3">
                <ImageMessageBubble
                  data={{
                    image:
                      'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=400&h=300&fit=crop',
                    content: 'Check out this view!',
                    avatarUrl: 'https://i.pravatar.cc/150?u=alex',
                    avatarFallback: 'A',
                    time: 'Dec 8, 2:45 PM',
                  }}
                />
                <ImageMessageBubble
                  data={{
                    image:
                      'https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=400&h=300&fit=crop',
                    time: 'Dec 8, 2:46 PM',
                  }}
                  appearance={{ isOwn: true }}
                  control={{ status: 'delivered' }}
                />
              </div>
            ),
            usageCode: `<ImageMessageBubble
  data={{
    image: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=400&h=300&fit=crop",
    content: "Check out this view!",
    avatarUrl: "https://i.pravatar.cc/150?u=alex",
    avatarFallback: "A",
    author: "Alex",
    time: "2:45 PM"
  }}
/>`,
          },
          {
            id: 'reactions',
            name: 'With Reactions',
            component: (
              <MessageWithReactions
                data={{
                  content: 'We just hit 10,000 users!',
                  avatarFallback: 'T',
                  time: 'Dec 8, 4:20 PM',
                  reactions: [
                    { emoji: '🎉', count: 5 },
                    { emoji: '❤️', count: 3 },
                    { emoji: '👏', count: 2 },
                  ],
                }}
              />
            ),
            usageCode: `<MessageWithReactions
  data={{
    content: "We just hit 10,000 users!",
    avatarUrl: "https://i.pravatar.cc/150?u=team",
    avatarFallback: "T",
    author: "Team",
    time: "4:20 PM",
    reactions: [
      { emoji: "🎉", count: 5 },
      { emoji: "❤️", count: 3 }
    ]
  }}
/>`,
          },
          {
            id: 'voice',
            name: 'Voice Messages',
            component: (
              <div className="space-y-3">
                <VoiceMessageBubble
                  data={{
                    duration: '0:42',
                    avatarUrl: 'https://i.pravatar.cc/150?u=mickael',
                    avatarFallback: 'M',
                    time: 'Dec 8, 3:15 PM',
                  }}
                />
                <VoiceMessageBubble
                  data={{
                    duration: '1:23',
                    avatarFallback: 'Y',
                    time: 'Dec 8, 3:17 PM',
                  }}
                  appearance={{ isOwn: true }}
                  control={{ status: 'read' }}
                />
              </div>
            ),
            usageCode: `<VoiceMessageBubble
  data={{
    duration: "0:42",
    avatarUrl: "https://i.pravatar.cc/150?u=mike",
    avatarFallback: "M",
    author: "Mike",
    time: "3:15 PM",
    audioSrc: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
  }}
/>

// Own voice message
<VoiceMessageBubble
  data={{
    duration: "1:23",
    avatarFallback: "Y",
    time: "3:17 PM",
    audioSrc: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
  }}
  appearance={{ isOwn: true }}
  control={{ status: "read" }}
/>`,
          },
        ],
      },
      {
        id: 'chat-conversation',
        name: 'Chat Conversation',
        description: 'Full chat conversation view',
        registryName: 'chat-conversation',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <ChatConversation data={{ messages: demoMessages }} />,
            usageCode: `<ChatConversation
  data={{
    messages: [
      {
        id: "1",
        type: "text",
        content: "Hey! Check out this new feature we just shipped 🚀",
        author: "Sarah",
        avatarUrl: "https://i.pravatar.cc/150?u=sarah",
        avatarFallback: "S",
        time: "10:30 AM",
        isOwn: false
      },
      {
        id: "2",
        type: "text",
        content: "Oh wow, that looks amazing! How long did it take to build?",
        author: "You",
        avatarFallback: "Y",
        time: "10:31 AM",
        isOwn: true,
        status: "read"
      },
      {
        id: "3",
        type: "image",
        content: "Here's a preview of the dashboard",
        image: "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=400&h=300&fit=crop",
        author: "Sarah",
        avatarUrl: "https://i.pravatar.cc/150?u=sarah",
        avatarFallback: "S",
        time: "10:32 AM",
        isOwn: false
      },
      {
        id: "4",
        type: "text",
        content: "This is incredible! The UI is so clean 👏",
        author: "You",
        avatarFallback: "Y",
        time: "10:33 AM",
        isOwn: true,
        status: "read"
      }
    ]
  }}
/>`,
          },
        ],
      },
    ],
  },
  {
    id: 'miscellaneous',
    name: 'Miscellaneous',
    blocks: [
      {
        id: 'stat-card',
        name: 'Stat Card',
        description: 'Display statistics and metrics',
        registryName: 'stat-card',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <StatCard data={{ stats: demoStats }} />,
            usageCode: `<StatCard
  data={{
    stats: [
      { label: "Sales", value: "$12,543", change: 12.5, trend: "up" },
      { label: "Orders", value: "342", change: -3.2, trend: "down" }
    ]
  }}
/>`,
          },
        ],
      },
      {
        id: 'hero',
        name: 'Hero',
        description: 'Landing hero section with logos, title, and CTA buttons',
        registryName: 'hero',
        layouts: ['inline', 'fullscreen'],
        actionCount: 2,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: (
              <Hero
                data={{
                  ...demoHeroDefault,
                  secondaryButton: { label: 'GitHub', icon: <Github className="h-5 w-5" /> },
                }}
              />
            ),
            usageCode: `<Hero
  data={{
    logo1: { text: "Acme", alt: "Acme" },
    title: "Build beautiful chat experiences with Manifest UI",
    subtitle: "Create beautiful chat experiences with our comprehensive component library designed for agentic applications.",
    primaryButton: { label: "Get Started" },
    secondaryButton: { label: "GitHub", icon: <Github className="h-5 w-5" /> }
  }}
  actions={{
    onPrimaryClick: () => console.log("Primary clicked"),
    onSecondaryClick: () => console.log("Secondary clicked")
  }}
/>`,
          },
          {
            id: 'two-logos',
            name: 'Two Logos',
            component: (
              <Hero
                data={{
                  ...demoHeroTwoLogos,
                  secondaryButton: { label: 'GitHub', icon: <Github className="h-5 w-5" /> },
                }}
              />
            ),
            usageCode: `<Hero
  data={{
    logo1: { text: "Acme" },
    logo2: { url: "/logo-manifest-ui.svg", urlLight: "/logo-manifest-ui-light.svg", alt: "Manifest" },
    logoSeparator: "x",
    title: "Acme x Manifest UI",
    subtitle: "Combining the best of both worlds to deliver exceptional user experiences.",
    primaryButton: { label: "Get Started" },
    secondaryButton: { label: "GitHub", icon: <Github className="h-5 w-5" /> }
  }}
  actions={{
    onPrimaryClick: () => console.log("Primary clicked"),
    onSecondaryClick: () => console.log("Secondary clicked")
  }}
/>`,
          },
          {
            id: 'with-tech-logos',
            name: 'With Tech Logos',
            component: (
              <Hero
                data={{
                  ...demoHeroWithTechLogos,
                  secondaryButton: { label: 'GitHub', icon: <Github className="h-5 w-5" /> },
                }}
              />
            ),
            usageCode: `<Hero
  data={{
    logo1: { text: "Acme" },
    title: "Build your next project with Acme",
    subtitle: "Create beautiful experiences with our comprehensive platform designed for modern applications.",
    primaryButton: { label: "Get Started" },
    secondaryButton: { label: "GitHub", icon: <Github className="h-5 w-5" /> },
    techLogosLabel: "Built with open-source technologies",
    techLogos: [
      { url: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg", alt: "Next.js", name: "Next.js" },
      { url: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg", alt: "TypeScript", name: "TypeScript" },
      { url: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg", alt: "React", name: "React" },
      { url: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg", alt: "Tailwind CSS", name: "Tailwind CSS" },
      { url: "/demo/os-tech-mnfst.svg", alt: "Manifest", name: "Manifest" }
    ]
  }}
  actions={{
    onPrimaryClick: () => console.log("Primary clicked"),
    onSecondaryClick: () => console.log("Secondary clicked")
  }}
/>`,
          },
          {
            id: 'minimal',
            name: 'Minimal',
            component: <Hero data={demoHeroMinimal} />,
            usageCode: `<Hero
  data={{
    logo1: undefined,
    title: "Welcome to the Future",
    subtitle: "A simple, clean hero without logos or extra elements.",
    primaryButton: { label: "Get Started" },
    secondaryButton: undefined
  }}
  actions={{
    onPrimaryClick: () => console.log("Primary clicked")
  }}
/>`,
          },
        ],
      },
    ],
  },
  {
    id: 'selection',
    name: 'Selection',
    blocks: [
      {
        id: 'option-list',
        name: 'Option List',
        description: 'Tag-style option selector',
        registryName: 'option-list',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <OptionList data={{ options: demoOptions }} />,
            usageCode: `<OptionList
  data={{
    options: [
      { id: "1", label: "Standard shipping", description: "3-5 business days" },
      { id: "2", label: "Express shipping", description: "1-2 business days" }
    ]
  }}
  appearance={{ multiple: false }}
  actions={{
    onSubmit: (selected) => console.log("Submitted:", selected)
  }}
/>`,
          },
        ],
      },
      {
        id: 'quick-reply',
        name: 'Quick Reply',
        description: 'Quick reply buttons for chat',
        registryName: 'quick-reply',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <QuickReply data={{ replies: demoQuickReplies }} />,
            usageCode: `<QuickReply
  data={{
    replies: [
      { id: "1", label: "Yes, confirm" },
      { id: "2", label: "No thanks" }
    ]
  }}
  actions={{
    onSelectReply: (reply) => console.log("Selected:", reply.label)
  }}
/>`,
          },
        ],
      },
      {
        id: 'tag-select',
        name: 'Tag Select',
        description: 'Colored tag selector',
        registryName: 'tag-select',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <TagSelect data={{ tags: demoTags }} />,
            usageCode: `<TagSelect
  data={{
    tags: [
      { id: "1", label: "Electronics" },
      { id: "2", label: "Audio" }
    ]
  }}
  appearance={{
    mode: "multiple",
    showClear: true,
    showValidate: true
  }}
  actions={{
    onValidate: (tagIds) => console.log("Validated:", tagIds)
  }}
/>`,
          },
        ],
      },
    ],
  },
  {
    id: 'status',
    name: 'Status & Progress',
    blocks: [
      {
        id: 'progress-steps',
        name: 'Progress Steps',
        description: 'Step-by-step progress indicator',
        registryName: 'progress-steps',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <ProgressSteps data={{ steps: demoProgressSteps }} />,
            usageCode: `<ProgressSteps
  data={{
    steps: [
      { label: "Order received", status: "completed" },
      { label: "Processing", status: "completed" },
      { label: "Shipping", status: "current" },
      { label: "Delivery", status: "pending" }
    ]
  }}
/>`,
          },
        ],
      },
      {
        id: 'status-badge',
        name: 'Status Badge',
        description: 'Various status indicators',
        registryName: 'status-badge',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'All Statuses',
            component: (
              <div className="flex flex-wrap gap-2 bg-white dark:bg-zinc-900 p-4 rounded-md">
                <StatusBadge data={{ status: 'success' }} />
                <StatusBadge data={{ status: 'pending' }} />
                <StatusBadge data={{ status: 'processing' }} />
                <StatusBadge data={{ status: 'shipped' }} />
                <StatusBadge data={{ status: 'delivered' }} />
                <StatusBadge data={{ status: 'error' }} />
              </div>
            ),
            usageCode: `<StatusBadge data={{ status: "success" }} />
<StatusBadge data={{ status: "pending" }} />
<StatusBadge data={{ status: "processing" }} />
<StatusBadge data={{ status: "error" }} />`,
          },
        ],
      },
    ],
  },
  {
    id: 'payment',
    name: 'Payment',
    blocks: [
      {
        id: 'order-confirm',
        name: 'Order Confirmation',
        description: 'Display order summary before payment',
        registryName: 'order-confirm',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <OrderConfirm data={demoOrderConfirm} />,
            fullscreenComponent: (
              <div className="max-w-[680px] mx-auto">
                <OrderConfirm data={demoOrderConfirm} />
              </div>
            ),
            usageCode: `<OrderConfirm
  data={{
    productName: "MacBook Pro 14-inch",
    productVariant: "Space Gray, M3 Pro",
    quantity: 1,
    price: 1999,
    deliveryDate: "Wed. Jan 15"
  }}
  appearance={{ currency: "USD" }}
  actions={{ onConfirm: () => console.log("Order confirmed!") }}
/>`,
          },
        ],
      },
      {
        id: 'amount-input',
        name: 'Amount Input',
        description: 'Input for monetary amounts',
        registryName: 'amount-input',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <AmountInput />,
            fullscreenComponent: (
              <div className="max-w-[680px] mx-auto">
                <AmountInput />
              </div>
            ),
            usageCode: `<AmountInput
  data={{ presets: [20, 50, 100, 200] }}
  appearance={{
    min: 10,
    max: 1000,
    step: 10,
    currency: "USD"
  }}
  control={{ value: 50 }}
  actions={{
    onConfirm: (value) => console.log("Confirmed:", value)
  }}
/>`,
          },
        ],
      },
      {
        id: 'payment-confirmed',
        name: 'Payment Confirmed',
        description: 'Payment confirmation with product details and tracking',
        registryName: 'payment-confirmed',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 1,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <PaymentConfirmed data={demoPaymentConfirmed} />,
            fullscreenComponent: (
              <div className="max-w-[680px] mx-auto">
                <PaymentConfirmed data={demoPaymentConfirmed} />
              </div>
            ),
            usageCode: `<PaymentConfirmed
  data={{
    orderId: "ORD-2024-7842",
    productName: "Air Force 1 '07",
    productDescription: "Nike - Size 42 - White",
    productImage: "https://ui.manifest.build/demo/shoe-1.png",
    price: 119,
    deliveryDate: "Tue. Dec 10"
  }}
  appearance={{ variant: "default", currency: "EUR" }}
  actions={{ onTrackOrder: () => console.log("Track order") }}
/>`,
          },
          {
            id: 'compressed',
            name: 'Compressed',
            component: <PaymentConfirmed data={demoPaymentConfirmed} appearance={{ variant: 'compressed' }} />,
            fullscreenComponent: (
              <div className="max-w-[680px] mx-auto">
                <PaymentConfirmed data={demoPaymentConfirmed} appearance={{ variant: 'compressed' }} />
              </div>
            ),
            usageCode: `<PaymentConfirmed
  data={{
    orderId: "ORD-2024-7842",
    productName: "Air Force 1 '07",
    productImage: "https://ui.manifest.build/demo/shoe-1.png",
    price: 119,
    deliveryDate: "Tue. Dec 10"
  }}
  appearance={{ variant: "compressed", currency: "EUR" }}
  actions={{ onTrackOrder: () => console.log("Track order") }}
/>`,
          },
        ],
      },
    ],
  },
  {
    id: 'social',
    name: 'Social',
    blocks: [
      {
        id: 'instagram-post',
        name: 'Instagram Post',
        description: 'Instagram post card',
        registryName: 'instagram-post',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <InstagramPost data={demoInstagramPost} />,
            usageCode: `<InstagramPost
  data={{
    author: "manifest.ai",
    avatar: "M",
    image: "https://images.unsplash.com/...",
    likes: "2,847",
    caption: "Building the future of agentic UIs.",
    time: "2 hours ago",
    verified: true
  }}
/>`,
          },
        ],
      },
      {
        id: 'linkedin-post',
        name: 'LinkedIn Post',
        description: 'LinkedIn post card with image support, engagement stats, and expandable content',
        registryName: 'linkedin-post',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: (
              <LinkedInPost
                data={{
                  author: 'Manifest',
                  headline: 'Manifest UI | 10K+ Developers',
                  avatar: 'M',
                  content: 'Excited to announce our latest milestone!\n\nWe\'ve just crossed 10,000 developers using Manifest to build agentic UIs.',
                  time: '2h',
                  reactions: '1,234',
                  topReactions: ['like', 'celebrate', 'love'],
                  comments: '56',
                  reposts: '12',
                  postUrl: 'https://linkedin.com/posts/manifest-123',
                  repostUrl: 'https://linkedin.com/shareArticle?url=...',
                }}
              />
            ),
            usageCode: `<LinkedInPost
  data={{
    author: "Manifest",
    headline: "Manifest UI | 10K+ Developers",
    avatar: "M",
    content: "Excited to announce our latest milestone!\\n\\nWe've just crossed 10,000 developers using Manifest to build agentic UIs.",
    time: "2h",
    reactions: "1,234",
    topReactions: ["like", "celebrate", "love"],
    comments: "56",
    reposts: "12",
    postUrl: "https://linkedin.com/posts/manifest-123",
    repostUrl: "https://linkedin.com/shareArticle?url=..."
  }}
/>`,
          },
          {
            id: 'with-media',
            name: 'With Media',
            component: (
              <LinkedInPost
                data={{
                  author: 'Manifest',
                  headline: 'Manifest UI | 10K+ Developers',
                  avatar: 'M',
                  content: 'Excited to announce our latest milestone!\n\nWe\'ve just crossed 10,000 developers using Manifest to build agentic UIs.',
                  time: '2h',
                  image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
                  reactions: '2,847',
                  topReactions: ['like', 'celebrate', 'insightful'],
                  comments: '124',
                  reposts: '89',
                  postUrl: 'https://linkedin.com/posts/manifest-123',
                  repostUrl: 'https://linkedin.com/shareArticle?url=...',
                }}
              />
            ),
            usageCode: `<LinkedInPost
  data={{
    author: "Manifest",
    headline: "Manifest UI | 10K+ Developers",
    avatar: "M",
    content: "Excited to announce our latest milestone!\\n\\nWe've just crossed 10,000 developers using Manifest to build agentic UIs.",
    time: "2h",
    image: "https://example.com/announcement.jpg",
    reactions: "2,847",
    topReactions: ["like", "celebrate", "insightful"],
    comments: "124",
    reposts: "89",
    postUrl: "https://linkedin.com/posts/manifest-123",
    repostUrl: "https://linkedin.com/shareArticle?url=..."
  }}
/>`,
          },
          {
            id: 'truncated',
            name: 'Truncated Content',
            component: (
              <LinkedInPost
                data={{
                  author: 'Manifest',
                  headline: 'Manifest UI | 10K+ Developers',
                  avatar: 'M',
                  content: 'Excited to announce our latest milestone!\n\nWe\'ve just crossed 10,000 developers using Manifest to build agentic UIs. Thank you to everyone who believed in our vision.\n\nWhat\'s next? We\'re working on something big. Stay tuned!\n\n#AI #AgenticUI #Developer #Startup',
                  time: '2h',
                  reactions: '15K',
                  topReactions: ['like', 'insightful', 'celebrate'],
                  comments: '890',
                  reposts: '2.1K',
                  postUrl: 'https://linkedin.com/posts/manifest-123',
                  repostUrl: 'https://linkedin.com/shareArticle?url=...',
                }}
                appearance={{
                  maxLines: 3,
                }}
              />
            ),
            usageCode: `<LinkedInPost
  data={{
    author: "Manifest",
    headline: "Manifest UI | 10K+ Developers",
    avatar: "M",
    content: "Excited to announce our latest milestone!\\n\\nWe've just crossed 10,000 developers using Manifest to build agentic UIs. Thank you to everyone who believed in our vision.\\n\\nWhat's next? We're working on something big. Stay tuned!\\n\\n#AI #AgenticUI #Developer #Startup",
    time: "2h",
    reactions: "15K",
    topReactions: ["like", "insightful", "celebrate"],
    comments: "890",
    reposts: "2.1K",
    postUrl: "https://linkedin.com/posts/manifest-123",
    repostUrl: "https://linkedin.com/shareArticle?url=..."
  }}
  appearance={{
    maxLines: 3
  }}
/>`,
          },
        ],
      },
      {
        id: 'x-post',
        name: 'X Post',
        description: 'X (Twitter) post card',
        registryName: 'x-post',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <XPost data={demoXPost} />,
            usageCode: `<XPost
  data={{
    author: "Manifest",
    username: "manifest",
    avatar: "M",
    content: "Just shipped a new feature!",
    time: "2h",
    likes: "1.2K",
    retweets: "234",
    replies: "56",
    views: "45.2K",
    verified: true
  }}
/>`,
          },
        ],
      },
      {
        id: 'youtube-post',
        name: 'YouTube Post',
        description: 'YouTube video card',
        registryName: 'youtube-post',
        layouts: ['inline', 'fullscreen', 'pip'],
        actionCount: 0,
        variants: [
          {
            id: 'default',
            name: 'Default',
            component: <YouTubePost data={demoYouTubePost} />,
            usageCode: `<YouTubePost
  data={{
    channel: "NetworkChuck",
    avatar: "N",
    title: "you need to learn MCP RIGHT NOW!!",
    views: "1M views",
    time: "2 weeks ago",
    duration: "18:42",
    thumbnail: "https://img.youtube.com/vi/GuTcle5edjk/maxresdefault.jpg",
    verified: true,
    videoId: "GuTcle5edjk"
  }}
/>`,
          },
        ],
      },
    ],
  },
];

function BlockPageContent() {
  const params = useParams();
  const categorySlug = params.category as string;
  const blockSlug = params.block as string;

  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    blockCategories.map((c) => c.id)
  );

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  // Find the selected block (from hardcoded categories for content/variants)
  const selectedCategory = categories.find((c) => c.id === categorySlug);
  const selectedBlock = selectedCategory?.blocks.find((b) => b.id === blockSlug);

  // Find the category from blockCategories for sidebar and related blocks
  const sidebarCategory = blockCategories.find((c) => c.id === categorySlug);
  const depCount = useExternalDepCount(selectedBlock?.registryName ?? '');

  // Ref for the first variant section
  const firstVariantRef = useRef<VariantSectionHandle>(null);

  // Handle anchor scrolling on mount
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout | undefined;
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      const element = document.getElementById(id);
      if (element) {
        scrollTimeout = setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
    return () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, []);

  if (!selectedBlock) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] bg-card items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Block not found</h1>
          <p className="text-muted-foreground mb-4">The requested block does not exist.</p>
          <Link href="/blocks" className="text-primary hover:underline">
            Go back to blocks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] bg-card">
      {/* Sidebar */}
      <aside className="hidden md:block w-[226px] shrink-0 p-6 overflow-y-auto">
        <nav className="space-y-1">
          <Link
            href="/blocks"
            className="block text-xs font-medium rounded-sm transition-colors py-1 px-2 mb-2 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            Getting Started
          </Link>
          {blockCategories.map((category) => (
            <div key={category.id}>
              <button
                onClick={() => toggleCategory(category.id)}
                className="flex w-full items-center justify-between py-1 px-2 text-xs font-medium text-foreground hover:bg-muted rounded-sm transition-colors"
              >
                {category.name}
                <ChevronRight
                  className={cn(
                    'h-3 w-3 transition-transform',
                    expandedCategories.includes(category.id) && 'rotate-90'
                  )}
                />
              </button>
              {expandedCategories.includes(category.id) && (
                <div className="mt-0.5 space-y-0 mb-4">
                  {category.blocks.map((block) => (
                    <Link
                      key={block.id}
                      href={`/blocks/${category.id}/${block.id}`}
                      className={cn(
                        'block my-1 text-xs rounded-sm transition-colors py-1 px-2',
                        categorySlug === category.id && blockSlug === block.id
                          ? 'bg-muted text-foreground font-medium'
                          : 'text-foreground/70 hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      {block.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="w-full md:w-[calc(100vw-226px)] p-4 md:p-8 bg-muted/50">
        <div className="max-w-3xl mx-auto space-y-12">
          {/* Block Header with Breadcrumb */}
          <div id={selectedBlock.id} className="scroll-mt-20">
            {/* Breadcrumb Navigation */}
            <Breadcrumb
              items={[
                { name: 'Blocks', href: '/blocks' },
                { name: sidebarCategory?.name || categorySlug },
                { name: selectedBlock.name },
              ]}
            />

            {/* Block Title */}
            <div className="group flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">{selectedBlock.name}</h1>
              {selectedBlock.actionCount > 0 ? (
                <button
                  onClick={() => firstVariantRef.current?.showActionsConfig()}
                  className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 inline-flex items-center gap-1 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  <Zap className="w-3 h-3" />
                  {`${selectedBlock.actionCount} action${selectedBlock.actionCount > 1 ? 's' : ''}`}
                </button>
              ) : (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 inline-flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  read only
                </span>
              )}
              {depCount !== null && depCount > 0 && (
                <button
                  onClick={() => firstVariantRef.current?.showDepsTab()}
                  className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 inline-flex items-center gap-1 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  <Package className="w-3 h-3" />
                  {`${depCount} dep${depCount > 1 ? 's' : ''}`}
                </button>
              )}
            </div>
            <p className="text-muted-foreground">{selectedBlock.description}</p>
          </div>

          {/* All Variants */}
          {selectedBlock.variants.map((variant, index) => (
            <div key={variant.id} id={variant.id} className="scroll-mt-20">
              <VariantSection
                ref={index === 0 ? firstVariantRef : undefined}
                name={variant.name}
                component={variant.component}
                pipComponent={variant.pipComponent}
                fullscreenComponent={variant.fullscreenComponent}
                registryName={selectedBlock.registryName}
                usageCode={variant.usageCode}
                layouts={selectedBlock.layouts}
                variantId={variant.id}
              />
            </div>
          ))}

          {/* Related Blocks in Same Category */}
          {sidebarCategory &&
            sidebarCategory.blocks.filter((b) => b.id !== blockSlug).length > 0 && (
              <div className="mt-16 pt-8 border-t border-border/50">
                <h2 className="text-base font-medium text-muted-foreground mb-4">
                  Other blocks in the {sidebarCategory.name} category
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {sidebarCategory.blocks
                    .filter((b) => b.id !== blockSlug)
                    .map((block) => (
                      <Link
                        key={block.id}
                        href={`/blocks/${sidebarCategory.id}/${block.id}`}
                        className="px-3 py-2 text-sm rounded-md border border-border/50 bg-background/50 hover:bg-muted hover:border-border transition-colors text-muted-foreground hover:text-foreground"
                      >
                        {block.name}
                      </Link>
                    ))}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default function BlockPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[calc(100vh-3.5rem)] bg-card" />}>
      <BlockPageContent />
    </Suspense>
  );
}
