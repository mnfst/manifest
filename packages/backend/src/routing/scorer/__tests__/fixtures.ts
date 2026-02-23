import { ScorerMessage, Tier } from '../types';

export interface Fixture {
  name: string;
  messages: ScorerMessage[];
  expectedTier: Tier;
  keySignals: string[];
}

export const FIXTURES: Fixture[] = [
  {
    name: 'greeting',
    messages: [{ role: 'user', content: 'hi there' }],
    expectedTier: 'simple',
    keySignals: ['short_message override'],
  },
  {
    name: 'math_proof',
    messages: [
      {
        role: 'user',
        content:
          'Prove that there are infinitely many primes using proof by contradiction',
      },
    ],
    expectedTier: 'reasoning',
    keySignals: ['formal_logic_override: "prove" + "proof" + "contradiction"'],
  },
  {
    name: 'simple_question',
    messages: [{ role: 'user', content: 'what is a dog' }],
    expectedTier: 'simple',
    keySignals: ['simpleIndicators: "what is"'],
  },
  {
    name: 'thanks',
    messages: [{ role: 'user', content: 'thanks' }],
    expectedTier: 'simple',
    keySignals: ['short_message + simpleIndicators'],
  },
  {
    name: 'code_generation_complex',
    messages: [
      {
        role: 'user',
        content:
          'Write a React component that fetches user data from an API, handles loading states with a skeleton UI, implements pagination with infinite scroll, and renders a sortable table with filtering',
      },
    ],
    expectedTier: 'complex',
    keySignals: ['codeGeneration + technicalTerms + multiStep'],
  },
  {
    name: 'analytical_comparison',
    messages: [
      {
        role: 'user',
        content:
          'Analyze the trade-offs between microservices and monolith architecture for a startup with 5 engineers. Compare the pros and cons, evaluate deployment complexity, and assess the implications for scaling.',
      },
    ],
    expectedTier: 'complex',
    keySignals: ['analyticalReasoning + technicalTerms'],
  },
  {
    name: 'induction_proof',
    messages: [
      {
        role: 'user',
        content:
          'Prove by induction that the sum of first n naturals equals n(n+1)/2, then derive the closed form for sum of squares',
      },
    ],
    expectedTier: 'reasoning',
    keySignals: ['formal_logic_override: "prove" + "induction" + "derive"'],
  },
  {
    name: 'simple_farewell',
    messages: [{ role: 'user', content: 'bye' }],
    expectedTier: 'simple',
    keySignals: ['short_message override'],
  },
  {
    name: 'debug_with_tools',
    messages: [
      {
        role: 'user',
        content:
          'Fix this bug: TypeError: Cannot read properties of null. Check the stack trace and debug the authentication middleware.',
      },
    ],
    expectedTier: 'complex',
    keySignals: ['codeReview + technicalTerms'],
  },
  {
    name: 'creative_story',
    messages: [
      {
        role: 'user',
        content:
          'Write a short story about a detective who solves mysteries using only logic and deduction. Include dialogue and a plot twist.',
      },
    ],
    expectedTier: 'standard',
    keySignals: ['creative + some complexity from deduction'],
  },
  {
    name: 'relay_passthrough',
    messages: [
      { role: 'user', content: 'Forward to the team: meeting at 3pm' },
    ],
    expectedTier: 'standard',
    keySignals: ['relay signal present but weak weight'],
  },
  {
    name: 'multi_step_workflow',
    messages: [
      {
        role: 'user',
        content:
          'First, scan all repositories for security vulnerabilities. Then, triage the findings by severity. After that, create a report with remediation steps. Finally, schedule a review meeting.',
      },
    ],
    expectedTier: 'complex',
    keySignals: ['multiStep + agenticTasks'],
  },
  {
    name: 'domain_specific',
    messages: [
      {
        role: 'user',
        content:
          'Calculate the p-value for a regression model with these confidence intervals and explain the Bayesian posterior distribution.',
      },
    ],
    expectedTier: 'complex',
    keySignals: ['domainSpecificity + analyticalReasoning'],
  },
  {
    name: 'simple_translation',
    messages: [
      { role: 'user', content: 'Translate "hello world" to Spanish' },
    ],
    expectedTier: 'simple',
    keySignals: ['simpleIndicators: "translate"'],
  },
  {
    name: 'empty_conversation',
    messages: [],
    expectedTier: 'standard',
    keySignals: ['ambiguous: empty input'],
  },
  {
    name: 'image_only',
    messages: [
      {
        role: 'user',
        content: [{ type: 'image', source: { type: 'base64', data: 'abc' } }],
      },
    ],
    expectedTier: 'standard',
    keySignals: ['ambiguous: no text extracted'],
  },
  {
    name: 'code_review_request',
    messages: [
      {
        role: 'user',
        content:
          'Review this code for potential memory leaks and race conditions. Optimize the database queries and refactor the authentication module.',
      },
    ],
    expectedTier: 'complex',
    keySignals: ['codeReview + technicalTerms + multiStep'],
  },
  {
    name: 'standard_build',
    messages: [
      {
        role: 'user',
        content:
          'Create an issue for the API bug we discussed and assign it to the backend team',
      },
    ],
    expectedTier: 'standard',
    keySignals: ['imperativeVerbs + moderate complexity'],
  },
  {
    name: 'formal_logic_single_keyword',
    messages: [{ role: 'user', content: 'Can you prove me wrong about this particular topic?' }],
    expectedTier: 'standard',
    keySignals: ['single formal logic keyword — no override, > 30 chars'],
  },
  {
    name: 'comprehensive_guide',
    messages: [
      {
        role: 'user',
        content:
          'Write a comprehensive guide to implementing OAuth2 with PKCE flow including code examples, security considerations, and deployment checklist',
      },
    ],
    expectedTier: 'complex',
    keySignals: ['expectedOutputLength + codeGeneration + technicalTerms'],
  },
];
