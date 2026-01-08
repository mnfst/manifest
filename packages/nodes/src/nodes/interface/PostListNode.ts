import type { JSONSchema } from '@chatgpt-app-builder/shared';
import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../../types.js';

/**
 * PostList Node
 *
 * Displays a list of blog posts with interactive "Read More" action.
 * When a user clicks "Read More" on a post, the action triggers downstream
 * nodes with the selected Post object as input.
 *
 * Input: Expects a posts array with Post items (id, title, excerpt, author, etc.).
 * Output: Post object (when onReadMore action is triggered).
 */
export const PostListNode: NodeTypeDefinition = {
  name: 'PostList',
  displayName: 'Post List',
  icon: 'layout-list',
  group: ['ui', 'display', 'blog'],
  category: 'interface',
  description: 'Display a list of blog posts with Read More action',

  inputs: ['main'],
  outputs: ['action:onReadMore'], // Action output for conditional execution

  defaultParameters: {
    layoutTemplate: 'post-list',
  },

  // Input schema for posts array
  inputSchema: {
    type: 'object',
    properties: {
      posts: {
        type: 'array',
        description: 'Array of posts to display',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique post identifier',
            },
            title: {
              type: 'string',
              description: 'Post title',
            },
            excerpt: {
              type: 'string',
              description: 'Short summary',
            },
            coverImage: {
              type: 'string',
              description: 'Cover image URL',
            },
            author: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                avatar: { type: 'string' },
              },
              required: ['name'],
            },
            publishedAt: {
              type: 'string',
              description: 'ISO date string',
            },
            readTime: {
              type: 'string',
              description: 'Estimated read time',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
            category: {
              type: 'string',
            },
            url: {
              type: 'string',
            },
          },
          required: ['id', 'title', 'excerpt', 'author', 'publishedAt'],
        },
      },
    },
    required: ['posts'],
  } as JSONSchema,

  // Output schema: Post object passed when onReadMore action is triggered
  outputSchema: {
    type: 'object',
    description: 'Post object passed when onReadMore action is triggered',
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      excerpt: { type: 'string' },
      coverImage: { type: 'string' },
      author: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          avatar: { type: 'string' },
        },
        required: ['name'],
      },
      publishedAt: { type: 'string' },
      readTime: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      category: { type: 'string' },
      url: { type: 'string' },
    },
    required: ['id', 'title', 'excerpt', 'author', 'publishedAt'],
  } as JSONSchema,

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { parameters } = context;
    const layoutTemplate = (parameters.layoutTemplate as string) || 'post-list';

    // PostList nodes render UI and display posts
    // The actual rendering is handled by the frontend
    // Actions are handled via the action callback endpoint
    return {
      success: true,
      output: {
        type: 'interface',
        layoutTemplate,
      },
    };
  },
};
