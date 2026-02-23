import { ScorerConfig } from './types';

export const DEFAULT_KEYWORDS: Record<string, string[]> = {
  formalLogic: [
    'prove', 'proof', 'derive', 'derivation', 'theorem', 'lemma',
    'corollary', 'if and only if', 'iff', 'contradiction',
    'contrapositive', 'induction', 'deduction', 'axiom', 'postulate',
    'qed', 'formally verify', 'satisfiability', 'soundness',
    'completeness', 'undecidable', 'reducible',
  ],

  analyticalReasoning: [
    'compare', 'contrast', 'evaluate', 'assess', 'trade-offs',
    'tradeoffs', 'pros and cons', 'advantages and disadvantages',
    'weigh', 'critically analyze', 'strengths and weaknesses',
    'implications', 'ramifications', 'nuance', 'on the other hand',
    'counterargument', 'analyze', 'analysis', 'explain',
  ],

  codeGeneration: [
    'write a function', 'implement', 'create a class',
    'build a component', 'write code', 'write a script', 'code this',
    'program this', 'create an api', 'build a module', 'scaffold',
    'boilerplate', 'write a test', 'write tests', 'generate code',
    'component', 'endpoint', 'handler', 'controller',
    'write a component', 'create a component', 'build a service',
    'implementing', 'implemented', 'implementation',
  ],

  codeReview: [
    'fix this bug', 'debug', 'why does this fail',
    'review this code', "what's wrong with", 'code review', 'refactor',
    'optimize this code', 'find the error', 'stack trace', 'exception',
    'segfault', 'memory leak', 'race condition', 'deadlock',
    'off by one', 'typeerror', 'referenceerror', 'syntaxerror',
    'vulnerabilities', 'vulnerability',
  ],

  technicalTerms: [
    'algorithm', 'kubernetes', 'distributed', 'microservice',
    'database', 'architecture', 'infrastructure', 'deployment',
    'pipeline', 'middleware', 'encryption', 'authentication',
    'authorization', 'latency', 'throughput', 'concurrency',
    'parallelism', 'serialization', 'deserialization',
    'react', 'graphql', 'typescript', 'docker', 'sql', 'redis',
    'frontend', 'backend', 'server', 'api', 'oauth',
    'repositories', 'repository', 'security',
  ],

  simpleIndicators: [
    'what is', 'define', 'translate', 'thanks', 'thank you', 'yes',
    'no', 'ok', 'okay', 'sure', 'got it', 'hi', 'hello', 'hey',
    'bye', 'goodbye', 'how are you', 'good morning', 'good night',
    'please', 'help', 'what time', 'where is', 'who is',
  ],

  multiStep: [
    'first', 'then', 'after that', 'finally', 'step 1', 'step 2',
    'step 3', 'next', 'subsequently', 'once you', 'followed by',
    'in sequence', 'phase 1', 'phase 2', 'stage 1', 'stage 2',
    'workflow', 'pipeline',
  ],

  creative: [
    'story', 'poem', 'creative', 'brainstorm', 'imagine', 'fiction',
    'narrative', 'character', 'plot', 'dialogue', 'write a song',
    'compose', 'artistic', 'metaphor', 'allegory',
  ],

  questionComplexity: [
    'how does x relate to y', 'what are the implications',
    'why would', 'what happens if', 'under what conditions',
    'how would you approach', 'what is the relationship between',
  ],

  imperativeVerbs: [
    'build', 'create', 'update', 'deploy', 'send', 'check', 'run',
    'install', 'configure', 'set up', 'launch', 'publish', 'submit',
    'execute', 'start', 'stop', 'restart', 'delete', 'remove',
    'review', 'optimize', 'scan',
  ],

  outputFormat: [
    'as json', 'in json', 'as yaml', 'in yaml', 'as csv', 'markdown',
    'as a table', 'in a table', 'as xml', 'formatted as', 'output as',
    'return as', 'in the format',
  ],

  domainSpecificity: [
    'p-value', 'confidence interval', 'regression', 'hipaa', 'gdpr',
    'sec filing', 'tort', 'liability', 'fiduciary', 'amortization',
    'eigenvalue', 'fourier transform', 'bayesian', 'posterior',
    'genome', 'phenotype', 'pharmacokinetics',
    'distribution', 'probability', 'statistics', 'calculate',
  ],

  agenticTasks: [
    'triage', 'audit', 'investigate', 'monitor', 'orchestrate',
    'coordinate', 'schedule', 'prioritize', 'delegate',
    'batch process', 'scan all', 'check all', 'review all',
    'update all', 'migrate', 'remediation',
  ],

  relay: [
    'forward to', 'escalate', 'transfer to', 'pass along', 'relay',
    'just say', 'tell them', 'send this to', 'notify', 'ping',
    'acknowledge', 'confirm receipt', 'mark as read',
  ],
};

