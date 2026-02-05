'use client';

/**
 * Component map for preview generation.
 * Maps component names to their rendered React elements with demo data
 * imported from centralized demo/<category>.ts files.
 */

import { ReactNode } from 'react';

// Form components
import { ContactForm } from '@/registry/form/contact-form';
import { DateTimePicker } from '@/registry/form/date-time-picker';
import { IssueReportForm } from '@/registry/form/issue-report-form';
// Payment components
import { AmountInput } from '@/registry/payment/amount-input';
import { OrderConfirm } from '@/registry/payment/order-confirm';
import { PaymentConfirmed } from '@/registry/payment/payment-confirmed';
import {
  demoOrderConfirm,
  demoPaymentConfirmed,
} from '@/registry/payment/demo/payment';

// List components
import { ProductList } from '@/registry/list/product-list';
import { Table } from '@/registry/list/table';
import {
  demoProducts,
  demoTableColumns,
  demoTableRows,
} from '@/registry/list/demo/list';

// Selection components
import { OptionList } from '@/registry/selection/option-list';
import { QuickReply } from '@/registry/selection/quick-reply';
import { TagSelect } from '@/registry/selection/tag-select';
import {
  demoOptions,
  demoQuickReplies,
  demoTags,
} from '@/registry/selection/demo/selection';

// Status components
import { ProgressSteps } from '@/registry/status/progress-steps';
import { StatusBadge } from '@/registry/status/status-badge';
import {
  demoProgressSteps,
  demoStatusBadge,
} from '@/registry/status/demo/status';

// Miscellaneous components
import { Hero } from '@/registry/miscellaneous/hero';
import { StatCard } from '@/registry/miscellaneous/stat-card';
import {
  demoStats,
  demoHeroDefault,
} from '@/registry/miscellaneous/demo/miscellaneous';

// Social components
import { InstagramPost } from '@/registry/social/instagram-post';
import { LinkedInPost } from '@/registry/social/linkedin-post';
import { XPost } from '@/registry/social/x-post';
import { YouTubePost } from '@/registry/social/youtube-post';
import {
  demoXPost,
  demoInstagramPost,
  demoLinkedInPost,
  demoYouTubePost,
} from '@/registry/social/demo/social';

// Map components
import { MapCarousel } from '@/registry/map/map-carousel';
import {
  demoMapLocations,
  demoMapCenter,
  demoMapZoom,
} from '@/registry/map/demo/map';

// Blogging components
import { PostCard } from '@/registry/blogging/post-card';
import { PostDetail } from '@/registry/blogging/post-detail';
import { PostList } from '@/registry/blogging/post-list';
import {
  demoPost,
  demoPosts,
  demoPostDetailData,
} from '@/registry/blogging/demo/blogging';

// Messaging components
import { ChatConversation } from '@/registry/messaging/chat-conversation';
import { MessageBubble } from '@/registry/messaging/message-bubble';
import { demoMessages } from '@/registry/messaging/demo/messaging';

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

export interface PreviewComponentConfig {
  component: ReactNode;
  category: string;
}

/**
 * Map of component names to their preview configurations.
 * Each entry contains the rendered component and its category for background styling.
 */
