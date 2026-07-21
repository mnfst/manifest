import type { ParentComponent } from 'solid-js';
import LanguageSelector from '../components/LanguageSelector.jsx';

const AuthLayout: ParentComponent = (props) => {
  return (
    <div class="auth-layout">
      <LanguageSelector class="language-selector--auth" />
      <div class="auth-card">
        <div class="auth-logo">
          <a href="https://manifest.build" class="auth-logo__link">
            <img
              src="/logotype-white.svg"
              alt="Manifest"
              class="auth-logo__img auth-logo__img--light"
            />
            <img src="/logotype-dark.svg" alt="" class="auth-logo__img auth-logo__img--dark" />
          </a>
        </div>
        {props.children}
      </div>
    </div>
  );
};

export default AuthLayout;
