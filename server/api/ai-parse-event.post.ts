export default defineEventHandler(async (event) => {
  const { description } = await readBody(event)
  if (!description?.trim()) {
    throw createError({ statusCode: 400, message: 'Description is required' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw createError({ statusCode: 500, message: 'ANTHROPIC_API_KEY is not set' })
  }

  const today = new Date().toISOString().split('T')[0]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Today's date is ${today}. Parse the following event description and return a JSON object with these fields:

- title (string): A concise event title
- description (string): A brief event description, or empty string
- is_all_day (boolean): true if no specific time is mentioned
- start_date (string|null): ISO date "YYYY-MM-DD" of the next upcoming occurrence, or null if unclear
- start_time (string|null): "HH:MM" in 24h format, or null if not specified / all-day
- end_date (string|null): ISO date "YYYY-MM-DD", or null
- end_time (string|null): "HH:MM" in 24h format, or null
- repeat (string): one of "", "FREQ=DAILY", "FREQ=WEEKLY", "FREQ=MONTHLY" — pick the closest match
- location_type (string): one of "ADDRESS", "ONLINE" — default to "ADDRESS"
- venue_name (string): venue name if mentioned, else ""
- address (string): address if mentioned, else ""

Return ONLY valid JSON, no explanation or markdown.

Event description: "${description.trim()}"`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw createError({ statusCode: 502, message: `Anthropic error: ${err}` })
  }

  const data = await response.json() as any
  const raw: string = data.content?.[0]?.text?.trim() ?? ''
  const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')

  try {
    return JSON.parse(json)
  } catch {
    throw createError({ statusCode: 500, message: 'AI returned invalid JSON' })
  }
})
