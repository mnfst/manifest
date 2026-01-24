import { useState, useEffect, useCallback } from 'react';
import { Mail } from 'lucide-react';
import type { AppUserListItem, AppRole } from '@manifest/shared';
import { api, ApiClientError } from '../../lib/api';
import { InviteCollaboratorModal } from './InviteCollaboratorModal';
import { Button } from '@/components/ui/shadcn/button';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/shadcn/badge';
import { Input } from '@/components/ui/shadcn/input';
import { Alert, AlertDescription } from '@/components/ui/shadcn/alert';

interface CollaboratorManagementProps {
  appId: string;
}

/**
 * Collaborator management component for app owners/admins
 * Allows adding/removing collaborators and managing their roles
 */
export function CollaboratorManagement({ appId }: CollaboratorManagementProps) {
  const [users, setUsers] = useState<AppUserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add user form state
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('admin');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Remove user state
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);

  // Invitation modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AppRole>('admin');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Revoke invitation state
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);

  // Resend invitation state
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);
  const [resendSuccessId, setResendSuccessId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedUsers = await api.listAppUsers(appId);
      setUsers(loadedUsers);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load collaborators');
      }
    } finally {
      setIsLoading(false);
    }
  }, [appId]);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setIsAdding(true);

    try {
      const newUser = await api.addUserToApp(appId, {
        email: newEmail.trim(),
        role: newRole,
      });
      // Convert AppUser to AppUserListItem format
      setUsers((prev) => [...prev, { ...newUser, status: 'active' as const }]);
      setNewEmail('');
      setNewRole('admin');
    } catch (err) {
      if (err instanceof ApiClientError) {
        // Check if the user doesn't exist - show invite modal
        if (err.status === 404 && err.message.toLowerCase().includes('not found')) {
          setInviteEmail(newEmail.trim());
          setInviteRole(newRole);
          setInviteError(null);
          setShowInviteModal(true);
        } else {
          setAddError(err.message);
        }
      } else {
        setAddError('Failed to add collaborator');
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleSendInvitation = async () => {
    setInviteError(null);
    setIsInviting(true);

    try {
      await api.createInvitation(appId, {
        email: inviteEmail,
        role: inviteRole,
      });
      // Close modal and clear form
      setShowInviteModal(false);
      setNewEmail('');
      setNewRole('admin');
      // Reload users to show pending invitation
      await loadUsers();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setInviteError(err.message);
      } else {
        setInviteError('Failed to send invitation');
      }
    } finally {
      setIsInviting(false);
    }
  };

  const handleCloseInviteModal = () => {
    if (!isInviting) {
      setShowInviteModal(false);
      setInviteError(null);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    // Two-click confirmation
    if (removeConfirm !== userId) {
      setRemoveConfirm(userId);
      setTimeout(() => setRemoveConfirm(null), 3000);
      return;
    }

    setRemovingUserId(userId);
    setRemoveConfirm(null);

    try {
      await api.removeUserFromApp(appId, userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      console.error('Failed to remove user:', err);
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    // Two-click confirmation
    if (revokeConfirm !== invitationId) {
      setRevokeConfirm(invitationId);
      setTimeout(() => setRevokeConfirm(null), 3000);
      return;
    }

    setRevokingInvitationId(invitationId);
    setRevokeConfirm(null);

    try {
      await api.revokeInvitation(appId, invitationId);
      setUsers((prev) => prev.filter((u) => u.id !== invitationId));
    } catch (err) {
      console.error('Failed to revoke invitation:', err);
    } finally {
      setRevokingInvitationId(null);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    setResendingInvitationId(invitationId);
    setResendSuccessId(null);

    try {
      await api.resendInvitation(appId, invitationId);
      setResendSuccessId(invitationId);
      // Clear success message after 3 seconds
      setTimeout(() => setResendSuccessId(null), 3000);
    } catch (err) {
      console.error('Failed to resend invitation:', err);
    } finally {
      setResendingInvitationId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading collaborators...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error}
          <Button
            variant="link"
            onClick={loadUsers}
            className="ml-2 p-0 h-auto text-destructive underline hover:no-underline"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Collaborator Form */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium mb-3">Add Collaborator</h3>
        <form onSubmit={handleAddUser} className="flex gap-3">
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="user@example.com"
            required
            className="flex-1"
          />
          <Select
            value={newRole}
            onValueChange={(value) => setNewRole(value as AppRole)}
            options={[{ value: 'admin', label: 'Admin' }]}
          />
          <Button
            type="submit"
            disabled={isAdding || !newEmail.trim()}
          >
            {isAdding ? 'Adding...' : 'Add'}
          </Button>
        </form>
        {addError && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>{addError}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Collaborators List */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-medium">
            Collaborators ({users.length})
          </h3>
        </div>
        <ul className="divide-y">
          {users.map((user) => (
            <li
              key={user.id}
              className={`flex items-center justify-between px-4 py-3 ${
                user.status === 'pending' ? 'bg-gray-50 dark:bg-gray-800/50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    user.status === 'pending'
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      : 'bg-primary/10 dark:bg-primary/20 text-primary'
                  }`}
                >
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        user.status === 'pending' ? 'text-muted-foreground' : ''
                      }`}
                    >
                      {user.name || user.email}
                    </span>
                    {user.status === 'pending' && (
                      <Badge variant="secondary">Pending Invite</Badge>
                    )}
                    {user.status === 'active' && user.isOwner && (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400">
                        Owner
                      </Badge>
                    )}
                    {user.status === 'active' && !user.isOwner && user.role === 'admin' && (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
                        Admin
                      </Badge>
                    )}
                  </div>
                  {user.status === 'active' && user.name && (
                    <span className="text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  )}
                  {user.status === 'pending' && user.inviterName && (
                    <span className="text-xs text-muted-foreground">
                      Invited by {user.inviterName}
                    </span>
                  )}
                </div>
              </div>

              {/* Remove button - disabled for owners */}
              {user.status === 'active' && !user.isOwner && (
                <Button
                  variant={removeConfirm === user.id ? 'destructive' : 'ghost'}
                  size="sm"
                  onClick={() => handleRemoveUser(user.id)}
                  disabled={removingUserId === user.id}
                  className={removeConfirm === user.id ? '' : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'}
                >
                  {removingUserId === user.id
                    ? 'Removing...'
                    : removeConfirm === user.id
                    ? 'Click to confirm'
                    : 'Remove'}
                </Button>
              )}

              {/* Action buttons for pending invitations */}
              {user.status === 'pending' && (
                <div className="flex items-center gap-2">
                  {/* Resend success indicator */}
                  {resendSuccessId === user.id && (
                    <span className="text-xs text-green-600 dark:text-green-400">
                      Sent!
                    </span>
                  )}

                  {/* Resend button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleResendInvitation(user.id)}
                    disabled={resendingInvitationId === user.id}
                    className="h-8 w-8 text-gray-500 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20"
                    title="Resend invitation email"
                  >
                    {resendingInvitationId === user.id ? (
                      <Spinner className="w-4 h-4" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                  </Button>

                  {/* Revoke button */}
                  <Button
                    variant={revokeConfirm === user.id ? 'destructive' : 'ghost'}
                    size="sm"
                    onClick={() => handleRevokeInvitation(user.id)}
                    disabled={revokingInvitationId === user.id}
                    className={revokeConfirm === user.id ? '' : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'}
                  >
                    {revokingInvitationId === user.id
                      ? 'Revoking...'
                      : revokeConfirm === user.id
                      ? 'Click to confirm'
                      : 'Revoke'}
                  </Button>
                </div>
              )}
            </li>
          ))}

          {users.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              No collaborators have access to this app yet.
            </li>
          )}
        </ul>
      </div>

      {/* Confirmation message */}
      {removeConfirm && (
        <Alert className="bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
          <AlertDescription>
            Click remove again to confirm. This action cannot be undone.
            <Button
              variant="link"
              onClick={() => setRemoveConfirm(null)}
              className="ml-2 p-0 h-auto text-amber-700 dark:text-amber-400 underline hover:no-underline"
            >
              Cancel
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Invite Collaborator Modal */}
      <InviteCollaboratorModal
        isOpen={showInviteModal}
        email={inviteEmail}
        role={inviteRole}
        onClose={handleCloseInviteModal}
        onConfirm={handleSendInvitation}
        isLoading={isInviting}
        error={inviteError}
      />
    </div>
  );
}
