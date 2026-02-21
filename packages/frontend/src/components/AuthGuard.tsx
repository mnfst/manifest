import { useNavigate } from "@solidjs/router";
import { Show, createEffect, createSignal, type ParentComponent } from "solid-js";
import { authClient } from "../services/auth-client.js";

const [localAutoLogin, setLocalAutoLogin] = createSignal(false);

async function tryLocalAutoLogin(): Promise<boolean> {
  try {
    const res = await fetch("/api/v1/health");
    const data = await res.json();
    if (data.mode !== "local") return false;

    const { error } = await authClient.signIn.email({
      email: "local@manifest.local",
      password: "local-mode-password",
    });
    return !error;
  } catch {
    return false;
  }
}

const AuthGuard: ParentComponent = (props) => {
  const session = authClient.useSession();
  const navigate = useNavigate();

  createEffect(async () => {
    const s = session();
    if (s.isPending) return;
    if (s.data) return;

    if (!localAutoLogin()) {
      setLocalAutoLogin(true);
      const ok = await tryLocalAutoLogin();
      if (ok) return; // session will refresh automatically
    }

    navigate("/login", { replace: true });
  });

  return (
    <Show when={!session().isPending && session().data} fallback={null}>
      {props.children}
    </Show>
  );
};

export default AuthGuard;
