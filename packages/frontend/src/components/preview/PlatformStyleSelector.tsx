import type { PlatformStyle } from '@manifest/shared';

interface PlatformStyleSelectorProps {
  value: PlatformStyle;
  onChange: (style: PlatformStyle) => void;
}

/**
 * Toggle buttons for selecting platform style (ChatGPT or Claude)
 */
export function PlatformStyleSelector({ value, onChange }: PlatformStyleSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange('chatgpt')}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
          value === 'chatgpt'
            ? 'bg-[#10a37f] text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <img
          src="/logos/chatgpt.svg"
          alt=""
          className={`w-4 h-4 ${value === 'chatgpt' ? 'invert' : ''}`}
        />
        ChatGPT
      </button>
      <button
        onClick={() => onChange('claude')}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
          value === 'claude'
            ? 'bg-[#d97706] text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <img
          src="/logos/claude.svg"
          alt=""
          className={`w-4 h-4 ${value === 'claude' ? 'invert' : ''}`}
        />
        Claude
      </button>
    </div>
  );
}
