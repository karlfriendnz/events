<?php
/**
 * Renders the new FM Events module in place of a legacy page.
 *
 * The module is a separate application. This mints a short-lived, single-use
 * login token with the platform's own mechanism (the same 'app' token type
 * ClubDB::main() already accepts on ?logintoken=) and hands it over in the
 * iframe URL. The module exchanges it once, server side, via
 * /api/v1/fmevents/whoami and then holds its own session.
 *
 * Switched on per club by the `fmevents-url` setting. With that setting empty,
 * nothing here runs and every legacy events page behaves exactly as before —
 * which is the rollback.
 *
 * Context comes in through $GLOBALS['FMEVENTS'] because a switch.php runs
 * inside FMPage::__construct, so plain variables set there never reach here.
 */

$fmEventsBase = rtrim($CLUB_DB->setting('fmevents-url'), '/');
$context = $GLOBALS['FMEVENTS'] ?? [];

if (!$fmEventsBase) {
    echo '<div class="alert alert-warning">The events module is not configured for this club.</div>';
    return;
}

$token = Person::current()->generateAuthToken('app', time() + 300);

$query = array_filter([
    'club'       => CLUB_NAME,
    'logintoken' => $token,
    'view'       => $context['view'] ?? 'calendar',
    'person'     => $context['person'] ?? null,
    'event'      => $context['event'] ?? null,
    // One pinned calendar, from a menu item in this platform's own shell.
    'calendar'   => $context['calendar'] ?? null,
], fn($v) => $v !== null && $v !== '');

$src = $fmEventsBase.'/embed?'.http_build_query($query);
$frameID = 'fmevents-'.substr(md5($src), 0, 8);
?>
<div class="fmevents-embed">
    <iframe id="<?= $frameID ?>" src="<?= e($src) ?>"
            title="Events"
            allow="clipboard-write"
            referrerpolicy="same-origin"></iframe>
</div>

<style>
.fmevents-embed { margin: -15px -15px 0; }
.fmevents-embed iframe {
    display: block;
    width: 100%;
    border: 0;
    /* A FALLBACK only. The real height is measured in JS below, because any
       fixed `calc(100vh - n)` is a guess at the chrome above the frame — and
       guessing high is what produced TWO scrollbars: the page scrolled because
       the frame overflowed it, while the module scrolled inside the frame. */
    height: calc(100vh - 110px);
    min-height: 420px;
}
/* Inside a tab (a profile's Events, Settings' Events) there is a tab strip above
   it too. Same story — the measurement below is what actually sizes it. */
.tab-pane .fmevents-embed { margin: 0; }
.tab-pane .fmevents-embed iframe { height: calc(100vh - 160px); }
/* Phone: height comes from the module (postMessage below), so the CSS must not
   pin it to the viewport — that is what nested the two scrollbars. */
@media (max-width: 767px) {
    .fmevents-embed iframe,
    .tab-pane .fmevents-embed iframe { height: auto; min-height: 60vh; }
}
</style>

<script>
// Coming BACK to this page restores it from the browser's back/forward cache
// with the iframe still pointing at the login token minted the first time —
// and that token is single-use, so the module would load into "invalid or
// expired login token". Reload so PHP mints a fresh one.
window.addEventListener('pageshow', function (e) {
    if (e.persisted) window.location.reload();
});

// Belt and braces: if the module still ends up with a spent token (a browser
// that restores without firing the above), it asks us to re-issue one. Guarded
// so a genuinely broken connection cannot become a reload loop.
window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'fmevents:reauth') return;
    if (sessionStorage.getItem('fmevents_reauthed')) return;
    sessionStorage.setItem('fmevents_reauthed', '1');
    window.location.reload();
});
window.addEventListener('load', function () {
    // A clean load means the token worked; allow one retry again next time.
    setTimeout(function () { sessionStorage.removeItem('fmevents_reauthed'); }, 5000);
});

