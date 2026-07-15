import { createResource, type Accessor, type Component, type JSX } from 'solid-js';
import { getAutofixCohort } from '../services/api.js';

/**
 * Resolves the current tenant's Auto-fix access cohort — decided entirely by the
 * backend (`AutofixService.hasAccess`, driven by `AUTOFIX_ROLLOUT` plus the
 * per-tenant access-grant / waitlist columns) — and hands the result to
 * `children` as an accessor so a consumer can branch its UI on eligibility. The
 * frontend never names a tenant; membership is whatever the backend reports.
 *
 * `children` is a render function called ONCE, so its subtree mounts a single
 * time and never remounts when the async cohort check resolves — flipping
 * `eligible()` must not reset a consumer's local state mid-load (the two branches
 * are the same overview today, so a swap would be a pure regression).
 *
 * Fails closed: `eligible()` stays false while the check is loading, if it errors,
 * or if the tenant is not in the cohort. Reading an errored resource re-throws,
 * so it gates on `state === 'ready'` and never touches the resource accessor
 * otherwise.
 */
const AutofixCohortGate: Component<{
  children: (eligible: Accessor<boolean>) => JSX.Element;
}> = (props) => {
  const [cohort] = createResource(getAutofixCohort);
  const eligible = () => cohort.state === 'ready' && cohort()?.eligible === true;
  return props.children(eligible);
};

export default AutofixCohortGate;
