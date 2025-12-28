/**
 * Column definition for table layout
 */
export interface TableColumn {
  key: string;
  header: string;
  type: 'text' | 'number' | 'date' | 'badge' | 'action';
}

/**
 * Mock data structure for 'table' layout
 */
export interface TableMockData {
  type: 'table';
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
}

/**
 * Post item for post-list layout
 */
export interface PostItem {
  id: string;
  title: string;
  excerpt: string;
  author?: string;
  date?: string;
  image?: string;
  category?: string;
  tags?: string[];
}

/**
 * Mock data structure for 'post-list' layout
 */
export interface PostListMockData {
  type: 'post-list';
  posts: PostItem[];
}

/**
 * Union type for all mock data types
 */
export type MockData = TableMockData | PostListMockData;

/**
 * MockData entity DTO - represents a mock data record in the database
 */
export interface MockDataEntityDTO {
  id: string;
  viewId: string;
  data: MockData;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to update mock data
 */
export interface UpdateMockDataRequest {
  data: MockData;
}

/**
 * Request for mock data chat regeneration
 */
export interface MockDataChatRequest {
  message: string;
}

/**
 * Response from mock data chat regeneration
 */
export interface MockDataChatResponse {
  message: string;
  mockData: MockDataEntityDTO;
}

/**
 * Type guard for TableMockData
 */
export function isTableMockData(data: MockData): data is TableMockData {
  return data.type === 'table';
}

/**
 * Type guard for PostListMockData
 */
export function isPostListMockData(data: MockData): data is PostListMockData {
  return data.type === 'post-list';
}

/**
 * Default mock data for table layout
 * Designed to work with Manifest UI Table component
 */
export const DEFAULT_TABLE_MOCK_DATA: TableMockData = {
  type: 'table',
  columns: [
    { key: 'id', header: 'ID', type: 'text' },
    { key: 'name', header: 'Name', type: 'text' },
    { key: 'amount', header: 'Amount', type: 'number' },
    { key: 'date', header: 'Date', type: 'date' },
    { key: 'status', header: 'Status', type: 'badge' },
  ],
  rows: [
    { id: '1', name: 'Sample Item 1', amount: 150.00, date: '2025-01-15', status: 'Active' },
    { id: '2', name: 'Sample Item 2', amount: 89.50, date: '2025-01-18', status: 'Pending' },
    { id: '3', name: 'Sample Item 3', amount: 299.99, date: '2025-01-20', status: 'Completed' },
    { id: '4', name: 'Sample Item 4', amount: 45.00, date: '2025-01-22', status: 'Active' },
  ],
};

/**
 * Default mock data for post-list layout
 * Designed to work with Manifest UI BlogPostList component
 */
export const DEFAULT_POST_LIST_MOCK_DATA: PostListMockData = {
  type: 'post-list',
  posts: [
    {
      id: 'post-1',
      title: 'Getting Started with Our Platform',
      excerpt: 'Learn how to get started with our platform and make the most of its features.',
      author: 'Sarah Chen',
      date: '2025-01-15',
      category: 'Tutorial',
      tags: ['getting-started', 'beginner'],
      image: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
    },
    {
      id: 'post-2',
      title: 'Best Practices for Success',
      excerpt: 'Discover the best practices for using our tools and achieving your goals.',
      author: 'Alex Rivera',
      date: '2025-01-18',
      category: 'Guide',
      tags: ['tips', 'best-practices'],
      image: 'https://images.unsplash.com/photo-1559028012-481c04fa702d?w=800',
    },
    {
      id: 'post-3',
      title: 'Advanced Features Deep Dive',
      excerpt: 'Take your skills to the next level with our advanced features and techniques.',
      author: 'Jordan Kim',
      date: '2025-01-20',
      category: 'Advanced',
      tags: ['advanced', 'features'],
      image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
    },
  ],
};
