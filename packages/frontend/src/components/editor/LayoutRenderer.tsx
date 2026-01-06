import type { LayoutTemplate } from '@chatgpt-app-builder/shared';
import { Table } from '../ui/table';
import { BlogPostList } from '../ui/blog-post-list';

interface LayoutRendererProps {
  layoutTemplate: LayoutTemplate;
  isDarkMode?: boolean;
}

/**
 * Renders an empty/placeholder layout component based on template
 * Uses official Manifest UI components for table and post-list layouts
 */
export function LayoutRenderer({ layoutTemplate, isDarkMode = false }: LayoutRendererProps) {
  // Table layout using Manifest UI Table component with empty data
  if (layoutTemplate === 'table') {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <Table
          columns={[
            { accessor: 'name', header: 'Name' },
            { accessor: 'value', header: 'Value' },
          ]}
          data={[]}
          selectable="none"
          emptyMessage="No data available - connect a data source"
        />
      </div>
    );
  }

  // Post-list layout using Manifest UI BlogPostList component with empty data
  if (layoutTemplate === 'post-list') {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <BlogPostList
          posts={[]}
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
