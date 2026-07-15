import { createResource, Show, type Component, type JSX } from 'solid-js';
import { getAutofixCohort } from '../services/api.js';

/**
 * Gates the redesigned Auto-fix beta UI behind the backend eligibility cohort —
 * the hand-picked early-access allowlist (`AutofixService.hasAccess`), the same
 * "fewer than five" set that gates the Auto-fix feature itself. Eligible tenants
 * render `children` (the new UI); everyone else renders `fallback` (the existing
 * UI).
 *
 * The check fails closed: while it is loading, if it errors, or if the tenant is
 * not eligible, the fallback shows — a missing or failed check never yanks the
 * current experience out from under anyone. Eligibility is backend-driven; this
 * component never names a tenant.
 */
const AutofixCohortGate: Component<{ fallback: JSX.Element; children: JSX.Element }> = (props) => {
  const [cohort] = createResource(getAutofixCohort);
  // Reveal `children` only once the check has resolved to eligible. Gating on
  // `state === 'ready'` also keeps us from reading `cohort()` while errored
  // (which re-throws), so the error and loading states both land on the
  // fallback like any other not-yet-eligible tenant.
  const eligible = () => cohort.state === 'ready' && cohort()?.eligible === true;
  return (
    <Show when={eligible()} fallback={props.fallback}>
      {props.children}
    </Show>
  );
};

export default AutofixCohortGate;
