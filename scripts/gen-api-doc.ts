// Generate the API reference from the actual Nitro route files under
// server/api/v1. Method comes from the filename suffix (.get/.post/.patch/.delete),
// path from the folder structure ([x] → :x, index → the folder). Groups by the
// first path segment (domain). Outputs docs/api-reference.md + api-reference.html.
//
// Run (after the seam is complete): `npx tsx scripts/gen-api-doc.ts`.
import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = 'server/api/v1'
type Route = { method: string; path: string; group: string; file: string }
const routes: Route[] = []

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) { walk(full); continue }
    const m = name.match(/\.(get|post|patch|delete|put)\.ts$/)
    if (!m) continue
    const method = m[1].toUpperCase()
    const rel = relative(ROOT, full).replace(/\.(get|post|patch|delete|put)\.ts$/, '')
    // index → the folder itself; else the last segment is a path part.
    const segs = rel.split('/').filter(s => s !== 'index').map(s => s.replace(/^\[(.+)\]$/, ':$1'))
    const path = '/api/v1/' + segs.join('/')
    routes.push({ method, path, group: rel.split('/')[0], file: relative('.', full) })
  }
}
walk(ROOT)

routes.sort((a, b) => a.group.localeCompare(b.group) || a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
const byGroup = new Map<string, Route[]>()
for (const r of routes) (byGroup.get(r.group) ?? byGroup.set(r.group, []).get(r.group)!).push(r)

// ── Markdown ──
let md = `# API reference\n\nThe re-plumbed seam — every endpoint the client talks to, in place of direct DB\naccess. Generated from the route files; ${routes.length} endpoints across ${byGroup.size} groups.\n\nAll are versioned under \`/api/v1\`. List endpoints take \`?orgId=\` (or a parent id);\nwrites validate the request body against the domain's create/patch contract and\nreturn the entity validated against its read contract.\n`
for (const [g, rs] of byGroup) {
  md += `\n## ${g}\n\n| Method | Path |\n|---|---|\n`
  for (const r of rs) md += `| ${r.method} | \`${r.path}\` |\n`
}
mkdirSync('docs', { recursive: true })
writeFileSync('docs/api-reference.md', md)

// ── HTML ──
const methodColor: Record<string, string> = { GET: '#16a34a', POST: '#2563eb', PATCH: '#d97706', DELETE: '#dc2626', PUT: '#7c3aed' }
let rows = ''
for (const [g, rs] of byGroup) {
  rows += `<tr class="grp"><td colspan="2">${g}</td></tr>`
  for (const r of rs) rows += `<tr><td><span class="m" style="background:${methodColor[r.method] ?? '#555'}">${r.method}</span></td><td class="p">${r.path}</td></tr>`
}
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>API reference</title>
<style>body{font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;background:#f5f8fa;color:#1f2937;margin:0}
.wrap{max-width:900px;margin:0 auto;padding:28px 20px 80px}h1{font-size:22px}
p{color:#6b7280}table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e6ebf1;border-radius:12px;overflow:hidden}
td{padding:8px 14px;border-bottom:1px solid #f0f3f6}tr:last-child td{border-bottom:none}
.grp td{background:#2494D3;color:#fff;font-weight:700;text-transform:capitalize}
.m{display:inline-block;color:#fff;font-weight:700;font-size:11px;padding:2px 8px;border-radius:6px;min-width:52px;text-align:center}
.p{font-family:ui-monospace,Menlo,monospace;font-size:13px}</style></head>
<body><div class="wrap"><h1>API reference</h1><p>${routes.length} endpoints across ${byGroup.size} groups — the re-plumbed seam under <code>/api/v1</code>.</p><table>${rows}</table></div></body></html>`
writeFileSync('docs/api-reference.html', html)

console.log(`generated docs/api-reference.md + .html — ${routes.length} endpoints, ${byGroup.size} groups`)
