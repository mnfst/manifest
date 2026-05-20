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
      tc.table_name AS from_table,
      kcu.column_name AS from_column,
      ccu.table_name AS to_table,
      ccu.column_name AS to_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
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
