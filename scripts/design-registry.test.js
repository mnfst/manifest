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

test('layout tokens are categorized before sidebar tokens', async () => {
  const { categorize } = await emitter;

  assert.equal(categorize('--sidebar-width'), 'layout');
  assert.equal(categorize('--sidebar-bg'), 'sidebar');
});
