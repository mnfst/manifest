import type { JSX } from 'solid-js';

interface PipelineStep {
  num: number;
  name: string;
  desc: string;
}

/**
 * Builds the pipeline help modal content.
 * Returns null when no layers are active (Default only).
 */
export function buildPipelineHelp(
  complexity: boolean,
  specificity: boolean,
  custom: boolean,
): JSX.Element | null {
  const active = [custom, specificity, complexity].filter(Boolean).length;
  if (active === 0) return null;

  const steps: PipelineStep[] = [];
  let n = 1;

  if (custom) {
    steps.push({
      num: n++,
      name: 'Custom',
      desc: 'Checked first. If a request header matches a custom routing rule, it routes there immediately.',
    });
  }

  if (specificity) {
    steps.push({
      num: n++,
      name: 'Task-specific',
      desc: 'If the request matches a task type like coding or trading, it goes to the dedicated model for that category.',
    });
  }

  if (complexity) {
    steps.push({
      num: n++,
      name: 'Complexity',
      desc: 'The request gets scored and routed to the tier that fits its difficulty. Cheap models handle simple tasks, better ones take on harder work.',
    });
  }

  steps.push({
    num: n,
    name: 'Default',
    desc: complexity
      ? 'Catches any request that the other routing layers couldn\u2019t handle, for example when a complexity routing tier has no model assigned.'
      : 'Handles every request that didn\u2019t match an earlier rule.',
  });

  return (
    <div class="routing-pipeline-help-steps">
      <p class="routing-pipeline-help-summary">
        Each request stops at the first match. Everything else falls through to the next step.
      </p>
      {steps.map((step) => (
        <div class="routing-pipeline-help-step">
          <span class="routing-pipeline-help-step__head">
            <span class="routing-pipeline-help-step__num">{step.num}</span>
            <span class="routing-pipeline-help-step__tag">{step.name}</span>
          </span>
          <span class="routing-pipeline-help-step__desc">{step.desc}</span>
        </div>
      ))}
    </div>
  );
}
