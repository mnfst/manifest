/**
 * Claude platform style configuration
 * Based on Claude's visual design patterns with beige/cream tones
 */
export const claudeStyle = {
  light: {
    background: '#f5f0e8',
    headerBg: '#f5f0e8',
    border: '#e0d9cc',
    text: '#1a1a1a',
    secondaryText: '#666666',
    avatarBg: '#d97706',
    messageBg: '#f5f0e8',
  },
  dark: {
    background: '#2f2a23',
    headerBg: '#2f2a23',
    border: '#4a433a',
    text: '#f5f5f5',
    secondaryText: '#a3a3a3',
    avatarBg: '#d97706',
    messageBg: '#2f2a23',
  },
} as const;

/**
 * Claude-specific CSS classes for Tailwind
 */
export const claudeClasses = {
  light: {
    container: 'bg-[#f5f0e8]',
    header: 'bg-[#f5f0e8] border-b border-[#e0d9cc]',
    text: 'text-[#1a1a1a]',
    secondaryText: 'text-[#666666]',
    avatar: 'bg-amber-600',
    messageContainer: 'bg-[#f5f0e8]',
    inputBg: 'bg-white',
    inputBorder: 'border-[#e0d9cc]',
  },
  dark: {
    container: 'bg-[#2f2a23]',
    header: 'bg-[#2f2a23] border-b border-[#4a433a]',
    text: 'text-[#f5f5f5]',
    secondaryText: 'text-[#a3a3a3]',
    avatar: 'bg-amber-600',
    messageContainer: 'bg-[#2f2a23]',
    inputBg: 'bg-[#3d362d]',
    inputBorder: 'border-[#4a433a]',
  },
} as const;
