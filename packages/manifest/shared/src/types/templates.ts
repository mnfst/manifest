import type { LayoutTemplate } from './app.js';

/**
 * Template definition with default code and sample data for preview.
 */
export interface TemplateDefinition {
  /** Default TSX component code */
  defaultCode: string;
  /** Sample data for preview rendering */
  sampleData: unknown;
}

/**
 * Sample data for the stat-card template.
 * Matches the Stats component expected format.
 */
export const STAT_CARD_SAMPLE_DATA = {
  stats: [
    {
      label: 'Total Revenue',
      value: '$45,231.89',
      change: 20.1,
      changeLabel: 'from last month',
      trend: 'up' as const,
    },
    {
      label: 'Active Users',
      value: '2,350',
      change: 12.5,
      changeLabel: 'from last week',
      trend: 'up' as const,
    },
    {
      label: 'Bounce Rate',
      value: '32.8%',
      change: -5.2,
      changeLabel: 'from yesterday',
      trend: 'down' as const,
    },
  ],
};

/**
 * Default code for the stat-card layout template.
 * Full customizable component that users can modify.
 */
export const STAT_CARD_DEFAULT_CODE = `import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// Customize this component to change how your stats are displayed
export default function CustomStatCard({ data }) {
  const stats = data?.stats ?? []

  if (stats.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No statistics available
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
      {stats.map((stat, index) => {
        const trend = stat.trend ?? (stat.change > 0 ? 'up' : stat.change < 0 ? 'down' : 'neutral')
        const changeValue = stat.change != null
          ? \`\${stat.change > 0 ? '+' : ''}\${stat.change.toFixed(1)}%\`
          : ''

        return (
          <div
            key={index}
            className="p-4 rounded-lg border border-gray-200 bg-white"
          >
            {/* Label */}
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              {stat.label}
            </div>

            {/* Value */}
            <div className="text-2xl md:text-3xl font-semibold text-gray-900 mb-1">
              {String(stat.value)}
            </div>

            {/* Change indicator */}
            {changeValue && (
              <div className={\`flex items-center gap-1 text-xs font-medium \${
                trend === 'up' ? 'text-green-600' :
                trend === 'down' ? 'text-red-600' :
                'text-gray-500'
              }\`}>
                {trend === 'up' && <TrendingUp className="h-4 w-4" />}
                {trend === 'down' && <TrendingDown className="h-4 w-4" />}
                {trend === 'neutral' && <Minus className="h-4 w-4" />}
                <span>{changeValue}</span>
                {stat.changeLabel && (
                  <span className="text-gray-500 ml-1">{stat.changeLabel}</span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}`;

/**
 * Sample data for the post-list template.
 * Matches the Post List component expected format.
 */
export const POST_LIST_SAMPLE_DATA_NEW = {
  posts: [
    {
      id: '1',
      title: 'Getting Started with TypeScript',
      excerpt: 'Learn the basics of TypeScript and how to set up your first project with type-safe code.',
      author: { name: 'Jane Developer', avatar: '' },
      publishedAt: '2026-01-08',
      readTime: '5 min read',
      tags: ['TypeScript', 'Tutorial'],
      category: 'Development',
    },
    {
      id: '2',
      title: 'Building Modern UIs with React',
      excerpt: 'Discover best practices for building responsive and accessible user interfaces with React.',
      author: { name: 'John Designer' },
      publishedAt: '2026-01-07',
      readTime: '8 min read',
      tags: ['React', 'UI/UX'],
      category: 'Frontend',
    },
  ],
};

/**
 * Default code for the post-list layout template.
 * Displays a list of posts with "Read More" action buttons.
 */
