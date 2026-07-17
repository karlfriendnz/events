// Generate the first-pass MySQL Drizzle schema for ALL tables from the Postgres
// inventory, applying the porting rules in docs/replumb-architecture.md. This is a
// FIRST PASS: columns + primary keys + NOT NULL. Deferred to per-domain refinement
// as screens migrate: FK constraints, unique/secondary indexes, non-trivial column
// defaults, decimal precision, and any array that should become a join table
// rather than json. Defaults are handled in the repository layer for now (MySQL
// TEXT can't carry a default, and Postgres expression defaults don't port).
//
// Run: `npx tsx scripts/generate-mysql-schema.ts` → rewrites server/db/schema.ts.
import { readFileSync, writeFileSync } from 'node:fs'

type Col = {
  name: string; dataType: string; udt: string; nullable: boolean
  default: string | null; isArray: boolean
}
type Table = { columns: Col[]; primaryKey: string[] }

const inv: Record<string, Table> = JSON.parse(readFileSync('_pg_introspect/inventory.json', 'utf8'))

const camel = (s: string) => s.replace(/[_-](\w)/g, (_, c) => c.toUpperCase())
const isNowDefault = (d: string | null) => !!d && /now\(\)|CURRENT_TIMESTAMP/i.test(d)

// Postgres udt → a Drizzle mysql-core column expression (given the DB column name).
// PK-member columns MUST be bounded varchar — MySQL can't index a TEXT/JSON column
// without a prefix length, so a text column in a (composite) primary key fails DDL.
function colExpr(c: Col, isPk: boolean): { import: string; expr: string } {
  const n = `'${c.name}'`
  if (isPk) {
    const len = c.udt === 'uuid' ? 36 : 191
    return { import: 'varchar', expr: `varchar(${n}, { length: ${len} })` }
  }
  if (c.isArray) return { import: 'json', expr: `json(${n})` }
  switch (c.udt) {
    case 'uuid': return { import: 'varchar', expr: `varchar(${n}, { length: 36 })` }
    case 'text': return { import: 'text', expr: `text(${n})` }
    case 'jsonb':
    case 'json': return { import: 'json', expr: `json(${n})` }
    case 'int4': return { import: 'int', expr: `int(${n})` }
    case 'int2': return { import: 'smallint', expr: `smallint(${n})` }
    case 'bool': return { import: 'boolean', expr: `boolean(${n})` }
    case 'numeric': return { import: 'decimal', expr: `decimal(${n}, { precision: 12, scale: 2 })` }
    case 'timestamptz':
    case 'timestamp': return { import: 'timestamp', expr: `timestamp(${n})` }
    case 'date': return { import: 'date', expr: `date(${n})` }
    case 'time': return { import: 'time', expr: `time(${n})` }
    // varchar for anything short/unknown so it stays indexable.
    default: return { import: 'varchar', expr: `varchar(${n}, { length: 255 })` }
  }
}

const imports = new Set<string>()
const blocks: string[] = []

for (const table of Object.keys(inv).sort()) {
  const { columns, primaryKey } = inv[table]
  const singlePk = primaryKey.length === 1 ? primaryKey[0] : null
  const pkSet = new Set(primaryKey)
  const lines: string[] = []
  for (const c of columns) {
    const { import: imp, expr } = colExpr(c, pkSet.has(c.name))
    imports.add(imp)
    let e = expr
    if (c.name === singlePk) e += '.primaryKey()'
    if (!c.nullable && c.name !== singlePk) e += '.notNull()'
    if (isNowDefault(c.default) && (c.udt.startsWith('timestamp'))) e += '.defaultNow()'
    lines.push(`  ${camel(c.name)}: ${e},`)
  }
  // Composite primary key (a handful of join tables) at table level.
  let extra = ''
  if (primaryKey.length > 1) {
    imports.add('primaryKey')
    extra = `, (t) => [primaryKey({ columns: [${primaryKey.map(c => `t.${camel(c)}`).join(', ')}] })]`
  }
  blocks.push(`export const ${camel(table)} = mysqlTable('${table}', {\n${lines.join('\n')}\n}${extra})`)
}

const header = `// GENERATED first-pass MySQL schema (scripts/generate-mysql-schema.ts) from the live
// Postgres inventory. ${Object.keys(inv).length} tables. Porting rules per
// docs/replumb-architecture.md: uuid->varchar(36), text[]/uuid[]/int[]->json,
// jsonb->json, int4->int, numeric->decimal(12,2), bool->boolean, timestamptz->timestamp.
//
// FIRST PASS — deferred to per-domain refinement: FK constraints, secondary/unique
// indexes, non-now() column defaults (handled in repositories), decimal precision,
// and arrays that should be join tables. Hand-edit tables here as their domain is
// migrated; re-running the generator OVERWRITES, so refine by hand from here on.
import { mysqlTable, ${[...imports].sort().join(', ')} } from 'drizzle-orm/mysql-core'
`

writeFileSync('server/db/schema.ts', header + '\n' + blocks.join('\n\n') + '\n')
console.log(`generated server/db/schema.ts — ${Object.keys(inv).length} tables, imports: ${[...imports].sort().join(', ')}`)
