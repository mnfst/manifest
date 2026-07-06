import { useNavigate, useSearchParams } from '@solidjs/router';
import { Show, createEffect, createSignal, onMount, type ParentComponent } from 'solid-js';
import { authClient } from '../services/auth-client.js';
import { getAuthDestination } from '../services/auth-redirects.js';
import { checkNeedsSetup } from '../services/setup-status.js';

const GuestGuard: ParentComponent = (props) => {
  const session = authClient.useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [setupChecked, setSetupChecked] = createSignal(false);
  const [ready, setReady] = createSignal(false);

  onMount(async () => {
    const needsSetup = await checkNeedsSetup();
    if (needsSetup) {
      navigate('/setup', { replace: true });
      return;
    }
    setSetupChecked(true);
  });

  createEffect(() => {
    const s = session();
    if (!s.isPending && s.data) {
      navigate(getAuthDestination(searchParams), { replace: true });
    }
    if (setupChecked() && !s.isPending && !s.data) {
      setReady(true);
    }
  });

  return (
    <Show when={ready()} fallback={null}>
      {props.children}
    </Show>
  );
};

export default GuestGuard;
