/* =========================================================
   THE90 — the video on the league rules page

   The player is not in the markup: pressing play is what
   fetches it, so the page costs nothing until someone asks
   for the video. It then goes straight to fullscreen, and
   is torn down again on the way out so it cannot keep
   playing behind a screen you have left.
   ========================================================= */

(function () {
  'use strict';

  var host = document.querySelector('[data-video]');
  var poster = document.querySelector('[data-video-play]');
  if (!host || !poster) return;

  function fullscreen(node) {
    var go = node.requestFullscreen || node.webkitRequestFullscreen;
    if (!go) return;
    // Safari's returns nothing; Chrome's rejects if the gesture is not trusted
    var result = go.call(node);
    if (result && result.catch) result.catch(function () {});
  }

  function play() {
    if (host.querySelector('iframe')) return;

    var frame = document.createElement('iframe');
    frame.src = 'https://www.youtube-nocookie.com/embed/' + host.dataset.video +
      '?autoplay=1&rel=0&playsinline=1';
    frame.title = 'How points are counted';
    frame.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.setAttribute('allowfullscreen', '');
    frame.referrerPolicy = 'strict-origin-when-cross-origin';

    host.appendChild(frame);
    poster.hidden = true;
    fullscreen(host);
  }

  function stop() {
    var frame = host.querySelector('iframe');
    if (!frame) return;
    frame.remove();
    poster.hidden = false;
  }

  poster.addEventListener('click', play);

  window.addEventListener('the90:screen', function (event) {
    if (event.detail !== 'league-rules') stop();
  });
})();
