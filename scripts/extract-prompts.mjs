// Extracts every prompt typed into Claude Code on this project into docs/prompt-history.md.
// Reads the local session transcripts (~/.claude/projects/<project-dir>) — run it on the
// machine whose prompts you want to export, then commit the regenerated markdown.
//   node scripts/extract-prompts.mjs [output.md]
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(os.homedir(), '.claude', 'projects', REPO.replace(/[/.]/g, '-'))
const OUT = process.argv[2] || path.join(REPO, 'docs', 'prompt-history.md')

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.jsonl'))
const sessions = []

for (const f of files) {
  const prompts = []
  let firstTs = null
  const lines = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    let j
    try { j = JSON.parse(line) } catch { continue }
    if (j.type !== 'user' || j.isMeta) continue
    const msg = j.message
    if (!msg || msg.role !== 'user') continue
    let text = ''
    if (typeof msg.content === 'string') text = msg.content
    else if (Array.isArray(msg.content)) {
      const parts = msg.content.filter(p => p.type === 'text').map(p => p.text)
      if (!parts.length) continue // tool results only
      text = parts.join('\n')
    }
    if (!text) continue
    // strip harness noise
    text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim()
    if (!text) continue
    if (/^<(command-name|command-message|local-command-stdout|bash-input|bash-stdout|bash-stderr)/.test(text)) continue
    if (text.startsWith('Caveat:')) continue
    if (text.startsWith('[Request interrupted')) continue
    // strip inline base64 payloads + cap very long pasted content
    text = text.replace(/data:[a-z/+.-]+;base64,[A-Za-z0-9+/=]+/g, '[base64 data removed]')
    const CAP = 3000
    if (text.length > CAP) text = text.slice(0, CAP) + `\n… [truncated — ${text.length} chars total]`
    if (!firstTs && j.timestamp) firstTs = j.timestamp
    prompts.push({ ts: j.timestamp || '', text })
  }
  if (prompts.length) sessions.push({ file: f, firstTs: firstTs || '', prompts })
}

sessions.sort((a, b) => a.firstTs.localeCompare(b.firstTs))

let total = 0
let out = `# Prompt history — fm-events\n\nEvery prompt given to Claude Code on this project, extracted from local session transcripts.\nGrouped by session, oldest first. Regenerate with \`node scripts/extract-prompts.mjs\` (script lives in the repo).\n\n`
for (const s of sessions) {
  const date = s.firstTs ? s.firstTs.slice(0, 10) : 'unknown date'
  const time = s.firstTs ? s.firstTs.slice(11, 16) : ''
  out += `\n## Session ${date} ${time} (${s.prompts.length} prompts)\n\n`
  for (const p of s.prompts) {
    total++
    const t = p.ts ? p.ts.slice(11, 16) : ''
    // quote each prompt; keep multiline prompts intact
    out += `**${t}** — ${p.text.replace(/\n/g, '\n> ')}\n\n`
  }
}
out = out.replace('Grouped by session', `${sessions.length} sessions · ${total} prompts. Grouped by session`)

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, out)
console.log(`${sessions.length} sessions, ${total} prompts -> ${OUT}`)
