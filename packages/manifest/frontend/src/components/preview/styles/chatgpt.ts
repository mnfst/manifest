/**
 * ChatGPT platform style configuration
 * Based on ChatGPT's visual design patterns
 */
export const chatgptStyle = {
  light: {
    background: '#ffffff',
    headerBg: '#ffffff',
    border: '#e5e5e5',
    text: '#0d0d0d',
    secondaryText: '#6b7280',
    avatarBg: '#10a37f',
    messageBg: '#f7f7f8',
  },
  dark: {
    background: '#212121',
    headerBg: '#212121',
    border: '#3f3f3f',
    text: '#ececf1',
    secondaryText: '#8e8ea0',
    avatarBg: '#10a37f',
    messageBg: '#2f2f2f',
  },
} as const;

/**
 * ChatGPT-specific CSS classes for Tailwind
 */
export const chatgptClasses = {
  light: {
    container: 'bg-white',
    header: 'bg-white border-b border-gray-200',
    text: 'text-gray-900',
    secondaryText: 'text-gray-500',
    avatar: 'bg-[#10a37f]',
    messageContainer: 'bg-[#f7f7f8]',
    inputBg: 'bg-white',
    inputBorder: 'border-gray-300',
  },
  dark: {
    container: 'bg-[#212121]',
    header: 'bg-[#212121] border-b border-[#3f3f3f]',
    text: 'text-[#ececf1]',
    secondaryText: 'text-[#8e8ea0]',
    avatar: 'bg-[#10a37f]',
    messageContainer: 'bg-[#2f2f2f]',
    inputBg: 'bg-[#2f2f2f]',
    inputBorder: 'border-[#3f3f3f]',
  },
} as const;
