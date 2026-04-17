import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  if (!form || form.length === 0) {
    throw createError({ statusCode: 400, message: 'No file provided' })
  }

  const file = form[0]
  if (!file.data || !file.filename) {
    throw createError({ statusCode: 400, message: 'Invalid file' })
  }

  // Derive extension from original filename or content type
  const ext = file.filename.split('.').pop()?.toLowerCase() || 'jpg'
  const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
  if (!allowed.includes(ext)) {
    throw createError({ statusCode: 400, message: 'File type not allowed' })
  }

  const filename = `${randomUUID()}.${ext}`
  const uploadsDir = join(process.cwd(), 'public', 'uploads')

  await mkdir(uploadsDir, { recursive: true })
  await writeFile(join(uploadsDir, filename), file.data)

  return { url: `/uploads/${filename}` }
})
