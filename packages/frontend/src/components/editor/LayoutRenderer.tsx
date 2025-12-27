import type { LayoutTemplate, MockData } from '@chatgpt-app-builder/shared';
import { isTableMockData, isPostListMockData } from '@chatgpt-app-builder/shared';
import { Table } from '../ui/table';
import { BlogPostList } from '../ui/blog-post-list';
import { mapTableMockDataToManifest, mapPostListMockDataToManifest } from '../../lib/manifest-mappers';

interface LayoutRendererProps {
  layoutTemplate: LayoutTemplate;
  mockData: MockData;
  isDarkMode?: boolean;
}

/**
 * Renders the appropriate layout component based on template
 * Uses official Manifest UI components for table and post-list layouts
 */
export function LayoutRenderer({ layoutTemplate, mockData, isDarkMode = false }: LayoutRendererProps) {
  // Table layout using Manifest UI Table component
  if (layoutTemplate === 'table' && isTableMockData(mockData)) {
    const { columns, data } = mapTableMockDataToManifest(mockData);
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <Table
          columns={columns}
          data={data}
          selectable="none"
          emptyMessage="No data available"
        />
      </div>
    );
  }

  // Post-list layout using Manifest UI BlogPostList component
  if (layoutTemplate === 'post-list' && isPostListMockData(mockData)) {
    const { posts } = mapPostListMockDataToManifest(mockData);
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <BlogPostList
          posts={posts}
          variant="list"
          showAuthor={true}
          showCategory={true}
        />
      </div>
    );
  }

  // Fallback for unsupported layouts
  return (
    <div className={`p-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-muted-foreground'}`}>
      Unsupported layout template: {layoutTemplate}
    </div>
  );
}
