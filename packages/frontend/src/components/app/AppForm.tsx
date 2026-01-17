import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/shadcn/button';

interface AppFormProps {
  onSubmit: (data: { name: string; description?: string }) => void;
  isLoading?: boolean;
}

/**
 * Form for creating a new app
 * Collects name and optional description
 */
export function AppForm({ onSubmit, isLoading = false }: AppFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium mb-1"
        >
          App Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Awesome App"
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
          disabled={isLoading}
          maxLength={100}
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          Choose a descriptive name for your MCP server
        </p>
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium mb-1"
        >
          Description (optional)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A brief description of what your app does..."
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background min-h-[80px] resize-y"
          disabled={isLoading}
          maxLength={500}
        />
      </div>

      <Button
        type="submit"
        disabled={isLoading || !name.trim()}
        className="w-full py-3"
      >
        {isLoading ? 'Creating...' : 'Create App'}
      </Button>
    </form>
  );
}
