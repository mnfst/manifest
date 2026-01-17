import { useState } from 'react';
import { Button } from '@/components/ui/shadcn/button';

interface PromptFormProps {
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
}

/**
 * Prompt input form for generating a new ChatGPT app
 */
export function PromptForm({ onSubmit, isLoading = false }: PromptFormProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="prompt" className="block text-sm font-medium">
          Describe your ChatGPT app
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., A customer support chatbot that helps users track their orders and process returns"
          className="w-full min-h-[120px] p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={isLoading}
          maxLength={10000}
        />
        <p className="text-xs text-muted-foreground text-right">
          {prompt.length}/10,000 characters
        </p>
      </div>

      <Button
        type="submit"
        disabled={!prompt.trim() || isLoading}
        className="w-full py-3 px-4 h-auto font-medium"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Generating your app...
          </span>
        ) : (
          'Generate App'
        )}
      </Button>
    </form>
  );
}
