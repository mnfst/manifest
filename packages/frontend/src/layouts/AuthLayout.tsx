import { A } from "@solidjs/router";
import type { ParentComponent } from "solid-js";

const AuthLayout: ParentComponent = (props) => {
  return (
    <div class="auth-layout">
      <div class="auth-card">
        <div class="auth-logo">
          <A href="/" class="auth-logo__link">
            <img src="/logo.svg" alt="Manifest" class="auth-logo__img auth-logo__img--light" />
            <img src="/logo-white.svg" alt="Manifest" class="auth-logo__img auth-logo__img--dark" />
          </A>
        </div>
        {props.children}
      </div>
    </div>
  );
};

export default AuthLayout;
