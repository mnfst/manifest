import type { JSX } from 'solid-js';

interface PipelineStep {
  num: number;
  name: JSX.Element;
  desc: string;
}

/**
 * Builds the pipeline help modal content.
 */
export function buildPipelineHelp(
  specificity: boolean,
  custom: boolean,
  complexity: boolean,
): JSX.Element {
  const steps: PipelineStep[] = [];
  let n = 1;

  if (custom) {
    steps.push({
      num: n++,
      name: 'Custom routing',
      desc: 'If a request header matches a custom tier rule, it is routed to the corresponding model.',
    });
  }

  if (specificity) {
    steps.push({
      num: n++,
      name: 'Task-specific routing',
      desc: 'Manifest semantically analyzes the query, and if it matches an active task-specific tier (coding, image generation\u2026), it is routed to the corresponding model.',
    });
  }

  steps.push({
    num: n,
    name: complexity ? (
      <>
        Default routing: <i>complexity</i>
      </>
    ) : (
      <>
        Default routing: <i>regular</i>
      </>
    ),
    desc: complexity
      ? 'Manifest semantically analyzes the query, scores its complexity, and assigns it to a tier ranging from \u201csimple\u201d to \u201creasoning\u201d.'
      : 'All remaining requests go to the default model and its fallbacks.',
  });

  return (
    <div class="routing-pipeline-help-steps">
      <p class="routing-pipeline-help-summary">
        Routing is a powerful technique that allows Manifest to intercept queries on the fly and
        redirect them to the corresponding model.
      </p>
      <p class="routing-pipeline-help-summary">
        This is what your current configuration looks like:
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
