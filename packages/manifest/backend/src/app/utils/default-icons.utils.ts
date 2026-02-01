/**
 * Default app icons - 8 distinct pixel art icons assigned randomly on app creation
 */
export const DEFAULT_ICONS = [
  '/icons/icon-red.png',
  '/icons/icon-orange.png',
  '/icons/icon-yellow.png',
  '/icons/icon-green.png',
  '/icons/icon-blue.png',
  '/icons/icon-purple.png',
  '/icons/icon-pink.png',
  '/icons/icon-gray.png',
];

/**
 * Get a random default icon for new apps
 */
export function getRandomDefaultIcon(): string {
  return DEFAULT_ICONS[Math.floor(Math.random() * DEFAULT_ICONS.length)];
}
