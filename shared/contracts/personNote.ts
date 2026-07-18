// The WRITE contract for a person note. The READ shape (PersonNote) lives in
// circle.ts (the circles/people-links domain owns note reads); this adds just the
// create input, so the profile page's "add note" action has a typed seam without
// the circles contract growing a write shape. Lives in shared/ so client + server
// import the same definition.
import { z } from 'zod'

export const personNoteCreateSchema = z.object({
  orgId: z.string().min(1),
  personId: z.string().min(1),
  body: z.string().min(1),
  // A note can be pinned to other parts of the app ({ type, id, label }) — passthrough.
  links: z.array(z.any()).optional(),
  // Who may see the note (per-target scoping); the repo derives `visibility` from the
  // first target when not given explicitly.
  visibleTo: z.array(z.any()).optional(),
  visibility: z.string().optional(),
  isImportant: z.boolean().optional(),
  // ISO date (yyyy-mm-dd) or null — a follow-up due date.
  dueDate: z.string().nullable().optional(),
  // How the interaction happened (In person / Phone / Email…). Free text.
  channel: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  authorId: z.string().nullable().optional(),
  authorName: z.string().nullable().optional(),
})
export type PersonNoteCreate = z.infer<typeof personNoteCreateSchema>
