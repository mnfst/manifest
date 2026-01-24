import { useState } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { Label } from '@/components/ui/shadcn/label';

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
        <Label htmlFor="prompt">
          Describe your ChatGPT app
        </Label>
        <Textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., A customer support chatbot that helps users track their orders and process returns"
          className="min-h-[120px] resize-none"
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
            <Spinner className="h-5 w-5" />
            Generating your app...
          </span>
        ) : (
          'Generate App'
        )}
      </Button>
    </form>
  );
}
