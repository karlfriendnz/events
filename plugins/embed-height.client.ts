/**
 * TELL THE HOST HOW TALL WE ARE — on narrow screens only.
 *
 * Embedded, the module normally fits the frame and scrolls inside it: the
 * platform's chrome stays put and you get one scrollbar, ours. That is right on a
 * desktop and wrong on a phone, where it becomes a small window inside a small
 * window — two scrollbars, and the inner one is the one you don't want.
 *
 * On a narrow screen the answer is the opposite: let the module take its natural
 * height and let the PAGE be the only thing that scrolls. The host can't measure
 * us — different origin — so we have to say. `embed.php` has always listened for
 * this message; nothing ever sent it.
 *
 * Narrow-only by design. Reporting content height on a desktop is what made the
 * frame taller than the window and gave the platform its own scrollbar, which is
 * the bug this whole area keeps producing.
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return
  if (window.parent === window) return          // not embedded — nothing to report

  // WE ARE IN A FRAME — say so, here, on every page.
  //
  // This used to be set at the end of the /embed page's setup, AFTER it navigated
  // to the requested view — and navigating unmounts that page, so the lines after
  // it never ran. Any route with an early return (settings, a calendar, a person)
  // never got the class, which is why the embed-only styling kept "not working"
  // on some screens and working on others. A plugin runs on every page and can
  // simply test the condition, so nothing has to remember to set it.
  document.documentElement.classList.add('fm-embedded')

  const NARROW = 768
  const isNarrow = () => window.innerWidth < NARROW

  /** Let the shell grow instead of filling the viewport (see main.css). */
  function applyFlow() {
    document.documentElement.classList.toggle('fm-embed-flow', isNarrow())
  }

  let last = 0
  function report() {
    if (!isNarrow()) return
    // scrollHeight, not offsetHeight: the shell's children can overflow it while
    // the layout settles, and a short frame is a clipped page.
    const h = Math.ceil(Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight ?? 0,
    ))
    // A couple of pixels of jitter would otherwise ping the parent forever, and
    // each resize can trigger another measurement.
    if (!h || Math.abs(h - last) < 8) return
    last = h
    window.parent.postMessage({ type: 'fmevents:height', height: h }, '*')
  }

  applyFlow()
  window.addEventListener('resize', () => { applyFlow(); last = 0; report() })

  if (window.ResizeObserver && document.body) {
    new ResizeObserver(report).observe(document.body)
  }
  // Route changes swap the whole page; the observer catches it, but a first paint
  // after navigation can settle a frame later than the observer fires.
  const nuxt = useNuxtApp()
  nuxt.hook('page:finish', () => { last = 0; setTimeout(report, 50) })
  setTimeout(report, 100)
})
