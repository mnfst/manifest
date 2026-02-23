import { useNavigate } from "@solidjs/router";
import { Show, createEffect, createSignal, type ParentComponent } from "solid-js";
import { authClient } from "../services/auth-client.js";
import { checkLocalMode } from "../services/local-mode.js";

const [autoLoginState, setAutoLoginState] = createSignal<
  "idle" | "pending" | "done" | "failed"
>("idle");

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

    if (state === "done" || state === "failed") {
      navigate("/login", { replace: true });
      return;
    }

    // state === "idle": attempt local auto-login
    setAutoLoginState("pending");
    const ok = await tryLocalAutoLogin();

    if (ok) {
      // Cookies are set; tell Better Auth client to re-fetch the session
      // so the reactive signal updates without a full page reload.
      await s.refetch();
      setAutoLoginState("done");
    } else {
      setAutoLoginState("failed");
    }
  });

  return (
    <Show
      when={!session().isPending && session().data}
      fallback={
        <div class="auth-layout">
          <div class="auth-card" style="text-align: center;">
            <div class="auth-logo">
              <img src="/logo.svg" alt="Manifest" class="auth-logo__img auth-logo__img--light" />
              <img src="/logo-white.svg" alt="Manifest" class="auth-logo__img auth-logo__img--dark" />
            </div>
            <p style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm);">Loading...</p>
          </div>
        </div>
      }
    >
      {props.children}
    </Show>
  );
};

export default AuthGuard;
