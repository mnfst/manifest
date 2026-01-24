import { useEffect, useState, type FormEvent } from 'react';
import type { App } from '@manifest/shared';
import { Button } from '@/components/ui/shadcn/button';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { Alert, AlertDescription } from '@/components/ui/shadcn/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';

interface EditAppModalProps {
  isOpen: boolean;
  app: App | null;
  onClose: () => void;
  onSubmit: (appId: string, data: { name: string; description?: string }) => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Modal for editing an existing app
 * Pre-populates form with current app data
 */
export function EditAppModal({
  isOpen,
  app,
  onClose,
  onSubmit,
  isLoading = false,
  error,
}: EditAppModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Pre-populate form when app changes
  useEffect(() => {
    if (app) {
      setName(app.name);
      setDescription(app.description || '');
      setValidationError(null);
    }
  }, [app]);

  const handleOpenChange = (open: boolean) => {
    if (!open && !isLoading) {
      onClose();
    }
  };

  if (!app) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError('App name is required');
      return;
    }

    if (trimmedName.length > 100) {
      setValidationError('App name must be 100 characters or less');
      return;
    }

    onSubmit(app.id, {
      name: trimmedName,
      description: description.trim() || undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit App</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-name" className="mb-1">
              App Name
            </Label>
            <Input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome App"
              className="w-full"
              disabled={isLoading}
              maxLength={100}
              required
            />
          </div>

          <div>
            <Label htmlFor="edit-description" className="mb-1">
              Description (optional)
            </Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of what your app does..."
              className="w-full min-h-[80px] resize-y"
              disabled={isLoading}
              maxLength={500}
            />
          </div>

          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Slug:</span>{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded">{app.slug}</code>
            <span className="ml-2 text-amber-600">(cannot be changed)</span>
          </div>

          {(error || validationError) && (
            <Alert variant="destructive">
              <AlertDescription>{error || validationError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex-1"
            >
              {isLoading && <Spinner className="w-4 h-4 mr-2" />}
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
