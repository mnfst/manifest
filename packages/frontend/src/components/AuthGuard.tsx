import { useLocation, useNavigate } from '@solidjs/router';
import { Show, createEffect, createSignal, type ParentComponent } from 'solid-js';
import { authClient } from '../services/auth-client.js';
import { buildLoginRedirect } from '../services/auth-redirects.js';
import { hasPlanBeenChosen, markPlanChosen } from '../services/plan-selection.js';
import { getBillingStatus } from '../services/api/billing.js';

const AuthGuard: ParentComponent = (props) => {
  const session = authClient.useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [planChecked, setPlanChecked] = createSignal(false);

  createEffect(() => {
    const s = session();
    if (s.isPending) return;
    if (!s.data) {
      navigate(buildLoginRedirect(location.pathname, location.search), { replace: true });
      return;
    }
    const userId = s.data.user?.id;
    if (planChecked()) return;
    if (userId && hasPlanBeenChosen(userId)) {
      setPlanChecked(true);
      return;
    }
    getBillingStatus()
      .then((status) => {
        if (status?.enabled && status.plan !== 'pro') {
          navigate('/register?step=plan', { replace: true });
        } else {
          if (userId) markPlanChosen(userId);
          setPlanChecked(true);
        }
      })
      .catch(() => {
        setPlanChecked(true);
      });
  });

  return (
    <Show
      when={!session().isPending && session().data && planChecked()}
      fallback={
        <div class="auth-layout">
          <div class="auth-card" style="text-align: center;">
            <div class="auth-logo">
              <img src="/logotype-white.svg" alt="Manifest" class="auth-logo__img auth-logo__img--light" />
              <img src="/logotype-dark.svg" alt="" class="auth-logo__img auth-logo__img--dark" />
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
