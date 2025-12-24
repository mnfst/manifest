import type { LayoutTemplate, MockData, TableMockData, PostListMockData } from '@chatgpt-app-builder/shared';
import { isTableMockData, isPostListMockData } from '@chatgpt-app-builder/shared';

interface LayoutRendererProps {
  layoutTemplate: LayoutTemplate;
  mockData: MockData;
  isDarkMode?: boolean;
}

/**
 * Renders the appropriate layout component based on template
 * POC: Simple table and post-list implementations
 * TODO: Replace with actual Manifest UI components when installed
 */
export function LayoutRenderer({ layoutTemplate, mockData, isDarkMode = false }: LayoutRendererProps) {
  if (layoutTemplate === 'table' && isTableMockData(mockData)) {
    return <TableLayout data={mockData} isDarkMode={isDarkMode} />;
  }

  if (layoutTemplate === 'post-list' && isPostListMockData(mockData)) {
    return <PostListLayout data={mockData} isDarkMode={isDarkMode} />;
  }

  return (
    <div className={`p-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-muted-foreground'}`}>
      Unsupported layout template: {layoutTemplate}
    </div>
  );
}

/**
 * Table layout component
 * POC implementation - will be replaced with @manifest/table
 */
function TableLayout({ data, isDarkMode }: { data: TableMockData; isDarkMode: boolean }) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className={isDarkMode ? 'bg-gray-700' : 'bg-muted'}>
            {data.columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-sm font-medium border-b ${
                  isDarkMode ? 'text-gray-200 border-gray-600' : ''
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-muted/50'}>
              {data.columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 text-sm border-b ${
                  isDarkMode ? 'text-gray-300 border-gray-600' : ''
                }`}>
                  {col.type === 'badge' ? (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-primary/10 text-primary'
                    }`}>
                      {String(row[col.key])}
                    </span>
                  ) : (
                    String(row[col.key] ?? '')
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Post list layout component
 * POC implementation - will be replaced with @manifest/blog-post-list
 */
function PostListLayout({ data, isDarkMode }: { data: PostListMockData; isDarkMode: boolean }) {
  return (
    <div className="space-y-4">
      {data.posts.map((post) => (
        <article
          key={post.id}
          className={`p-4 border rounded-lg transition-colors ${
            isDarkMode
              ? 'border-gray-600 hover:bg-gray-700/50'
              : 'hover:bg-muted/50'
          }`}
        >
          <div className="space-y-2">
            {post.category && (
              <span className={`text-xs font-medium uppercase tracking-wide ${
                isDarkMode ? 'text-blue-400' : 'text-primary'
              }`}>
                {post.category}
              </span>
            )}
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : ''}`}>{post.title}</h3>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-muted-foreground'}`}>{post.excerpt}</p>
            <div className={`flex items-center gap-3 text-xs ${isDarkMode ? 'text-gray-500' : 'text-muted-foreground'}`}>
              {post.author && <span>By {post.author}</span>}
              {post.date && <span>{post.date}</span>}
            </div>
            {post.tags && post.tags.length > 0 && (
              <div className="flex gap-1">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`px-2 py-0.5 rounded text-xs ${
                      isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-muted'
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