export const POST_LIST_DEFAULT_CODE_NEW = `// Customize this component to change how your posts are displayed
export default function CustomPostList({ data, onAction }) {
  const posts = data?.posts ?? []

  if (posts.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No posts available
      </div>
    )
  }

  const handleReadMore = (post) => {
    // Trigger the onReadMore action with the post data
    if (onAction) {
      onAction('onReadMore', post)
    }
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <div key={post.id} className="p-4 border rounded-lg">
          <h3 className="font-semibold text-lg">{post.title}</h3>
          <p className="text-gray-600 mt-1">{post.excerpt}</p>
          <div className="flex items-center justify-between mt-3">
            <div className="text-sm text-gray-500">
              By {post.author?.name} • {post.publishedAt}
            </div>
            <button
              onClick={() => handleReadMore(post)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Read More →
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}`;

/**
 * Sample data for the blank-component template.
 * Provides example data structure for preview rendering.
 */
export const BLANK_COMPONENT_SAMPLE_DATA = {
  message: 'Sample data from flow',
  items: ['Item 1', 'Item 2', 'Item 3'],
  count: 42,
};

/**
 * Default code for the blank-component template.
 * Implements the Manifest UI 4-argument pattern with comprehensive comments.
 */
export const BLANK_COMPONENT_DEFAULT_CODE = `/**
 * Blank Component Template
 *
 * This component follows the Manifest UI 4-argument pattern.
 * Customize this template to create your own UI component.
 */

interface BlankComponentProps {
  /**
   * DATA: Input from the flow execution
   * This is the primary data your component will display or process.
   * Access nested properties safely: data?.property ?? defaultValue
   */
  data: unknown;

  /**
   * APPEARANCE: Visual customization options
   * Define typed options here and they'll auto-appear in the Appearance panel.
   * Supported types: boolean, string, number, or union literals ('a' | 'b')
   *
   * Example:
   *   variant?: 'default' | 'outlined';
   *   showBorder?: boolean;
   *   padding?: number;
   */
  appearance?: {
    // Add your appearance options here
  };

  /**
   * CONTROL: Behavior and state control
   * Use for component configuration that affects behavior, not visuals.
   *
   * Example:
   *   disabled?: boolean;
   *   readOnly?: boolean;
   *   maxItems?: number;
   */
  control?: {
    // Add your control options here
  };

  /**
   * ACTIONS: Event callbacks
   * Define functions the component can call to trigger flow actions.
   * These connect your component to the broader flow.
   *
   * Example:
   *   onClick?: () => void;
   *   onSubmit?: (value: string) => void;
   *   onItemSelect?: (item: unknown) => void;
   */
  actions?: {
    // Add your action callbacks here
  };
}

export default function BlankComponent({
  data,
  appearance = {},
  control = {},
  actions = {}
}: BlankComponentProps) {
  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">
        Hello World
      </h2>
      <p className="mt-2 text-sm text-gray-500">
        Edit this component to create your own UI.
        Check the comments above for the 4-argument pattern.
      </p>
      {data && (
        <pre className="mt-4 p-2 bg-gray-50 rounded text-xs overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
`;

/**
 * Registry of template definitions with default code and sample data.
 */
export const TEMPLATE_DEFINITIONS: Record<LayoutTemplate, TemplateDefinition> = {
  'stat-card': {
    defaultCode: STAT_CARD_DEFAULT_CODE,
    sampleData: STAT_CARD_SAMPLE_DATA,
  },
  'post-list': {
    defaultCode: POST_LIST_DEFAULT_CODE_NEW,
    sampleData: POST_LIST_SAMPLE_DATA_NEW,
  },
  'blank-component': {
    defaultCode: BLANK_COMPONENT_DEFAULT_CODE,
    sampleData: BLANK_COMPONENT_SAMPLE_DATA,
  },
};

/**
 * Get the default code for a layout template.
 */
export function getTemplateDefaultCode(template: LayoutTemplate): string {
  return TEMPLATE_DEFINITIONS[template]?.defaultCode ?? '';
}

/**
 * Get the sample data for a layout template.
 */
export function getTemplateSampleData(template: LayoutTemplate): unknown {
  return TEMPLATE_DEFINITIONS[template]?.sampleData ?? {};
}
