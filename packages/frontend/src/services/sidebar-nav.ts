export const SIDEBAR_BLOCKS = {
  monitoring: {
    label: 'MONITORING',
    title: 'Monitoring',
    items: ['overview', 'messages'] as const,
  },
  manage: {
    label: 'MANAGE',
    title: 'Manage',
    items: ['providers', 'routing', 'playground', 'limits', 'settings'] as const,
  },
  resources: {
    label: 'RESOURCES',
    title: 'Resources',
    items: ['model-prices', 'free-models', 'help'] as const,
  },
  feedback: {
    label: 'FEEDBACK',
    title: 'Feedback',
    items: ['feedback'] as const,
  },
} as const;

export type SidebarBlockId = keyof typeof SIDEBAR_BLOCKS;
export type SidebarItemId = (typeof SIDEBAR_BLOCKS)[SidebarBlockId]['items'][number];

export const SIDEBAR_ITEM_LABELS: Record<SidebarItemId, string> = {
  overview: 'Overview',
  messages: 'Messages',
  providers: 'Providers',
  routing: 'Routing',
  playground: 'Playground',
  limits: 'Limits',
  settings: 'Settings',
  'model-prices': 'Model Prices',
  'free-models': 'Free Models',
  help: 'Help',
  feedback: 'Feedback',
};

export const SIDEBAR_ITEM_PATHS: Record<Exclude<SidebarItemId, 'feedback'>, string> = {
  overview: '',
  messages: '/messages',
  providers: '/providers',
  routing: '/routing',
  playground: '/playground',
  limits: '/limits',
  settings: '/settings',
  'model-prices': '/model-prices',
  'free-models': '/free-models',
  help: '/help',
};

export const SIDEBAR_BLOCK_IDS = Object.keys(SIDEBAR_BLOCKS) as SidebarBlockId[];

export function blockForItem(itemId: SidebarItemId): SidebarBlockId {
  for (const blockId of SIDEBAR_BLOCK_IDS) {
    if ((SIDEBAR_BLOCKS[blockId].items as readonly string[]).includes(itemId)) {
      return blockId;
    }
  }
  throw new Error(`Unknown sidebar item: ${itemId}`);
}