export const DEFAULT_CONFIG: ScorerConfig = {
  dimensions: [
    { name: 'formalLogic', weight: 0.07, direction: 'up', keywords: DEFAULT_KEYWORDS.formalLogic },
    { name: 'analyticalReasoning', weight: 0.06, direction: 'up', keywords: DEFAULT_KEYWORDS.analyticalReasoning },
    { name: 'codeGeneration', weight: 0.06, direction: 'up', keywords: DEFAULT_KEYWORDS.codeGeneration },
    { name: 'codeReview', weight: 0.05, direction: 'up', keywords: DEFAULT_KEYWORDS.codeReview },
    { name: 'technicalTerms', weight: 0.07, direction: 'up', keywords: DEFAULT_KEYWORDS.technicalTerms },
    { name: 'simpleIndicators', weight: 0.08, direction: 'down', keywords: DEFAULT_KEYWORDS.simpleIndicators },
    { name: 'multiStep', weight: 0.07, direction: 'up', keywords: DEFAULT_KEYWORDS.multiStep },
    { name: 'creative', weight: 0.03, direction: 'up', keywords: DEFAULT_KEYWORDS.creative },
    { name: 'questionComplexity', weight: 0.03, direction: 'up', keywords: DEFAULT_KEYWORDS.questionComplexity },
    { name: 'imperativeVerbs', weight: 0.02, direction: 'up', keywords: DEFAULT_KEYWORDS.imperativeVerbs },
    { name: 'outputFormat', weight: 0.02, direction: 'up', keywords: DEFAULT_KEYWORDS.outputFormat },
    { name: 'domainSpecificity', weight: 0.05, direction: 'up', keywords: DEFAULT_KEYWORDS.domainSpecificity },
    { name: 'agenticTasks', weight: 0.03, direction: 'up', keywords: DEFAULT_KEYWORDS.agenticTasks },
    { name: 'relay', weight: 0.02, direction: 'down', keywords: DEFAULT_KEYWORDS.relay },
    { name: 'tokenCount', weight: 0.05, direction: 'up' },
    { name: 'nestedListDepth', weight: 0.03, direction: 'up' },
    { name: 'conditionalLogic', weight: 0.03, direction: 'up' },
    { name: 'codeToProse', weight: 0.02, direction: 'up' },
    { name: 'constraintDensity', weight: 0.03, direction: 'up' },
    { name: 'expectedOutputLength', weight: 0.04, direction: 'up' },
    { name: 'repetitionRequests', weight: 0.02, direction: 'up' },
    { name: 'toolCount', weight: 0.04, direction: 'up' },
    { name: 'conversationDepth', weight: 0.03, direction: 'up' },
  ],
  boundaries: { simpleMax: -0.10, standardMax: 0.08, complexMax: 0.35 },
  confidenceK: 8,
  confidenceMidpoint: 0.15,
  confidenceThreshold: 0.45,
};
