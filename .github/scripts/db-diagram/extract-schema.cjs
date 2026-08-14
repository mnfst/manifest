#!/usr/bin/env node
const { Client } = require('pg');

const SKIP_TABLES = new Set([
  'migrations',
  'typeorm_metadata',
]);

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const tablesRes = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const tables = {};
  for (const { table_name } of tablesRes.rows) {
    if (SKIP_TABLES.has(table_name)) continue;
    tables[table_name] = { columns: [], primaryKeys: [], foreignKeys: [] };
  }

  const colsRes = await client.query(`
    SELECT
      table_name,
      column_name,
      data_type,
      udt_name,
      is_nullable,
      character_maximum_length,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  for (const r of colsRes.rows) {
    if (!tables[r.table_name]) continue;
    tables[r.table_name].columns.push({
      name: r.column_name,
      type: formatType(r),
      nullable: r.is_nullable === 'YES',
    });
  }

  const pkRes = await client.query(`
    SELECT kcu.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
  `);
  for (const r of pkRes.rows) {
    if (!tables[r.table_name]) continue;
    tables[r.table_name].primaryKeys.push(r.column_name);
  }

  const fkRes = await client.query(`
    SELECT
      fr.relname AS from_table,
      a_from.attname AS from_column,
      tr.relname AS to_table,
      a_to.attname AS to_column
    FROM pg_constraint c
    JOIN pg_class fr ON fr.oid = c.conrelid
    JOIN pg_class tr ON tr.oid = c.confrelid
    JOIN unnest(c.conkey) WITH ORDINALITY AS ck(attnum, ord) ON true
    JOIN unnest(c.confkey) WITH ORDINALITY AS cf(attnum, ord) ON cf.ord = ck.ord
    JOIN pg_attribute a_from
      ON a_from.attrelid = c.conrelid AND a_from.attnum = ck.attnum
    JOIN pg_attribute a_to
      ON a_to.attrelid = c.confrelid AND a_to.attnum = cf.attnum
    WHERE c.contype = 'f'
      AND c.connamespace = 'public'::regnamespace
    ORDER BY fr.relname, ck.ord
  `);
  for (const r of fkRes.rows) {
    if (!tables[r.from_table]) continue;
    tables[r.from_table].foreignKeys.push({
      column: r.from_column,
      toTable: r.to_table,
      toColumn: r.to_column,
    });
  }

  await client.end();
  process.stdout.write(JSON.stringify({ tables }, null, 2));
}

function formatType(row) {
  const dt = row.data_type;
  if (dt === 'character varying') {
    return row.character_maximum_length ? `varchar(${row.character_maximum_length})` : 'varchar';
  }
  if (dt === 'numeric' && row.numeric_precision != null) {
    return row.numeric_scale != null
      ? `numeric(${row.numeric_precision},${row.numeric_scale})`
      : `numeric(${row.numeric_precision})`;
  }
  if (dt === 'USER-DEFINED') return row.udt_name;
  return dt;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
