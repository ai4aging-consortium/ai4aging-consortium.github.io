/* First-load assembly of the header mark and the hero text. The header tile
   rises, the letter settles, and the exponent square sits on the baseline and
   then rises to the superscript position (a squared), the one slow move.
   The hero sentence and lede rise in alongside it. Runs once per session. */
(function () {
  'use strict';
  var doc = document.documentElement;
  if (!doc.classList.contains('hero-anim')) return;

  // Reloaded part way down the page: show everything finished.
  if (window.scrollY > 200) { doc.classList.remove('hero-anim'); return; }

  var SETTLE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  var MOVE = 'cubic-bezier(0.65, 0, 0.35, 1)';
  var svg = document.querySelector('.brand-mark');
  if (!svg || !svg.animate) { doc.classList.remove('hero-anim'); return; }

  var tile = svg.querySelector('.m-tile');
  var letter = svg.querySelector('.m-letter');
  var exp = svg.querySelector('.m-exp');
  var name = document.querySelector('.brand span');
  var title = document.querySelector('.hero-title');
  var lede = document.querySelector('.hero-lede');
  var links = document.querySelector('.hero-links');

  function run(el, frames, opts) {
    return el.animate(frames, Object.assign({ fill: 'both' }, opts));
  }

  var anims = [];
  anims.push(run(tile, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { delay: 0, duration: 440, easing: SETTLE }));
  anims.push(run(letter, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { delay: 220, duration: 360, easing: SETTLE }));
  anims.push(run(exp, [{ opacity: 0 }, { opacity: 1 }], { delay: 420, duration: 100, easing: 'linear' }));
  // the rise: from sitting on the baseline (y 74) to the exponent position (y -29.5)
  anims.push(run(exp, [{ transform: 'translateY(103.5px)' }, { transform: 'translateY(0)' }], { delay: 500, duration: 600, easing: MOVE }));
  if (name) anims.push(run(name, [{ opacity: 0 }, { opacity: 1 }], { delay: 300, duration: 400, easing: SETTLE }));
  if (title) anims.push(run(title, [{ opacity: 0, transform: 'translateY(0.3em)' }, { opacity: 1, transform: 'none' }], { delay: 200, duration: 480, easing: SETTLE }));
  if (lede) anims.push(run(lede, [{ opacity: 0, transform: 'translateY(0.3em)' }, { opacity: 1, transform: 'none' }], { delay: 450, duration: 480, easing: SETTLE }));
  if (links) anims.push(run(links, [{ opacity: 0 }, { opacity: 1 }], { delay: 600, duration: 400, easing: SETTLE }));

  // The fill-backwards keyframes now cover the CSS start state.
  doc.classList.remove('hero-anim');

  var longest = anims[3];
  longest.onfinish = function () {
    try { sessionStorage.setItem('a2-hero', '1'); } catch (e) { /* storage blocked: play again next time */ }
    anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* ignore */ } });
  };
})();
