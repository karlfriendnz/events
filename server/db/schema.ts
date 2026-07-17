// The new platform's MySQL schema, authored in Drizzle. This file IS a deliverable:
// the backend team reads it as the canonical schema, and drizzle-kit turns it into
// real MySQL DDL + migrations.
//
// PORTING RULES (MySQL has no Postgres features the old Supabase schema leaned on):
//   • uuid PKs        → char(36), generated in app code (crypto.randomUUID) since
//                       MySQL can't default a uuid().
//   • text[] arrays   → json columns (or a join table when it needs to be queried
//                       relationally). NEVER a Postgres array — MySQL has none.
//   • jsonb           → json.
//   • recursive RPCs  → real recursive CTEs in the query layer, not db.rpc().
//
// Start small and grow table-by-table (Phase 1). `organisations` first because the
// whole governing model hangs off the org tree.
import { mysqlTable, varchar, timestamp, index } from 'drizzle-orm/mysql-core'

export const organisations = mysqlTable('organisations', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }),
  // CLUB | REGIONAL | ASSOCIATION | NATIONAL | RST — a plain string, validated by
  // the Zod contract at the API boundary rather than a DB enum (portable, and the
  // set changes without a migration).
  orgLevel: varchar('org_level', { length: 32 }).notNull().default('CLUB'),
  parentId: varchar('parent_id', { length: 36 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('organisations_parent_idx').on(t.parentId),
])

export type OrganisationRow = typeof organisations.$inferSelect
export type OrganisationInsert = typeof organisations.$inferInsert
