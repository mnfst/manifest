import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Textarea } from '@/components/ui/shadcn/textarea';

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
        <Label htmlFor="name" className="mb-1">
          App Name
        </Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Awesome App"
          className="w-full"
          disabled={isLoading}
          maxLength={100}
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          Choose a descriptive name for your MCP server
        </p>
      </div>

      <div>
        <Label htmlFor="description" className="mb-1">
          Description (optional)
        </Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A brief description of what your app does..."
          className="w-full min-h-[80px] resize-y"
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
