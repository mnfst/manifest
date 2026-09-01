const test = require('node:test');
const assert = require('node:assert/strict');

const parser = import('../design-system/lib/parse-css.mjs');
const cascade = import('../design-system/lib/cascade.mjs');
const emitter = import('../design-system/lib/emit.mjs');

test('CSS comment stripping preserves comment markers inside strings', async () => {
  const { stripComments } = await parser;
  const source = '.a { content: "/* not a comment */"; } /* remove me */\n.b { color: red; }';
  const stripped = stripComments(source);

  assert.match(stripped, /"\/\* not a comment \*\/"/);
  assert.doesNotMatch(stripped, /remove me/);
  assert.equal(stripped.split('\n').length, source.split('\n').length);
});

test('CSS parsing ignores braces inside quoted declaration values', async () => {
  const { parseCss } = await parser;
  const { rules } = parseCss('.a { content: "}"; color: red; } .b { color: blue; }', 'x.css');

  assert.deepEqual(
    rules.map((rule) => rule.selector),
    ['.a', '.b'],
  );
});

test('CSS parsing accepts unquoted url imports', async () => {
  const { parseCss } = await parser;
  const { imports } = parseCss('@import url(base.css);', 'x.css');

  assert.deepEqual(imports, ['base.css']);
});

test('conditional at-rules remain separate from unconditional cascade rules', async () => {
  const { parseCss } = await parser;
  const { resolveConflicts } = await cascade;
  const { rules } = parseCss(
    '@supports (display: grid) { .a { display: grid; } } .a { display: block; }',
    'x.css',
  );
  const ordered = rules.map((rule, orderIndex) => ({ ...rule, orderIndex }));

  assert.equal(rules[0].media, '@supports (display: grid)');
  assert.deepEqual(resolveConflicts(ordered), { canonical: [], ghosts: [] });
});

test('important declarations beat later non-important declarations', async () => {
  const { resolveConflicts } = await cascade;
  const declarations = (value, line) => [{ prop: 'color', value, line }];
  const rules = [
    {
      selector: '.a',
      declarations: declarations('red !important', 1),
      media: '',
      file: 'first.css',
      orderIndex: 0,
    },
    {
      selector: '.a',
      declarations: declarations('blue', 1),
      media: '',
      file: 'second.css',
      orderIndex: 1,
    },
  ];

  const result = resolveConflicts(rules);
  assert.equal(result.canonical[0].value, 'red !important');
  assert.equal(result.ghosts[0].value, 'blue');
});

test('important detection accepts values without whitespace before the suffix', async () => {
  const { resolveConflicts } = await cascade;
  const declarations = (value) => [{ prop: 'color', value, line: 1 }];
  const rules = [
    {
      selector: '.a',
      declarations: declarations('red!important'),
      media: '',
      layer: '',
      file: 'first.css',
      orderIndex: 0,
    },
    {
      selector: '.a',
      declarations: declarations('blue'),
      media: '',
      layer: '',
      file: 'second.css',
      orderIndex: 1,
    },
  ];

  assert.equal(resolveConflicts(rules).canonical[0].value, 'red!important');
});

test('unlayered normal declarations beat declarations inside a layer', async () => {
  const { parseCss } = await parser;
  const { resolveConflicts } = await cascade;
  const { rules, layers } = parseCss(
    '@layer components { .a { color: red; } } .a { color: blue; }',
    'x.css',
  );
  const layerIndexes = new Map(layers.map((layer, index) => [layer, index]));
  const ordered = rules.map((rule, orderIndex) => ({
    ...rule,
    layerIndex: rule.layer ? layerIndexes.get(rule.layer) : undefined,
    orderIndex,
  }));

  assert.equal(rules[0].layer, 'components');
  assert.equal(rules[0].media, '');
  assert.equal(resolveConflicts(ordered).canonical[0].value, 'blue');
});

test('important layer precedence reverses normal layer precedence', async () => {
  const { parseCss } = await parser;
  const { resolveConflicts } = await cascade;
  const { rules, layers } = parseCss(
    '@layer base, components; @layer base { .a { color: red!important; } } @layer components { .a { color: blue!important; } } .a { color: green!important; }',
    'x.css',
  );
  const layerIndexes = new Map(layers.map((layer, index) => [layer, index]));
  const ordered = rules.map((rule, orderIndex) => ({
    ...rule,
    layerIndex: rule.layer ? layerIndexes.get(rule.layer) : undefined,
    orderIndex,
  }));

  assert.equal(resolveConflicts(ordered).canonical[0].value, 'red!important');
});

test('layout tokens are categorized before sidebar tokens', async () => {
  const { categorize } = await emitter;

  assert.equal(categorize('--sidebar-width'), 'layout');
  assert.equal(categorize('--sidebar-bg'), 'sidebar');
});
