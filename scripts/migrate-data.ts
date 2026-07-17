// Copy ALL data from the live Supabase Postgres into the MySQL `fm` database, so
// MySQL becomes a full working copy the migrated screens can run against. Generic:
// reads each public table and bulk-inserts, converting Postgres arrays and jsonb
// (which come back as JS arrays/objects) into JSON strings for MySQL json columns.
// FK constraints are omitted in the MySQL schema, so table order doesn't matter.
// Re-runnable: truncates each target table first.
//
// Run (from the worktree): `npx tsx scripts/migrate-data.ts`.
import { Client } from 'pg'
import mysql from 'mysql2/promise'

const PG = process.env.DATABASE_URL
const MY = process.env.MYSQL_URL ?? 'mysql://root:fmroot@127.0.0.1:3400/fm'

// Arrays + jsonb objects -> JSON string (MySQL json). Dates + scalars pass through.
function toMysql(v: any): any {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'object') return JSON.stringify(v)
  return v
}

async function main() {
  const pg = new Client({ connectionString: PG }); await pg.connect()
  const my = await mysql.createConnection(MY)
  await my.query('SET FOREIGN_KEY_CHECKS=0')

  const { rows: tables } = await pg.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
  )
  let totalRows = 0, copied = 0, skipped = 0
  for (const { table_name: t } of tables) {
    // A table not present in the MySQL schema (shouldn't happen — all 118 ported)
    // truncates-fails and is skipped rather than aborting the whole copy.
    try { await my.query(`TRUNCATE \`${t}\``) } catch { skipped++; continue }
    const { rows, fields } = await pg.query(`SELECT * FROM "${t}"`)
    if (!rows.length) { copied++; continue }
    const cols = fields.map(f => f.name)
    const colList = cols.map(c => `\`${c}\``).join(',')
    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const values = rows.slice(i, i + BATCH).map(r => cols.map(c => toMysql(r[c])))
      await my.query(`INSERT INTO \`${t}\` (${colList}) VALUES ?`, [values])
    }
    totalRows += rows.length; copied++
    if (rows.length) console.log(`  ${t}: ${rows.length}`)
  }
  await my.query('SET FOREIGN_KEY_CHECKS=1')
  await pg.end(); await my.end()
  console.log(`\ncopied ${totalRows} rows across ${copied} tables (${skipped} skipped)`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
