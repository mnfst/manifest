import { useNavigate } from "@solidjs/router";
import { Show, createEffect, type ParentComponent } from "solid-js";
import { authClient } from "../services/auth-client.js";

const AuthGuard: ParentComponent = (props) => {
  const session = authClient.useSession();
  const navigate = useNavigate();

  createEffect(() => {
    const s = session();
    if (!s.isPending && !s.data) {
      navigate("/login", { replace: true });
    }
  });

  return (
    <Show when={!session().isPending && session().data} fallback={null}>
      {props.children}
    </Show>
  );
};

export default AuthGuard;
