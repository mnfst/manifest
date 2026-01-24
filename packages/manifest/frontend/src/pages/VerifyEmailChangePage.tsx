import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, XCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { api, ApiClientError } from '../lib/api';
import { Button } from '@/components/ui/shadcn/button';

/**
 * Email verification callback page
 * Handles verification link clicks from email change emails
 */
export function VerifyEmailChangePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email address...');
  const [newEmail, setNewEmail] = useState<string | null>(null);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link. No token provided.');
        return;
      }

      try {
        const result = await api.verifyEmailChange({ token });
        setStatus('success');
        setMessage(result.message);
        setNewEmail(result.user.email);
      } catch (err) {
        setStatus('error');
        if (err instanceof ApiClientError) {
          setMessage(err.message);
        } else {
          setMessage('Failed to verify email. Please try again or request a new verification link.');
        }
      }
    };

    verifyEmail();
  }, [token]);

  const handleContinue = () => {
    navigate('/settings?tab=account');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-lg border shadow-sm p-8 text-center">
        {status === 'loading' && (
          <>
            <Spinner className="w-16 h-16 mx-auto text-primary mb-4" />
            <h1 className="text-xl font-semibold mb-2">Verifying Email</h1>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h1 className="text-xl font-semibold mb-2">Email Verified!</h1>
            <p className="text-muted-foreground mb-4">{message}</p>
            {newEmail && (
              <p className="text-sm text-muted-foreground mb-6">
                Your email has been changed to <span className="font-medium text-foreground">{newEmail}</span>
              </p>
            )}
            <Button onClick={handleContinue}>
              Continue to Settings
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 mx-auto text-destructive mb-4" />
            <h1 className="text-xl font-semibold mb-2">Verification Failed</h1>
            <p className="text-muted-foreground mb-6">{message}</p>
            <div className="space-y-3">
              <Button onClick={handleContinue} className="w-full">
                Go to Account Settings
              </Button>
              <Button variant="secondary" onClick={() => navigate('/')} className="w-full">
                Go to Dashboard
              </Button>
            </div>
          </>
        )}

        <div className="mt-8 pt-6 border-t">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" />
            <span>Email Verification</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailChangePage;
