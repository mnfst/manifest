import { useState } from 'react';
import { Eye, EyeOff, Copy, Check, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/shadcn/alert-dialog';
import type { AppSecret } from '@manifest/shared';

interface SecretRowProps {
  secret: AppSecret;
  onUpdate: (secretId: string, key: string, value: string) => Promise<void>;
  onDelete: (secretId: string) => Promise<void>;
}

/**
 * Individual secret row with masked value, reveal toggle, copy, and actions menu
 * Railway-style design with inline editing support
 */
export function SecretRow({ secret, onUpdate, onDelete }: SecretRowProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editKey, setEditKey] = useState(secret.key);
  const [editValue, setEditValue] = useState(secret.value);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const maskedValue = '•'.repeat(Math.min(secret.value.length, 24));

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret.value);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const handleSaveEdit = async () => {
    if (!editKey.trim() || !editValue.trim()) return;

    setIsSaving(true);
    try {
      await onUpdate(secret.id, editKey.trim(), editValue.trim());
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditKey(secret.key);
    setEditValue(secret.value);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(secret.id);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (isEditing) {
    return (
      <div className="border border-border rounded-lg p-4 bg-card">
        <div className="space-y-3">
          <div>
            <Label className="text-muted-foreground">
              Key
            </Label>
            <Input
              type="text"
              value={editKey}
              onChange={(e) => setEditKey(e.target.value)}
              placeholder="SECRET_KEY"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-muted-foreground">
              Value
            </Label>
            <Input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="secret_value"
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleCancelEdit} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSaving || !editKey.trim() || !editValue.trim()}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-card hover:border-border/80 transition-colors">
      <div className="flex items-center justify-between gap-4">
        {/* Key and Value */}
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm font-medium text-foreground">
            {secret.key}
          </div>
          <div className="font-mono text-sm text-muted-foreground mt-1">
            {isRevealed ? secret.value : maskedValue}
          </div>
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-1">
          {/* Reveal/Hide Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsRevealed(!isRevealed)}
            title={isRevealed ? 'Hide value' : 'Reveal value'}
          >
            {isRevealed ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </Button>

          {/* Copy Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            title={isCopied ? 'Copied!' : 'Copy value'}
          >
            {isCopied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>

          {/* Three-dot Menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="More actions"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>

            {isMenuOpen && (
              <>
                {/* Backdrop to close menu */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsMenuOpen(false)}
                />
                {/* Menu */}
                <div className="absolute right-0 top-full mt-1 w-32 bg-popover border border-border rounded-md shadow-lg z-20">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsEditing(true);
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted text-destructive flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Secret</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-mono font-medium text-foreground">{secret.key}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
