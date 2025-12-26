import { useState, type FormEvent } from 'react';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

/**
 * Prompt input component for flow creation
 * Simple textarea with submit button for AI-assisted flow generation
 */
export function PromptInput({
  onSubmit,
  isLoading = false,
  placeholder = 'Describe the MCP tool you want to create...',
}: PromptInputProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onSubmit(prompt.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background min-h-[100px] resize-y"
        disabled={isLoading}
        maxLength={10000}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {prompt.length}/10000 characters
        </p>
        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {isLoading ? 'Creating...' : 'Create Flow'}
        </button>
      </div>
    </form>
  );
}
