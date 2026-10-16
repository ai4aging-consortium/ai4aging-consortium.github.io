/* The community scene.
   Scroll picks the beat; inside a beat the motion runs on time, so squares
   move at an even 180 diagram units per second however fast the reader
   scrolls. Three modes:
     live   the stage pins and the six captions swap in place;
     flow   the figure sticks under the header with the active caption under
            it; invisible caption spacers below drive the beats (phones with
            browser chrome, short laptops);
     static no JavaScript, reduced motion, or labels under 12 px: the final
            diagram and a numbered list.
   Before its beat an element is hidden, except the community frame and the
   member squares (faint from the start) and the outcome label on the right
   (shown at 30% from beat 1, so the reader sees where the work leads). */
(function () {
  'use strict';
  var doc = document.documentElement;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var PRE_KEEP = 0.2;       // community frame and member squares before beat 1
  var PREVIEW = 0.3;        // the outcome label from beat 1 until beat 6
  var SPEED = 180;          // diagram units per second
  var RAMP = 60;            // ms of eased start and stop

  /* ---------- easing ---------- */
  function bezier(x1, y1, x2, y2) {
    function a(p1, p2) { return 1 - 3 * p2 + 3 * p1; }
    function b(p1, p2) { return 3 * p2 - 6 * p1; }
    function c(p1) { return 3 * p1; }
    function calc(t, p1, p2) { return ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t; }
    function slope(t, p1, p2) { return 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1); }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 8; i++) {
        var s = slope(t, x1, x2);
        if (Math.abs(s) < 1e-6) break;
        t -= (calc(t, x1, x2) - x) / s;
      }
      t = Math.min(1, Math.max(0, t));
      return calc(t, y1, y2);
    };
  }
  var E = {
    settle: bezier(0.22, 1, 0.36, 1),
    move: bezier(0.65, 0, 0.35, 1),
    standard: bezier(0.2, 0, 0, 1),
    linear: function (t) { return t; }
  };
  function lerp(a, b, t) { return a + (b - a) * t; }
  function setOp(node, v) { if (node) node.style.opacity = v; }

  /* ---------- a pausable clock, one per figure ---------- */
  function Engine() {
    var en = { clock: 0, tasks: [], paused: false, onscreen: false, tabVisible: !document.hidden, reg: null };
    var last = 0, rafId = 0;
    function frame(now) {
      rafId = 0;
      var dt = last ? Math.min(now - last, 64) : 0;
      last = now;
      if (!en.paused && en.onscreen && en.tabVisible) {
        en.clock += dt;
        var list = en.tasks.slice();
        for (var i = 0; i < list.length; i++) {
          var k = list[i];
          if (k.done || en.clock < k.t0) continue;
          var p = k.dur > 0 ? Math.min(1, (en.clock - k.t0) / k.dur) : 1;
          if (k.fn) k.fn(k.ease ? k.ease(p) : p);
          if (p >= 1) { k.done = true; if (k.end) k.end(); }
        }
        en.tasks = en.tasks.filter(function (k) { return !k.done; });
      }
      if (en.tasks.length) rafId = requestAnimationFrame(frame);
      else last = 0;
    }
    en.kick = function () { if (!rafId) { last = 0; rafId = requestAnimationFrame(frame); } };
    en.tween = function (delay, dur, ease, fn, end) {
      var k = { t0: en.clock + delay, dur: dur, ease: ease, fn: fn, end: end, done: false };
      en.tasks.push(k);
      en.kick();
      return k;
    };
    en.at = function (delay, fn) { return en.tween(delay, 0, null, null, fn); };
    en.cancelAll = function () {
      en.tasks = [];
      if (en.reg && en.reg.tokens) en.reg.tokens.textContent = '';
    };
    document.addEventListener('visibilitychange', function () {
      en.tabVisible = !document.hidden;
      if (en.tabVisible) en.kick();
    });
    return en;
  }

  /* ---------- registry of diagram parts ---------- */
  function buildRegistry(svg) {
    var r = { svg: svg, els: {}, list: [], tokens: svg.querySelector('.tokens') };
    Array.prototype.forEach.call(svg.querySelectorAll('g.el'), function (g) {
      var e = {
        g: g, id: g.getAttribute('data-id'), kind: g.getAttribute('data-kind'),
        beat: +g.getAttribute('data-beat'), pillar: g.getAttribute('data-pillar'),
        line: g.querySelector('.line'), arrow: g.querySelector('.arrow'), field: g.querySelector('.field'),
        box: g.querySelector('.box'), solid: g.querySelector('.solid-fill'),
        shift: g.querySelector('.m-shift'), from: +(g.getAttribute('data-from') || 0),
        squares: Array.prototype.slice.call(g.querySelectorAll('.m-sq')),
        labels: Array.prototype.slice.call(g.querySelectorAll('text')),
        route: g.getAttribute('data-route'), lv: 1, preview: false
      };
      var id = e.id;
      e.pre = (id === 'community' || id === 'members_ai' || id === 'members_age') ? PRE_KEEP : 0;
      if (e.line && e.line.getTotalLength) {
        try { e.len = e.line.getTotalLength(); } catch (err) { e.len = 0; }
      }
      r.els[e.id] = e;
      r.list.push(e);
    });
    return r;
  }

  function setGroup(e, v) { e.g.style.opacity = v; }
  function setSolid(e, v) { if (e.solid) e.solid.style.transform = 'scaleY(' + v + ')'; }
  function setShift(e, p) { if (e.shift) e.shift.style.transform = 'translateX(' + (e.from * (1 - p)).toFixed(2) + 'px)'; }
  function labelFloor(e) { return e.preview ? PREVIEW : 0; }
  // One number per element: 0 = not yet introduced, 1 = shown.
  function setLevel(e, v) {
    e.lv = v;
    if (e.kind === 'members') {
      setGroup(e, 1);
      e.squares.forEach(function (s) { setOp(s, lerp(e.pre, 1, v)); });
      e.labels.forEach(function (t) { setOp(t, v); });
      setShift(e, v > 0.5 ? 1 : 0);
      return;
    }
    if (e.kind === 'label') {
      setGroup(e, 1);
      e.labels.forEach(function (t) { setOp(t, Math.max(v, labelFloor(e))); });
      return;
    }
    setGroup(e, lerp(e.pre, 1, v));
    e.labels.forEach(function (t) { setOp(t, v); });
    if (e.arrow) setOp(e.arrow, v);
    if (e.field) setOp(e.field, v);
    setSolid(e, v);
  }
  function resetStyles(r) {
    r.list.forEach(function (e) {
      e.lv = 1;
      e.g.style.opacity = '';
      if (e.line) { e.line.style.strokeDasharray = ''; e.line.style.strokeDashoffset = ''; e.line.style.strokeWidth = ''; }
      if (e.arrow) e.arrow.style.opacity = '';
      if (e.field) e.field.style.opacity = '';
      if (e.solid) e.solid.style.transform = '';
      if (e.box) e.box.style.strokeWidth = '';
      if (e.shift) e.shift.style.transform = '';
      e.squares.forEach(function (s) { s.style.opacity = ''; });
      e.labels.forEach(function (t) { t.style.opacity = ''; });
    });
  }

  /* ---------- shared motion helpers (bound to an engine) ---------- */
  function Motion(en) {
    var m = {};
    function fadeLabels(e, delay) {
      var from = labelFloor(e);
      e.labels.forEach(function (t) {
        setOp(t, from);
        en.tween(delay, 320, E.settle, function (p) { setOp(t, lerp(from, 1, p)); });
      });
    }
    m.introduce = function (id, delay) {
      var e = en.reg.els[id];
      if (!e) return;
      delay = delay || 0;
      e.lv = 1;
      if (e.kind === 'node' && e.solid) {
        // outline first, then the fill wipes up from the bottom edge, then the name
        en.tween(delay, 200, E.settle, function (p) { setGroup(e, lerp(e.pre, 1, p)); });
        en.tween(delay + 120, 360, E.move, function (p) { setSolid(e, p); });
        fadeLabels(e, delay + 360);
      } else if (e.kind === 'node') {
        en.tween(delay, 320, E.settle, function (p) { setGroup(e, lerp(e.pre, 1, p)); });
        fadeLabels(e, delay + 80);
      } else if (e.kind === 'label') {
        en.at(delay, function () { setGroup(e, 1); });
        fadeLabels(e, delay);
      } else if (e.kind === 'path' || e.kind === 'frame') {
        var dur = e.kind === 'frame' ? 900 : 480;
        en.at(delay, function () {
          setGroup(e, 1);
          e.line.style.strokeDasharray = e.len + ' ' + e.len;
          e.line.style.strokeDashoffset = String(e.len);
          if (e.arrow) setOp(e.arrow, 0);
        });
        fadeLabels(e, delay + 120);
        en.tween(delay, dur, e.kind === 'frame' ? E.move : E.settle, function (p) {
          e.line.style.strokeDashoffset = String(e.len * (1 - p));
        }, function () { e.line.style.strokeDasharray = 'none'; });
        if (e.arrow) en.tween(delay + dur, 120, E.linear, function (p) { setOp(e.arrow, p); });
      } else if (e.kind === 'field') {
        en.at(delay, function () { setGroup(e, 1); setOp(e.field, 0); });
        fadeLabels(e, delay + 240);
        en.tween(delay, 600, E.settle, function (p) { setOp(e.field, p); });
      } else if (e.kind === 'members') {
        // the two groups start at the frame's edges and meet in the middle
        en.at(delay, function () { setGroup(e, 1); setShift(e, 0); e.labels.forEach(function (t) { setOp(t, 0); }); });
        e.squares.forEach(function (s, i) {
          en.tween(delay + i * 30, 240, E.settle, function (p) { setOp(s, lerp(e.pre, 1, p)); });
        });
        en.tween(delay + 300, 1100, E.move, function (p) { setShift(e, p); });
        fadeLabels(e, delay + 1100);
      }
    };

    function routePath(e) {
      if (!e.route) return e.line;
      if (!e.routeEl) {
        var p = document.createElementNS(SVGNS, 'path');
        p.setAttribute('d', e.route);
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', 'none');
        en.reg.svg.insertBefore(p, en.reg.tokens);
        e.routeEl = p;
      }
      return e.routeEl;
    }
    // Trapezoid speed profile: eased 60 ms start and stop, constant speed between.
    m.travel = function (pathId, type, delay, onArrive) {
      var e = en.reg.els[pathId];
      if (!e) return;
      var path = routePath(e);
      var L = path.getTotalLength();
      var v = SPEED / 1000;
      var T = L / v + RAMP;
      var g = null;
      function place(s) {
        var pt = path.getPointAtLength(Math.max(0, Math.min(L, s)));
        g.setAttribute('transform', 'translate(' + pt.x.toFixed(2) + ' ' + pt.y.toFixed(2) + ')');
      }
      en.at(delay, function () {
        // contribution: tint with a navy edge; entry: solid navy; result: white with a navy edge and centre dot
        g = document.createElementNS(SVGNS, 'g');
        g.setAttribute('class', 'token t-' + type);
        var sq = document.createElementNS(SVGNS, 'rect');
        var inset = type === 'entry' ? 0 : 0.6;
        sq.setAttribute('x', -4 + inset); sq.setAttribute('y', -4 + inset);
        sq.setAttribute('width', 8 - 2 * inset); sq.setAttribute('height', 8 - 2 * inset);
        g.appendChild(sq);
        if (type === 'result') {
          var dot = document.createElementNS(SVGNS, 'rect');
          dot.setAttribute('class', 't-dot');
          dot.setAttribute('x', -1.5); dot.setAttribute('y', -1.5);
          dot.setAttribute('width', 3); dot.setAttribute('height', 3);
          g.appendChild(dot);
        }
        g.style.opacity = 0;
        en.reg.tokens.appendChild(g);
        place(0);
      });
      en.tween(delay, 120, E.linear, function (p) { if (g) g.style.opacity = p; });
      en.tween(delay, T, null, function (p) {
        if (!g) return;
        var t = p * T, s;
        if (t < RAMP) s = 0.5 * v * t * t / RAMP;
        else if (t > T - RAMP) { var u = T - t; s = L - 0.5 * v * u * u / RAMP; }
        else s = 0.5 * v * RAMP + v * (t - RAMP);
        place(s);
      }, function () {
        if (onArrive) onArrive();
        var r = g;
        en.tween(0, 120, E.linear, function (p) { if (r) r.style.opacity = 1 - p; }, function () { if (r && r.parentNode) r.parentNode.removeChild(r); });
      });
      return T;
    };

    m.thicken = function (id, delay, dur) {
      var e = en.reg.els[id];
      if (!e || !e.line) return;
      en.tween(delay, 120, E.standard, function (p) { e.line.style.strokeWidth = lerp(1.4, 2.2, p); });
      en.tween(delay + dur, 120, E.standard, function (p) { e.line.style.strokeWidth = lerp(2.2, 1.4, p); });
    };
    m.pulse = function (id) {
      var e = en.reg.els[id];
      if (!e || !e.box) return;
      en.tween(0, 360, E.linear, function (p) {
        var w = p < 0.5 ? lerp(1.4, 2.2, E.standard(p * 2)) : lerp(2.2, 1.4, E.standard((p - 0.5) * 2));
        e.box.style.strokeWidth = w;
      }, function () { e.box.style.strokeWidth = ''; });
    };
    return m;
  }

  var motionOK = doc.classList.contains('motion') && !!window.requestAnimationFrame;


  /* =================== community scene =================== */
  var section = document.getElementById('how');
  var scene = document.getElementById('scene');
  if (!section || !scene) return;

  var captionsEl = document.getElementById('captions');
  var captionItems = Array.prototype.slice.call(captionsEl.children);
  var hoverEl = section.querySelector('.caption-hover');
  var stepsBox = section.querySelector('.steps');
  var stepBtns = Array.prototype.slice.call(section.querySelectorAll('.step-buttons button'));
  var stepCount = section.querySelector('.step-count');
  var pauseBtn = section.querySelector('.pause');
  var figure = section.querySelector('.scene-figure');
  var legendRow = section.querySelector('.legend-row');
  var legendItems = Array.prototype.slice.call(section.querySelectorAll('.legend li'));
  var captionRow = section.querySelector('.caption-row');
  var flowCap = section.querySelector('.flow-cap');
  var BEAT_SVH = 55;        // scroll length of one beat in the live mode; site.css uses the same 55svh

  var DESCRIPTIONS = {
    community: 'Community. Open individual membership for researchers who build AI and researchers who study aging, with credit for logged contributions.',
    guidelines: 'Guidelines. Agreed rules for how AI studies of aging are built, evaluated and reported.',
    papers: 'White papers. An overview of the field and four theme papers that carry the guidelines and the field’s shared view.',
    datasets: 'Open datasets. Public aging data reprocessed and labeled for AI, with documented error rates.',
    models: 'Open models. Published aging models packaged to run on new data in a common format.',
    agents: 'AI agents. Software that plans and runs analyses and tests hypotheses, evaluated on the same tasks as models.',
    benchmark: 'Benchmark. Versioned tasks for comparing AI systems on the same data, which an independent evaluator will score.',
    index: 'Open index. A public list of AI systems for aging, each annotated with the evidence behind it.'
  };

  var en = Engine();
  var mo = Motion(en);
  var regs = {
    landscape: buildRegistry(section.querySelector('svg[data-layout="landscape"]')),
    portrait: buildRegistry(section.querySelector('svg[data-layout="portrait"]'))
  };
  var mqPortrait = window.matchMedia('(max-width: 1023px)');
  function activeReg() { return mqPortrait.matches ? regs.portrait : regs.landscape; }
  en.reg = activeReg();

  function contribRoutes() {
    var r = en.reg.els;
    return ['p_c_datasets', 'p_c_models', r.p_c_agents ? 'p_c_agents' : 'p_rise', 'p_c_bench', 'p_c_index'];
  }
  var EVIDENCE = ['p_e_datasets', 'p_e_models', 'p_e_agents', 'p_e_bench', 'p_e_index'];

  // Legend entries appear with the first beat that uses them.
  var LEGEND_BEAT = { ai: 1, age: 1, contrib: 3, result: 5 };
  function legendFor(b) {
    legendItems.forEach(function (li) {
      li.classList.toggle('is-off', b < (LEGEND_BEAT[li.getAttribute('data-key')] || 0));
    });
  }

  // The outcome label shows faintly from beat 1, so the destination is in view early.
  function setPreview(b) {
    [regs.landscape, regs.portrait].forEach(function (r) { if (r.els.research) r.els.research.preview = b >= 1; });
  }
  function setState(b, crossfade) {
    setPreview(b);
    en.reg.list.forEach(function (e) {
      var target = e.beat <= b ? 1 : 0;
      if (e.line) { e.line.style.strokeDasharray = 'none'; e.line.style.strokeDashoffset = '0'; e.line.style.strokeWidth = ''; }
      if (e.box) e.box.style.strokeWidth = '';
      if (crossfade && Math.abs(e.lv - target) > 0.01) {
        var from = e.lv;
        en.tween(0, 240, E.standard, function (p) { setLevel(e, lerp(from, target, p)); });
      } else {
        setLevel(e, target);
      }
    });
    legendFor(b);
  }

  /* ---------- beats ---------- */
  var BEATS = {
    1: function () {
      mo.introduce('community', 0);
      mo.introduce('members_ai', 200);
      mo.introduce('members_age', 200);
      var r = en.reg.els.research;
      if (r) en.tween(900, 480, E.settle, function (p) { r.labels.forEach(function (t) { setOp(t, PREVIEW * p); }); }, function () { setPreview(1); });
      return 1700;
    },
    2: function () {
      mo.introduce('guidelines', 0);
      return 900;
    },
    3: function () {
      ['p_rise', 'p_c_datasets', 'p_c_models', 'p_c_agents'].forEach(function (id) { mo.introduce(id, 0); });
      ['datasets', 'models', 'agents'].forEach(function (id, i) { mo.introduce(id, 200 + i * 80); });
      contribRoutes().slice(0, 3).forEach(function (id, i) { mo.travel(id, 'contrib', 500 + i * 120, function () { mo.pulse(['datasets', 'models', 'agents'][i]); }); });
      return 2600;
    },
    4: function () {
      mo.introduce('p_c_bench', 0);
      mo.introduce('p_c_index', 0);
      mo.introduce('benchmark', 200);
      mo.introduce('index', 280);
      mo.travel('p_c_bench', 'contrib', 700, function () { mo.pulse('benchmark'); });
      mo.travel('p_c_index', 'contrib', 820, function () { mo.pulse('index'); });
      return 2400;
    },
    5: function () {
      EVIDENCE.forEach(function (id) { mo.introduce(id, 0); });
      mo.introduce('papers', 300);
      EVIDENCE.forEach(function (id, i) { mo.travel(id, 'result', 700 + i * 90, i === 4 ? function () { mo.pulse('papers'); } : null); });
      return 3200;
    },
    6: function () {
      mo.introduce('p_out', 0);
      mo.introduce('research', 300);
      [500, 800, 1100].forEach(function (d) { mo.travel('p_out', 'result', d); });
      return 1800;
    }
  };

  // The whole cycle again, without caption changes.
  function idleCycle() {
    contribRoutes().forEach(function (id, i) { mo.travel(id, 'contrib', i * 110); });
    EVIDENCE.forEach(function (id, i) { mo.travel(id, 'result', 2600 + i * 90, i === 4 ? function () { mo.pulse('papers'); } : null); });
    [4800, 5100, 5400].forEach(function (d) { mo.travel('p_out', 'result', d); });
    en.at(8000, idleCycle);
  }

  /* ---------- interaction after the sequence ---------- */
  var interactive = false;
  function showDescription(p) {
    hoverEl.textContent = DESCRIPTIONS[p] || '';
    hoverEl.classList.add('is-on');
    captionsEl.classList.add('is-hover');
  }
  function hideDescription() {
    hoverEl.classList.remove('is-on');
    captionsEl.classList.remove('is-hover');
    if (section.classList.contains('scene-static')) hoverEl.textContent = '';
  }
  function setInteractive(on) {
    if (interactive === on) return;
    interactive = on;
    [regs.landscape, regs.portrait].forEach(function (r) {
      r.list.forEach(function (e) {
        if (!e.pillar) return;
        if (on) {
          e.g.setAttribute('tabindex', '0');
          e.g.setAttribute('role', 'button');
          e.g.setAttribute('aria-label', e.labels[0] ? e.labels[0].textContent : e.pillar);
          if (!e.ring) {
            var shape = e.box || e.field || e.line;
            var bb = { x: +shape.getAttribute('x'), y: +shape.getAttribute('y'), width: +shape.getAttribute('width'), height: +shape.getAttribute('height') };
            var pad = 4;
            var ring = document.createElementNS(SVGNS, 'rect');
            ring.setAttribute('class', 'focus-ring');
            ring.setAttribute('x', bb.x - pad); ring.setAttribute('y', bb.y - pad);
            ring.setAttribute('width', bb.width + 2 * pad); ring.setAttribute('height', bb.height + 2 * pad);
            ring.setAttribute('rx', 4);
            e.g.appendChild(ring);
            e.ring = ring;
          }
        } else {
          e.g.removeAttribute('tabindex');
          e.g.removeAttribute('role');
          e.g.removeAttribute('aria-label');
        }
      });
    });
    if (!on) hideDescription();
  }
  function bindHover(svg) {
    function pillarOf(t) {
      var g = t && t.closest ? t.closest('g.el[data-pillar]') : null;
      return g && g.hasAttribute('tabindex') ? g : null;
    }
        svg.addEventListener('pointerover', function (ev) {
      var g = pillarOf(ev.target);
      if (g) showDescription(g.getAttribute('data-pillar')); else if (interactive) hideDescription();
    });
    svg.addEventListener('pointerleave', hideDescription);
    svg.addEventListener('focusin', function (ev) {
      var g = pillarOf(ev.target);
      if (g) showDescription(g.getAttribute('data-pillar'));
    });
    svg.addEventListener('focusout', hideDescription);
  }
  bindHover(regs.landscape.svg);
  bindHover(regs.portrait.svg);

  var mode = null;
  var pauseHome = stepsBox;

  function setMode(m) {
    mode = m;
    section.classList.toggle('scene-live', m === 'live');
    section.classList.toggle('scene-flow', m === 'flow');
    section.classList.toggle('scene-static', m === 'static');
    stepsBox.hidden = m !== 'live';
    pauseBtn.hidden = m === 'static';
    // In the flow mode the active caption and the pause control sit inside the sticky figure.
    if (m === 'flow') {
      if (pauseBtn.parentNode !== figure) figure.insertBefore(pauseBtn, legendRow);
    } else if (pauseBtn.parentNode !== pauseHome) {
      pauseHome.appendChild(pauseBtn);
    }
  }

  function goStatic() {
    en.cancelAll();
    setMode('static');
    captionItems.forEach(function (li) { li.classList.remove('is-active'); li.removeAttribute('aria-current'); });
    legendItems.forEach(function (li) { li.classList.remove('is-off'); });
    resetStyles(regs.landscape);
    resetStyles(regs.portrait);
    en.reg = activeReg();
    interactive = false;
    setInteractive(true);
  }

  if (!motionOK) { goStatic(); return; }

  // Portrait labels are 13 units; under 12 px they are too small to animate.
  function labelsTooSmall() {
    if (!mqPortrait.matches) return false;
    var w = regs.portrait.svg.getBoundingClientRect().width;
    return w > 0 && (13 * w / 360) < 12;
  }
  function headerH() {
    var h = document.getElementById('header');
    return h ? h.offsetHeight : 64;
  }
  // The live mode needs the figure and the tallest caption inside one viewport.
  function liveFits() {
    var svg = activeReg().svg;
    var stageInner = section.querySelector('.stage-inner');
    var cs = getComputedStyle(stageInner);
    var need = svg.getBoundingClientRect().height + (legendRow.offsetHeight || 0) + captionRow.offsetHeight +
      parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.rowGap || cs.gap || 0) +
      parseFloat(getComputedStyle(figure).rowGap || 0);
    return need <= window.innerHeight - headerH();
  }

  var beat = 0, finished = false;

  function updateCaption(b) {
    var shown = Math.max(1, b) - 1;
    captionItems.forEach(function (li, i) {
      var on = i === shown;
      li.classList.toggle('is-active', on);
      if (on) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    if (flowCap) {
      flowCap.textContent = mode === 'flow' ? (shown + 1) + '. ' + captionItems[shown].textContent : '';
      if (mode === 'flow') pauseBtn.hidden = b < 1;
    }
    stepBtns.forEach(function (btn, i) {
      if (i === shown) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
      btn.classList.toggle('is-done', i < shown);
    });
    stepCount.textContent = (shown + 1) + ' of 6';
  }

  function playBeat(b) {
    en.cancelAll();
    setInteractive(false);
    finished = false;
    setState(b - 1, false);
    var dur = BEATS[b]();
    legendFor(b);
    if (b === 6) {
      en.at(dur, function () {
        finished = true;
        setInteractive(true);
        en.at(1200, idleCycle);
      });
    }
  }

  function segment() { return window.innerHeight * BEAT_SVH / 100; }
  function sceneTop() { return scene.getBoundingClientRect().top + window.scrollY; }
  function computeBeatLive() {
    var r = scene.getBoundingClientRect();
    var off = window.innerHeight * 0.45 - r.top;
    if (off < 0) return 0;
    return Math.min(6, Math.floor(off / segment()) + 1);
  }
  function computeBeatFlow() {
    var figB = figure.getBoundingClientRect().bottom;
    var line = figB + Math.max(0, window.innerHeight - figB) * 0.5;
    var b = 0;
    captionItems.forEach(function (li, i) { if (li.getBoundingClientRect().top < line) b = i + 1; });
    return b;
  }
  function computeBeat() { return mode === 'flow' ? computeBeatFlow() : computeBeatLive(); }

  function onBeat(nb) {
    if (nb === beat) return;
    var prev = beat;
    beat = nb;
    updateCaption(nb);
    if (nb > prev) {
      playBeat(nb);
    } else {
      en.cancelAll();
      setInteractive(false);
      finished = false;
      setState(nb, true);
      if (nb === 6) { finished = true; setInteractive(true); }
    }
  }

  var queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; if (mode !== 'static') onBeat(computeBeat()); });
  }

  function init() {
    en.cancelAll();
    en.reg = activeReg();
    if (labelsTooSmall()) { goStatic(); return; }
    setMode('live');
    if (!liveFits()) setMode('flow');
    if (mode === 'flow' && labelsTooSmall()) { goStatic(); return; }
    resetStyles(regs.landscape);
    resetStyles(regs.portrait);
    interactive = false;
    setInteractive(false);
    beat = computeBeat();
    // Arriving mid-scene (reload or anchor jump): show the end state of the current beat.
    setState(beat, false);
    updateCaption(beat);
    if (beat === 6) { finished = true; setInteractive(true); }
  }

  if (mqPortrait.addEventListener) mqPortrait.addEventListener('change', init);
  else if (mqPortrait.addListener) mqPortrait.addListener(init);

  window.addEventListener('scroll', onScroll, { passive: true });
  var lastW = window.innerWidth, lastH = window.innerHeight, resizeT = 0;
  window.addEventListener('resize', function () {
    // Phone toolbars change the height while scrolling; re-plan only on real changes.
    var dw = Math.abs(window.innerWidth - lastW), dh = Math.abs(window.innerHeight - lastH);
    if (dw < 1 && dh < 120) { onScroll(); return; }
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { lastW = window.innerWidth; lastH = window.innerHeight; init(); }, 150);
  });

  function jumpTo(top) {
    try { window.scrollTo({ top: top, behavior: 'instant' }); } catch (e) { window.scrollTo(0, top); }
  }
  function beatTop(i) {
    return sceneTop() + (i + 0.5) * segment() - window.innerHeight * 0.45;
  }

  // A step jumps straight to its beat and plays it.
  stepBtns.forEach(function (btn, i) {
    btn.addEventListener('click', function () {
      if (mode !== 'live') return;
      jumpTo(Math.max(beatTop(i), sceneTop() - headerH()));
      onScroll();
    });
  });

  pauseBtn.addEventListener('click', function () {
    en.paused = !en.paused;
    pauseBtn.innerHTML = (en.paused ? 'Play' : 'Pause') + '<span class="wide"> animation</span>';
    pauseBtn.setAttribute('aria-pressed', String(en.paused));
    if (!en.paused) en.kick();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (x) {
        var was = en.onscreen;
        en.onscreen = x.isIntersecting;
        if (en.onscreen && !was) {
          en.kick();
          if (finished && beat === 6 && mode !== 'static') { en.cancelAll(); setState(6, false); en.at(1200, idleCycle); }
        } else if (!en.onscreen && was && finished && mode !== 'static') {
          // the idle cycle stops until the scene is entered again
          en.cancelAll();
          setState(6, false);
        }
      });
    }, { threshold: 0 }).observe(scene);
  } else {
    en.onscreen = true;
  }

  init();
})();
