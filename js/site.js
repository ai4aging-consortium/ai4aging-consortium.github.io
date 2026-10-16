/* Header state, phone menu, scroll spy, white papers reveal, film link and sound button. */
(function () {
  'use strict';
  var doc = document.documentElement;
  var header = document.getElementById('header');

  // Header border is a state: it appears once the page has scrolled.
  function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Phone menu: a text button that opens a sheet of the same links.
  var menuBtn = document.querySelector('.menu-button');
  var nav = document.getElementById('site-nav');
  // The open sheet fills the viewport under the header and the page stops scrolling.
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    doc.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Menu';
  }
  function closeMenu() { setMenu(false); }
  menuBtn.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
  window.matchMedia('(min-width: 768px)').addEventListener('change', function (m) { if (m.matches) closeMenu(); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { closeMenu(); menuBtn.focus(); }
  });

  // Scroll spy: the section crossing the upper third of the viewport owns the underline.
  var links = Array.prototype.slice.call(nav.querySelectorAll('a[data-spy]'));
  var sections = links.map(function (a) { return document.getElementById(a.getAttribute('data-spy')); });
  function spy() {
    var line = window.innerHeight * 0.35;
    var current = null;
    sections.forEach(function (s, i) {
      if (!s) return;
      var r = s.getBoundingClientRect();
      if (r.top <= line && r.bottom > line) current = i;
    });
    links.forEach(function (a, i) { a.classList.toggle('is-current', i === current); });
  }
  var spyQueued = false;
  window.addEventListener('scroll', function () {
    if (spyQueued) return;
    spyQueued = true;
    requestAnimationFrame(function () { spyQueued = false; spy(); });
  }, { passive: true });
  spy();

  // White papers: overview first, then the four theme papers together. Once.
  var list = document.getElementById('paper-list');
  if (list && doc.classList.contains('motion') && 'IntersectionObserver' in window) {
    var r = list.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.8) {
      list.classList.add('reveal-pending');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            list.classList.remove('reveal-pending');
            io.disconnect();
          }
        });
      }, { threshold: 0.2 });
      io.observe(list);
    }
  }

  // The film shows its poster and one play button; native controls appear once it plays.
  // It starts muted; a "Turn sound on" button shows while it plays without sound.
  var video = document.getElementById('film-video');
  var playBtn = document.querySelector('.film-play');
  var soundBtn = document.querySelector('.film-sound');
  function syncSound() {
    if (!video || !soundBtn) return;
    var started = !video.paused || video.currentTime > 0;
    soundBtn.hidden = !(started && video.muted);
  }
  if (video && soundBtn) {
    video.muted = true;
    soundBtn.addEventListener('click', function () {
      video.muted = false;
      if (video.volume === 0) video.volume = 1;
      syncSound();
      video.focus({ preventScroll: true });
    });
    ['play', 'pause', 'volumechange', 'ended'].forEach(function (ev) { video.addEventListener(ev, syncSound); });
  }
  function startFilm() {
    if (!video) return;
    video.setAttribute('controls', '');
    if (playBtn) playBtn.hidden = true;
    try {
      var p = video.play();
      if (p && p.catch) p.catch(function () { /* file missing or blocked: controls remain */ });
    } catch (err) { /* ignore */ }
    video.focus({ preventScroll: true });
  }
  if (video && playBtn) {
    video.removeAttribute('controls');
    playBtn.hidden = false;
    playBtn.addEventListener('click', startFilm);
    video.addEventListener('play', function () { video.setAttribute('controls', ''); playBtn.hidden = true; });
  }
  // "Watch the film" scrolls to the film and starts it (a user action, not autoplay).
  var filmLink = document.querySelector('[data-play-film]');
  if (filmLink && video) {
    filmLink.addEventListener('click', function () { setTimeout(startFilm, 450); });
  }
})();
