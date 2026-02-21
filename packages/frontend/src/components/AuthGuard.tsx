import { useNavigate } from "@solidjs/router";
import { Show, createEffect, createSignal, type ParentComponent } from "solid-js";
import { authClient } from "../services/auth-client.js";
import { checkLocalMode } from "../services/local-mode.js";

const [autoLoginState, setAutoLoginState] = createSignal<"idle" | "pending" | "done">("idle");

async function tryLocalAutoLogin(): Promise<boolean> {
  try {
    const local = await checkLocalMode();
    if (!local) return false;

    const res = await fetch("/api/auth/local-session", { credentials: "include" });
    return res.ok;
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

    const state = autoLoginState();
    if (state === "pending") return;

    if (state === "idle") {
      setAutoLoginState("pending");
      const ok = await tryLocalAutoLogin();
      setAutoLoginState("done");
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