// SIZING THE FRAME. One rule per screen size, and they are opposites — which is
// the whole point, because a single rule produces two scrollbars on one of them.
//
// WIDE: fit the frame to the space actually left below its own top edge, and let
// the module scroll inside it. The platform's chrome stays put. Measured, never a
// fixed `calc(100vh - n)`: that is a guess at the header, tab strip and padding
// above the frame, it differs between a full page and a tab, and guessing high
// overflows the page — so the page scrolls AND the module scrolls.
//
// NARROW: the opposite. Fitting a phone-sized frame inside a phone-sized page is a
// small scrolling window inside a small scrolling page, and the inner one is the
// one your thumb lands on. So the frame GROWS to the module's own height and this
// page does the scrolling. We cannot measure that across origins, so the module
// reports it (`fmevents:height`, listener at the bottom).
(function () {
    var id = <?= json_encode($frameID) ?>;
    // Anything the platform PINS over the bottom of the window covers the bottom
    // of the frame — and the module puts its primary actions there (Save, Create
    // calendar), so they end up behind it and unclickable. The trial banner is
    // fixed, 48px on desktop and 36px on mobile, so measure it rather than
    // hardcoding either. Add to this list if another pinned bar ever appears.
    function bottomOverlap() {
        var ids = ['fm_signUpBottom'];
        var h = 0;
        for (var i = 0; i < ids.length; i++) {
            var el = document.getElementById(ids[i]);
            if (!el) continue;
            var s = window.getComputedStyle(el);
            if (s.position !== 'fixed' || s.display === 'none') continue;
            h = Math.max(h, el.getBoundingClientRect().height);
        }
        return h;
    }
    // On a phone the frame GROWS to its content and this page does the scrolling —
    // fitting it to the viewport there gives a small scrolling window inside a small
    // scrolling page, which is two scrollbars and the wrong one under your thumb.
    // The module reports its height (see the message listener below); we can't
    // measure it ourselves across origins.
    var NARROW = 768;
    function narrow() { return window.innerWidth < NARROW; }

    /** Whatever actually scrolls around the frame — the container, or the page. */
    function scrollParent(el) {
        for (var n = el.parentElement; n; n = n.parentElement) {
            var o = window.getComputedStyle(n).overflowY;
            if (o === 'auto' || o === 'scroll') return n;
        }
        return document.scrollingElement || document.documentElement;
    }

    function fit() {
        if (narrow()) return;                        // the module's own height wins
        var frame = document.getElementById(id);
        if (!frame || !frame.offsetParent) return;   // hidden tab — sized when shown

        // First pass: fill what's left of the viewport below the frame's top edge.
        // Viewport-relative throughout — innerHeight and a fixed banner are both
        // measured that way, so the frame's top must be too.
        var top = frame.getBoundingClientRect().top;
        var h = Math.max(420, window.innerHeight - top - bottomOverlap() - 12);
        frame.style.height = h + 'px';

        // Second pass: SHRINK BY WHATEVER STILL OVERFLOWS.
        //
        // The first pass assumes nothing sits below the frame, and something always
        // does — the container's own bottom padding, a footer, a margin. Each one is
        // another number to guess at, and every guess so far has been the cause of a
        // second scrollbar. So stop guessing: ask what actually overflowed and take
        // exactly that much off. Self-correcting, whatever the chrome turns out to be.
        var sc = scrollParent(frame);
        var over = sc.scrollHeight - sc.clientHeight;
        if (over > 0) frame.style.height = Math.max(420, h - over) + 'px';
    }
    window.addEventListener('load', fit);
    window.addEventListener('resize', fit);
    document.addEventListener('DOMContentLoaded', fit);

    // A tab has no size until it is shown, and `shown.bs.tab` only fires when
    // somebody CLICKS one. Landing on /people/610#events selects the tab from the
    // hash without any click, so fit() ran while the frame was still hidden, bailed,
    // and left the CSS fallback in place — a frame taller than the space it had, and
    // therefore two scrollbars. Watch instead of waiting to be told.
    if (window.jQuery) jQuery(document).on('shown.bs.tab', fit);
    window.addEventListener('hashchange', fit);
    if (window.ResizeObserver) {
        var frame = document.getElementById(id);
        if (frame && frame.parentNode) new ResizeObserver(fit).observe(frame.parentNode);
    }
    // Belt and braces for the first paint: a few cheap retries until it is visible,
    // then stop. Nothing here loops forever.
    var tries = 0;
    var poll = setInterval(function () {
        var f = document.getElementById(id);
        if (f && f.offsetParent) { fit(); clearInterval(poll); }
        else if (++tries > 20) clearInterval(poll);
    }, 100);

    // NARROW SCREENS: the module tells us how tall it is and we grow to fit, so
    // this page is the only thing that scrolls. Ignored on a desktop — growing the
    // frame to its content there is exactly what made the platform scroll behind a
    // module that was already scrolling.
    window.addEventListener('message', function (e) {
        if (e.origin !== <?= json_encode(parse_url($fmEventsBase, PHP_URL_SCHEME).'://'.parse_url($fmEventsBase, PHP_URL_HOST).(parse_url($fmEventsBase, PHP_URL_PORT) ? ':'.parse_url($fmEventsBase, PHP_URL_PORT) : '')) ?>) return;
        if (!e.data || e.data.type !== 'fmevents:height') return;
        if (!narrow()) return;
        var frame = document.getElementById(id);
        if (frame && e.data.height > 0) frame.style.height = e.data.height + 'px';
    });
})();
</script>