export const previewComponents: Record<string, PreviewComponentConfig> = {
  // Form components
  'contact-form': {
    component: <ContactForm />,
    category: 'form',
  },
  'date-time-picker': {
    component: <DateTimePicker />,
    category: 'form',
  },
  'issue-report-form': {
    component: <IssueReportForm />,
    category: 'form',
  },

  // Payment components
  'order-confirm': {
    component: <OrderConfirm data={demoOrderConfirm} />,
    category: 'payment',
  },
  'payment-confirmed': {
    component: <PaymentConfirmed data={demoPaymentConfirmed} />,
    category: 'payment',
  },
  'amount-input': {
    component: <AmountInput />,
    category: 'payment',
  },

  // List components
  'product-list': {
    component: <ProductList data={{ products: demoProducts }} appearance={{ variant: 'grid' }} />,
    category: 'list',
  },
  'table': {
    component: (
      <Table data={{ columns: demoTableColumns, rows: demoTableRows }} />
    ),
    category: 'list',
  },

  // Selection components
  'option-list': {
    component: <OptionList data={{ options: demoOptions }} />,
    category: 'selection',
  },
  'tag-select': {
    component: <TagSelect data={{ tags: demoTags }} />,
    category: 'selection',
  },
  'quick-reply': {
    component: <QuickReply data={{ replies: demoQuickReplies }} />,
    category: 'selection',
  },

  // Status components
  'progress-steps': {
    component: <ProgressSteps data={{ steps: demoProgressSteps }} />,
    category: 'status',
  },
  'status-badge': {
    component: (
      <StatusBadge
        data={{ status: demoStatusBadge.status }}
        appearance={{ label: demoStatusBadge.label }}
      />
    ),
    category: 'status',
  },

  // Miscellaneous components
  'stat-card': {
    component: <StatCard data={{ stats: demoStats }} />,
    category: 'miscellaneous',
  },
  'hero': {
    component: <Hero data={demoHeroDefault} />,
    category: 'miscellaneous',
  },

  // Social components
  'x-post': {
    component: <XPost data={demoXPost} />,
    category: 'social',
  },
  'instagram-post': {
    component: <InstagramPost data={demoInstagramPost} />,
    category: 'social',
  },
  'linkedin-post': {
    component: <LinkedInPost data={demoLinkedInPost} />,
    category: 'social',
  },
  'youtube-post': {
    component: <YouTubePost data={demoYouTubePost} />,
    category: 'social',
  },

  // Map components
  'map-carousel': {
    component: (
      <MapCarousel data={{ locations: demoMapLocations, center: demoMapCenter, zoom: demoMapZoom }} />
    ),
    category: 'map',
  },

  // Blogging components
  'post-card': {
    component: <PostCard data={{ post: demoPost }} />,
    category: 'blogging',
  },
  'post-list': {
    component: <PostList data={{ posts: demoPosts.slice(0, 6) }} appearance={{ variant: 'grid' }} />,
    category: 'blogging',
  },
  'post-detail': {
    component: <PostDetail data={demoPostDetailData} />,
    category: 'blogging',
  },

  // Messaging components
  'message-bubble': {
    component: (
      <div className="space-y-4 w-full max-w-md">
        <MessageBubble
          data={{ content: 'Hey! How are you doing?', avatarFallback: 'J', time: '10:30 AM' }}
        />
        <MessageBubble
          data={{ content: "I'm doing great, thanks for asking!", time: '10:31 AM' }}
          appearance={{ isOwn: true }}
          control={{ status: 'read' }}
        />
      </div>
    ),
    category: 'messaging',
  },
  'chat-conversation': {
    component: <ChatConversation data={{ messages: demoMessages }} />,
    category: 'messaging',
  },

  // Events components
  'event-card': {
    component: <EventCard data={{ event: demoEvent }} />,
    category: 'events',
  },
  'event-list': {
    component: (
      <EventList data={{ events: demoEvents }} appearance={{ variant: 'grid' }} />
    ),
    category: 'events',
  },
  'event-detail': {
    component: <EventDetail data={{ event: demoEventDetails }} />,
    category: 'events',
  },
  'ticket-tier-select': {
    component: (
      <TicketTierSelect
        data={{
          event: { title: 'Summer Music Festival', date: 'Jan 20, 2024' },
          tiers: demoTicketTiers,
        }}
      />
    ),
    category: 'events',
  },
  'event-confirmation': {
    component: <EventConfirmation data={demoEventConfirmation} />,
    category: 'events',
  },
};

/**
 * Get the list of all available component names for preview generation.
 */
export function getPreviewComponentNames(): string[] {
  return Object.keys(previewComponents);
}
