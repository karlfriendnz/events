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
    /* Fill what is left below the platform's header. The module scrolls
       internally, so the page itself must not scroll as well. */
    height: calc(100vh - 110px);
    min-height: 500px;
    border: 0;
}
/* Inside a profile tab it sits in a panel, so it needs a contained height. */
.tab-pane .fmevents-embed { margin: 0; }
.tab-pane .fmevents-embed iframe { height: 70vh; min-height: 420px; }
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

// The module tells us how tall it actually is, so the frame does not end up
// with its own scrollbar inside the platform's.
window.addEventListener('message', function (e) {
    if (e.origin !== <?= json_encode(parse_url($fmEventsBase, PHP_URL_SCHEME).'://'.parse_url($fmEventsBase, PHP_URL_HOST).(parse_url($fmEventsBase, PHP_URL_PORT) ? ':'.parse_url($fmEventsBase, PHP_URL_PORT) : '')) ?>) return;
    if (!e.data || e.data.type !== 'fmevents:height') return;
    var frame = document.getElementById(<?= json_encode($frameID) ?>);
    if (frame && e.data.height > 0) frame.style.height = e.data.height + 'px';
});
</script>
