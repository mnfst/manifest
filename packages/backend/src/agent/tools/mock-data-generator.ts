import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { MockData, TableMockData, PostListMockData } from '@chatgpt-app-builder/shared';
import {
  DEFAULT_TABLE_MOCK_DATA,
  DEFAULT_POST_LIST_MOCK_DATA,
} from '@chatgpt-app-builder/shared';

/**
 * Schema for mock data generation input
 */
const mockDataGeneratorSchema = z.object({
  prompt: z.string().describe('The user prompt describing their desired app'),
  layoutTemplate: z.enum(['table', 'post-list']).describe('The selected layout template'),
});

/**
 * Context-specific mock data generators
 */
const TABLE_MOCK_DATA_TEMPLATES: Record<string, TableMockData> = {
  products: {
    type: 'table',
    columns: [
      { key: 'id', header: 'SKU', type: 'text' },
      { key: 'name', header: 'Product Name', type: 'text' },
      { key: 'price', header: 'Price', type: 'number' },
      { key: 'status', header: 'Status', type: 'badge' },
    ],
    rows: [
      { id: 'PRD-001', name: 'Wireless Headphones', price: 79.99, status: 'In Stock' },
      { id: 'PRD-002', name: 'Smart Watch Pro', price: 299.99, status: 'Low Stock' },
      { id: 'PRD-003', name: 'USB-C Hub', price: 49.99, status: 'In Stock' },
      { id: 'PRD-004', name: 'Mechanical Keyboard', price: 149.99, status: 'Out of Stock' },
    ],
  },
  orders: {
    type: 'table',
    columns: [
      { key: 'orderId', header: 'Order ID', type: 'text' },
      { key: 'customer', header: 'Customer', type: 'text' },
      { key: 'total', header: 'Total', type: 'number' },
      { key: 'status', header: 'Status', type: 'badge' },
      { key: 'date', header: 'Date', type: 'date' },
    ],
    rows: [
      { orderId: 'ORD-1001', customer: 'John Doe', total: 149.99, status: 'Delivered', date: '2025-01-15' },
      { orderId: 'ORD-1002', customer: 'Jane Smith', total: 89.50, status: 'Shipped', date: '2025-01-18' },
      { orderId: 'ORD-1003', customer: 'Bob Wilson', total: 299.99, status: 'Processing', date: '2025-01-20' },
    ],
  },
  support: {
    type: 'table',
    columns: [
      { key: 'ticketId', header: 'Ticket', type: 'text' },
      { key: 'subject', header: 'Subject', type: 'text' },
      { key: 'priority', header: 'Priority', type: 'badge' },
      { key: 'status', header: 'Status', type: 'badge' },
    ],
    rows: [
      { ticketId: 'TKT-001', subject: 'Login issues', priority: 'High', status: 'Open' },
      { ticketId: 'TKT-002', subject: 'Payment failed', priority: 'Critical', status: 'In Progress' },
      { ticketId: 'TKT-003', subject: 'Feature request', priority: 'Low', status: 'Pending' },
    ],
  },
};

const POST_LIST_MOCK_DATA_TEMPLATES: Record<string, PostListMockData> = {
  blog: {
    type: 'post-list',
    posts: [
      {
        id: 'post-1',
        title: '10 Tips for Better Productivity',
        excerpt: 'Discover simple strategies to boost your daily productivity and achieve more.',
        author: 'Sarah Johnson',
        date: '2025-01-20',
        category: 'Productivity',
        tags: ['tips', 'productivity', 'work'],
      },
      {
        id: 'post-2',
        title: 'Getting Started with AI Tools',
        excerpt: 'A beginner\'s guide to leveraging AI tools in your daily workflow.',
        author: 'Mike Chen',
        date: '2025-01-18',
        category: 'Technology',
        tags: ['AI', 'tools', 'beginner'],
      },
      {
        id: 'post-3',
        title: 'The Future of Remote Work',
        excerpt: 'How companies are adapting to the new normal of distributed teams.',
        author: 'Emily Brown',
        date: '2025-01-15',
        category: 'Business',
        tags: ['remote', 'work', 'trends'],
      },
    ],
  },
  news: {
    type: 'post-list',
    posts: [
      {
        id: 'news-1',
        title: 'New Product Launch Announcement',
        excerpt: 'We\'re excited to announce our latest product that will transform how you work.',
        author: 'PR Team',
        date: '2025-01-22',
        category: 'Announcements',
      },
      {
        id: 'news-2',
        title: 'Company Milestone: 1 Million Users',
        excerpt: 'Thank you to our amazing community for helping us reach this incredible milestone.',
        author: 'CEO',
        date: '2025-01-20',
        category: 'Company News',
      },
    ],
  },
  updates: {
    type: 'post-list',
    posts: [
      {
        id: 'update-1',
        title: 'Version 2.0 Release Notes',
        excerpt: 'Check out all the new features and improvements in our latest release.',
        author: 'Dev Team',
        date: '2025-01-21',
        category: 'Release Notes',
      },
      {
        id: 'update-2',
        title: 'Scheduled Maintenance Notice',
        excerpt: 'Our systems will undergo maintenance on January 25th from 2-4 AM UTC.',
        author: 'Operations',
        date: '2025-01-19',
        category: 'Maintenance',
      },
    ],
  },
};

/**
 * Tool for generating context-appropriate mock data based on user prompt
 * Creates sample data that matches the layout template and app context
 */
export const mockDataGeneratorTool = new DynamicStructuredTool({
  name: 'generate_mock_data',
  description: `Generate sample mock data for a ChatGPT app based on the user's description.
The mock data should match the selected layout template and reflect the context of the app.
Returns structured data that can be displayed in the visual editor.`,
  schema: mockDataGeneratorSchema,
  func: async ({ prompt, layoutTemplate }): Promise<string> => {
    const promptLower = prompt.toLowerCase();

    let mockData: MockData;

    if (layoutTemplate === 'table') {
      // Determine the best table template based on context
      if (promptLower.match(/product|catalog|inventory|shop|store/)) {
        mockData = TABLE_MOCK_DATA_TEMPLATES.products;
      } else if (promptLower.match(/order|purchase|transaction|checkout/)) {
        mockData = TABLE_MOCK_DATA_TEMPLATES.orders;
      } else if (promptLower.match(/support|ticket|help|service|customer/)) {
        mockData = TABLE_MOCK_DATA_TEMPLATES.support;
      } else {
        mockData = DEFAULT_TABLE_MOCK_DATA;
      }
    } else {
      // Determine the best post-list template based on context
      if (promptLower.match(/blog|article|post|write/)) {
        mockData = POST_LIST_MOCK_DATA_TEMPLATES.blog;
      } else if (promptLower.match(/news|announce|press/)) {
        mockData = POST_LIST_MOCK_DATA_TEMPLATES.news;
      } else if (promptLower.match(/update|release|changelog|version/)) {
        mockData = POST_LIST_MOCK_DATA_TEMPLATES.updates;
      } else {
        mockData = DEFAULT_POST_LIST_MOCK_DATA;
      }
    }

    return JSON.stringify({
      mockData,
      context: layoutTemplate === 'table' ? 'tabular' : 'content',
    });
  },
});
