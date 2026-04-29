import { useNavigate } from '@solidjs/router';
import { Show, createEffect, type ParentComponent } from 'solid-js';
import { authClient } from '../services/auth-client.js';

const AuthGuard: ParentComponent = (props) => {
  const session = authClient.useSession();
  const navigate = useNavigate();

  createEffect(() => {
    const s = session();
    if (s.isPending) return;
    if (s.data) return;
    navigate('/login', { replace: true });
  });

  return (
    <Show
      when={!session().isPending && session().data}
      fallback={
        <div class="auth-layout">
          <div class="auth-card" style="text-align: center;">
            <div class="auth-logo">
              <img src="/logo.svg" alt="Manifest" class="auth-logo__img auth-logo__img--light" />
              <img src="/logo-white.svg" alt="" class="auth-logo__img auth-logo__img--dark" />
            </div>
            <p style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm);">
              Loading...
            </p>
          </div>
        </div>
      }
    >
      {props.children}
    </Show>
  );
};

export default AuthGuard;
