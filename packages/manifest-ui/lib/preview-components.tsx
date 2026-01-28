'use client';

/**
 * Component map for preview generation.
 * Maps component names to their rendered React elements with default demo data.
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

// List components
import { ProductList } from '@/registry/list/product-list';
import { Table } from '@/registry/list/table';

// Selection components
import { OptionList } from '@/registry/selection/option-list';
import { QuickReply } from '@/registry/selection/quick-reply';
import { TagSelect } from '@/registry/selection/tag-select';

// Status components
import { ProgressSteps } from '@/registry/status/progress-steps';
import { StatusBadge } from '@/registry/status/status-badge';

// Miscellaneous components
import { Hero } from '@/registry/miscellaneous/hero';
import { Stats } from '@/registry/miscellaneous/stat-card';

// Social components
import { InstagramPost } from '@/registry/social/instagram-post';
import { LinkedInPost } from '@/registry/social/linkedin-post';
import { XPost } from '@/registry/social/x-post';
import { YouTubePost } from '@/registry/social/youtube-post';

// Map components
import { MapCarousel } from '@/registry/map/map-carousel';

// Blogging components
import { PostCard } from '@/registry/blogging/post-card';
import { PostDetail } from '@/registry/blogging/post-detail';
import { PostList } from '@/registry/blogging/post-list';
import {
  demoPost,
  demoPosts,
  demoPostDetailData,
} from '@/registry/blogging/demo/data';

// Messaging components
import { ChatConversation } from '@/registry/messaging/chat-conversation';
import { MessageBubble } from '@/registry/messaging/message-bubble';

// Events components
import { EventCard } from '@/registry/events/event-card';
import { EventConfirmation } from '@/registry/events/event-confirmation';
import { EventDetail } from '@/registry/events/event-detail';
import { EventList } from '@/registry/events/event-list';
import { TicketTierSelect } from '@/registry/events/ticket-tier-select';

// Demo data
const demoProducts = [
  { name: 'Premium Headphones', price: 299, image: 'https://ui.manifest.build/demo/shoe-1.png' },
  { name: 'Wireless Earbuds', price: 149, image: 'https://ui.manifest.build/demo/shoe-2.png' },
  { name: 'Smart Speaker', price: 199, image: 'https://ui.manifest.build/demo/shoe-3.png' },
];

const demoTicketTiers = [
  { id: '1', name: 'General Admission', price: 45, fee: 5, available: 100, maxPerOrder: 10 },
  {
    id: '2',
    name: 'VIP',
    price: 150,
    fee: 15,
    available: 20,
    maxPerOrder: 4,
    description: 'Includes backstage access',
  },
];

const demoMapLocations = [
  {
    id: '1',
    name: 'Coffee Shop',
    coordinates: [40.7128, -74.006] as [number, number],
    description: 'Best coffee in town',
  },
  {
    id: '2',
    name: 'Book Store',
    coordinates: [40.7138, -74.008] as [number, number],
    description: 'Rare books collection',
  },
  {
    id: '3',
    name: 'Park',
    coordinates: [40.7148, -74.004] as [number, number],
    description: 'Beautiful city park',
  },
];

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
    component: (
      <OrderConfirm
        data={{
          productName: 'Premium Headphones',
          productImage: 'https://ui.manifest.build/demo/shoe-1.png',
          price: 299,
          deliveryDate: 'Jan 20, 2024',
        }}
      />
    ),
    category: 'payment',
  },
  'payment-confirmed': {
    component: (
      <PaymentConfirmed
        data={{
          productName: 'Premium Headphones',
          productImage: 'https://ui.manifest.build/demo/shoe-1.png',
          price: 299,
          deliveryDate: 'Jan 20, 2024',
        }}
      />
    ),
    category: 'payment',
  },
  'amount-input': {
    component: <AmountInput data={{ presets: [10, 25, 50, 100] }} />,
    category: 'payment',
  },

  // List components
  'product-list': {
    component: <ProductList data={{ products: demoProducts }} appearance={{ variant: 'grid' }} />,
    category: 'list',
  },
  'table': {
    component: (
      <Table
        data={{
          columns: [
            { header: 'Name', accessor: 'name' },
            { header: 'Email', accessor: 'email' },
            { header: 'Status', accessor: 'status' },
          ],
          rows: [
            { name: 'John Doe', email: 'john@example.com', status: 'Active' },
            { name: 'Jane Smith', email: 'jane@example.com', status: 'Pending' },
            { name: 'Bob Johnson', email: 'bob@example.com', status: 'Active' },
          ],
        }}
      />
    ),
    category: 'list',
  },

  // Selection components
  'option-list': {
    component: (
      <OptionList
        data={{ options: [{ label: 'Option A' }, { label: 'Option B' }, { label: 'Option C' }] }}
      />
    ),
    category: 'selection',
  },
  'tag-select': {
    component: (
      <TagSelect
        data={{
          tags: [
            { id: '1', label: 'Important', color: 'red' },
            { id: '2', label: 'In Progress', color: 'yellow' },
            { id: '3', label: 'Done', color: 'green' },
          ],
        }}
      />
    ),
    category: 'selection',
  },
  'quick-reply': {
    component: (
      <QuickReply
        data={{
          replies: [{ label: 'Yes, please' }, { label: 'No, thanks' }, { label: 'Tell me more' }],
        }}
      />
    ),
    category: 'selection',
  },

  // Status components
  'progress-steps': {
    component: (
      <ProgressSteps
        data={{
          steps: [
            { label: 'Cart', status: 'completed' },
            { label: 'Shipping', status: 'current' },
            { label: 'Payment', status: 'pending' },
            { label: 'Confirm', status: 'pending' },
          ],
        }}
      />
    ),
    category: 'status',
  },
  'status-badge': {
    component: <StatusBadge data={{ status: 'processing' }} appearance={{ label: 'Processing' }} />,
    category: 'status',
  },

  // Miscellaneous components
  'stats': {
    component: (
      <Stats
        data={{
          stats: [
            { label: 'Revenue', value: '$12,345', change: 12.5 },
            { label: 'Orders', value: '1,234', change: -3.2 },
            { label: 'Customers', value: '567', change: 8.1 },
          ],
        }}
      />
    ),
    category: 'miscellaneous',
  },
  'hero': {
    component: (
      <Hero
        data={{
          logo1: { text: 'Acme', alt: 'Acme' },
          title: 'Build beautiful chat experiences with Manifest UI',
          subtitle:
            'Create beautiful chat experiences with our comprehensive component library designed for agentic applications.',
          primaryButton: { label: 'Get Started' },
          secondaryButton: { label: 'GitHub' },
        }}
      />
    ),
    category: 'miscellaneous',
  },

  // Social components
  'x-post': {
    component: (
      <XPost
        data={{
          author: 'Elon Musk',
          username: 'elonmusk',
          avatar: 'https://i.pravatar.cc/150?u=elon',
          verified: true,
          content: 'The future of AI is here!',
          time: '2h',
          likes: '42K',
          retweets: '8.5K',
          replies: '3.2K',
        }}
      />
    ),
    category: 'social',
  },
  'instagram-post': {
    component: (
      <InstagramPost
        data={{
          author: 'National Geographic',
          avatar: 'https://i.pravatar.cc/150?u=natgeo',
          verified: true,
          image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
          caption: 'Nature at its finest',
          likes: '125K',
          time: '2h',
        }}
      />
    ),
    category: 'social',
  },
  'linkedin-post': {
    component: (
      <LinkedInPost
        data={{
          author: 'Satya Nadella',
          headline: 'CEO at Microsoft',
          avatar: 'https://i.pravatar.cc/150?u=satya',
          content: 'Excited to announce our latest AI innovations...',
          time: '1d',
          likes: '15K',
          comments: '890',
          reposts: '2.1K',
        }}
      />
    ),
    category: 'social',
  },
  'youtube-post': {
    component: (
      <YouTubePost
        data={{
          channel: 'TechTalks',
          avatar: 'https://i.pravatar.cc/150?u=techtalks',
          title: 'Building the Future of AI',
          views: '1.2M',
          time: '3 days ago',
          thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
          duration: '15:42',
        }}
      />
    ),
    category: 'social',
  },

  // Map components
  'map-carousel': {
    component: <MapCarousel data={{ locations: demoMapLocations, center: [40.7128, -74.006] }} />,
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
    component: (
      <ChatConversation
        data={{
          messages: [
            { content: 'Hello! How can I help you today?', isOwn: false, time: '10:00 AM' },
            { content: 'I need help with my order', isOwn: true, time: '10:01 AM' },
            {
              content: 'Of course! Could you please provide your order number?',
              isOwn: false,
              time: '10:01 AM',
            },
          ],
        }}
      />
    ),
    category: 'messaging',
  },

  // Events components
  'event-card': {
    component: (
      <EventCard
        data={{
          event: {
            title: 'Summer Music Festival',
            category: 'Music',
            venue: 'Central Park',
            city: 'New York',
            dateTime: new Date(Date.now() + 86400000 * 7).toISOString(),
            priceRange: '$45 - $150',
            image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800',
            vibeTags: ['High energy', 'Outdoor', 'Social'],
            eventSignal: 'popular',
          },
        }}
      />
    ),
    category: 'events',
  },
  'event-list': {
    component: (
      <EventList
        data={{
          events: [
            {
              title: 'Summer Music Festival',
              category: 'Music',
              venue: 'Central Park',
              city: 'New York',
              dateTime: new Date(Date.now() + 86400000 * 7).toISOString(),
              priceRange: '$45 - $150',
              image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800',
            },
            {
              title: 'Jazz Night',
              category: 'Music',
              venue: 'Blue Note',
              city: 'New York',
              dateTime: new Date(Date.now() + 86400000 * 14).toISOString(),
              priceRange: '$30 - $80',
            },
            {
              title: 'Comedy Show',
              category: 'Comedy',
              venue: 'Comedy Cellar',
              city: 'New York',
              dateTime: new Date(Date.now() + 86400000 * 3).toISOString(),
              priceRange: '$25 - $50',
            },
          ],
        }}
        appearance={{ variant: 'grid' }}
      />
    ),
    category: 'events',
  },
  'event-detail': {
    component: (
      <EventDetail
        data={{
          event: {
            title: 'Summer Music Festival',
            category: 'Music',
            venue: 'Central Park',
            city: 'New York',
            startDateTime: new Date(Date.now() + 86400000 * 7).toISOString(),
            priceRange: '$45 - $150',
            image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800',
            description: 'Join us for an amazing summer music festival!',
            organizer: {
              name: 'Live Events Co',
              image: 'https://i.pravatar.cc/150?u=live',
              rating: 4.8,
              reviewCount: 120,
              verified: true,
            },
          },
        }}
      />
    ),
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
    component: (
      <EventConfirmation
        data={{
          orderNumber: 'EVT-12345',
          eventTitle: 'Summer Music Festival',
          ticketCount: 2,
          recipientEmail: 'customer@example.com',
          eventDate: 'Jan 20, 2024',
          eventLocation: 'Central Park, New York',
        }}
      />
    ),
    category: 'events',
  },
};

/**
 * Get the list of all available component names for preview generation.
 */
export function getPreviewComponentNames(): string[] {
  return Object.keys(previewComponents);
}
