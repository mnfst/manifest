import { Show, type Component } from 'solid-js';
import { budgetLabel, budgetState } from '../services/teams-utils.js';

interface BudgetMeterProps {
  spend: number;
  budget: number | null | undefined;
}

/** "$13.80 left" over a bar: teal under 80%, amber near the cap, red over it. */
const BudgetMeter: Component<BudgetMeterProps> = (props) => {
  const state = () => budgetState(props.spend, props.budget);
  return (
    <Show
      when={state().tone !== 'none'}
      fallback={<span class="budget-meter__none">No budget</span>}
    >
      <span
        class="budget-meter"
        classList={{
          'budget-meter--warn': state().tone === 'warn',
          'budget-meter--over': state().tone === 'over',
        }}
      >
        <span class="budget-meter__label">{budgetLabel(props.spend, props.budget)}</span>
        <span
          class="budget-meter__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(state().ratio * 100)}
          aria-label="Budget used this month"
        >
          <span
            class="budget-meter__fill"
            style={{ width: `${Math.round(state().ratio * 100)}%` }}
          />
        </span>
      </span>
    </Show>
  );
};

export default BudgetMeter;
