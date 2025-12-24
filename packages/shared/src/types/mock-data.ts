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
 */
export const DEFAULT_TABLE_MOCK_DATA: TableMockData = {
  type: 'table',
  columns: [
    { key: 'id', header: 'ID', type: 'text' },
    { key: 'name', header: 'Name', type: 'text' },
    { key: 'status', header: 'Status', type: 'badge' },
  ],
  rows: [
    { id: '1', name: 'Sample Item 1', status: 'Active' },
    { id: '2', name: 'Sample Item 2', status: 'Pending' },
    { id: '3', name: 'Sample Item 3', status: 'Completed' },
  ],
};

/**
 * Default mock data for post-list layout
 */
export const DEFAULT_POST_LIST_MOCK_DATA: PostListMockData = {
  type: 'post-list',
  posts: [
    {
      id: 'post-1',
      title: 'Getting Started',
      excerpt: 'Learn how to get started with our platform.',
      author: 'Admin',
      date: '2025-01-01',
      category: 'Tutorial',
    },
    {
      id: 'post-2',
      title: 'Best Practices',
      excerpt: 'Discover the best practices for using our tools.',
      author: 'Team',
      date: '2025-01-02',
      category: 'Guide',
    },
  ],
};
