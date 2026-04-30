export default defineEventHandler((event) => {
  const url = event.node.req.url ?? ''
  if (url.startsWith('/book')) {
    setResponseHeader(event, 'X-Frame-Options', 'ALLOWALL')
    setResponseHeader(event, 'Content-Security-Policy', "frame-ancestors *")
  }
})
