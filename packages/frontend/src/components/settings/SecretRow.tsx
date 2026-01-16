import { useState } from 'react';
import { Eye, EyeOff, Copy, Check, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { AppSecret } from '@chatgpt-app-builder/shared';

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
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Key
            </label>
            <input
              type="text"
              value={editKey}
              onChange={(e) => setEditKey(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="SECRET_KEY"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Value
            </label>
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="secret_value"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={isSaving || !editKey.trim() || !editValue.trim()}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
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
          <button
            onClick={() => setIsRevealed(!isRevealed)}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title={isRevealed ? 'Hide value' : 'Reveal value'}
          >
            {isRevealed ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title={isCopied ? 'Copied!' : 'Copy value'}
          >
            {isCopied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {/* Three-dot Menu */}
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              title="More actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

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
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Delete Secret</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Are you sure you want to delete <span className="font-mono font-medium text-foreground">{secret.key}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
