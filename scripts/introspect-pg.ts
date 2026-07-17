// Introspect the LIVE Supabase Postgres schema into a clean JSON inventory that the
// MySQL port is generated from. Reads information_schema (won't choke on complex
// defaults the way drizzle-kit pull did). Output: _pg_introspect/inventory.json.
//
// Run: `npx tsx scripts/introspect-pg.ts` (tsx auto-loads .env → DATABASE_URL).
import { Client } from 'pg'
import { mkdirSync, writeFileSync } from 'node:fs'

type Col = {
  table: string; name: string; pos: number
  dataType: string; udt: string; nullable: boolean; default: string | null
  isArray: boolean; elementType: string | null
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  const { rows: cols } = await client.query(`
    SELECT table_name, column_name, ordinal_position, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `)
  const { rows: pks } = await client.query(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
  `)
  await client.end()

  const pkByTable: Record<string, string[]> = {}
  for (const r of pks) (pkByTable[r.table_name] ??= []).push(r.column_name)

  const tables: Record<string, { columns: Col[]; primaryKey: string[] }> = {}
  for (const c of cols) {
    const t = (tables[c.table_name] ??= { columns: [], primaryKey: pkByTable[c.table_name] ?? [] })
    const isArray = c.data_type === 'ARRAY'
    t.columns.push({
      table: c.table_name, name: c.column_name, pos: c.ordinal_position,
      dataType: c.data_type, udt: c.udt_name, nullable: c.is_nullable === 'YES',
      default: c.column_default, isArray,
      // Array udt is the element type prefixed with '_' (e.g. _text, _uuid).
      elementType: isArray ? c.udt_name.replace(/^_/, '') : null,
    })
  }

  mkdirSync('_pg_introspect', { recursive: true })
  writeFileSync('_pg_introspect/inventory.json', JSON.stringify(tables, null, 2))

  // Summary — the shape of the porting job.
  const tableNames = Object.keys(tables).sort()
  const arrayCols = cols.filter(c => c.data_type === 'ARRAY')
  const jsonCols = cols.filter(c => c.udt_name === 'jsonb' || c.udt_name === 'json')
  const typeCounts: Record<string, number> = {}
  for (const c of cols) typeCounts[c.udt_name] = (typeCounts[c.udt_name] ?? 0) + 1
  console.log(`tables: ${tableNames.length}`)
  console.log(`columns: ${cols.length}`)
  console.log(`ARRAY columns (-> json/join): ${arrayCols.length}`)
  console.log(`jsonb/json columns (-> json): ${jsonCols.length}`)
  console.log('\nudt type counts:')
  for (const [t, n] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) console.log(`  ${t.padEnd(28)} ${n}`)
  console.log('\narray columns:')
  for (const c of arrayCols) console.log(`  ${c.table_name}.${c.column_name}  (${c.udt_name})`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
