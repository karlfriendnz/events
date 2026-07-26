// POST /api/v1/reviews/brief — write the open review comments out as a task
// brief at docs/review-tasks.md, and return the markdown.
//
// This is the "hand it to Claude" button. It writes a FILE rather than just
// returning text so the brief survives the tab closing and can be re-read
// mid-job; Karl then just says "do the review tasks".
//
// DEV-GATED like the other tools that touch the working tree: writing into the
// repo from an HTTP request has no business existing on a deployed instance.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { listOpenComments, markCommentsQueued } from '../../../db/repositories/reviews'
import { buildBriefMarkdown } from '../../../utils/reviewBrief'
import { buildBriefInputSchema, briefResultSchema } from '../../../../shared/contracts/review'

const BRIEF_PATH = 'docs/review-tasks.md'

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_SEED !== '1') {
    throw createError({ statusCode: 403, statusMessage: 'review brief export is dev-only' })
  }
  const { orgId, path, ids } = buildBriefInputSchema.parse(await readBody(event))

  // THE GATE, enforced server-side rather than by the client's selection: a
  // comment nobody has approved is a suggestion, and a suggestion must never
  // reach an agent as work. Replies ride along on an approved parent.
  //
  // A comment that @MENTIONS someone is a QUESTION FOR THAT PERSON, not work for
  // Claude ("@Kate should this be charged?"). It belongs to the human named in
  // it, so it's kept out of the brief entirely — even when explicitly picked,
  // because ticking a comment and then sending it shouldn't quietly hand
  // Kate's question to an agent. (A reply that @mentions someone doesn't pull
  // its parent out — the parent is still real work; only a mention on the ROOT
  // comment reroutes it.)
  const open = await listOpenComments(orgId)
  const forAPerson = (c: any) => Array.isArray(c.mentions) && c.mentions.length > 0
  const readyIds = new Set(open.filter(c => c.ready).map(c => c.id))
  const all = open.filter(c =>
    (c.ready && !(c.parentId == null && forAPerson(c)))
    || (c.parentId && readyIds.has(c.parentId)))
  // Both filters must keep replies whose PARENT survived, or the clarification
  // that makes an item actionable is silently dropped from the brief.
  let comments = all
  if (ids?.length) {
    const picked = new Set(ids)
    comments = all.filter(c => picked.has(c.id) || (c.parentId && picked.has(c.parentId)))
  } else if (path) {
    comments = all.filter(c => c.path === path || all.some(p => p.id === c.parentId && p.path === path))
  }

  const { markdown, taskCount, pageCount } = buildBriefMarkdown(comments, { orgId, path })

  const file = join(process.cwd(), BRIEF_PATH)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, markdown, 'utf8')

  // Stamp what was handed over. Two reasons: the panel can show "sent, not
  // started" instead of it looking identical to untouched work, and the agent
  // has a durable record of the batch that survives the file being regenerated.
  await markCommentsQueued(comments.filter(c => !c.parentId).map(c => c.id))

  return briefResultSchema.parse({ file: BRIEF_PATH, taskCount, pageCount, markdown })
})
