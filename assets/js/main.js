/* Naoya Segawa — personal page
   - JP / EN switch
   - two lines running through the whole page, drawn as you scroll
   - quiet fade-in for blocks below the fold
   - the local clock in Denmark
   - copy button, click-to-load YouTube
*/
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';

  function svgEl(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* ---------- language ---------- */

  var LANG_KEY = 'ns-lang';
  function readLang() { try { return localStorage.getItem(LANG_KEY); } catch (e) { return null; } }
  function saveLang(v) { try { localStorage.setItem(LANG_KEY, v); } catch (e) {} }

  function applyLang(l) {
    root.setAttribute('data-lang', l);
    root.lang = l;
    document.querySelectorAll('[data-set-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === l));
    });
    document.querySelectorAll('img[data-alt-' + l + ']').forEach(function (img) {
      img.alt = img.getAttribute('data-alt-' + l);
    });
  }

  var lang = readLang();
  if (lang !== 'ja' && lang !== 'en') {
    lang = 'en';
  }
  applyLang(lang);

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-set-lang]');
    if (!b) return;
    lang = b.getAttribute('data-set-lang');
    applyLang(lang);
    saveLang(lang);
  });

  /* ---------- the two lines ---------- */

  var story = document.querySelector('.story');
  var svg = story && story.querySelector('.threads');
  var clipRect, pathA, pathB, marks, gA, gB;
  var geo = { top: 0, H: 0 };

  function visible(n) { return n.getClientRects().length > 0; }

  function setupThreads() {
    var defs = svgEl('defs', {});
    gA = svgEl('linearGradient', { id: 'ns-ga', gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0, y1: 0, y2: 1 });
    gB = svgEl('linearGradient', { id: 'ns-gb', gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0, y1: 0, y2: 1 });
    var clip = svgEl('clipPath', { id: 'ns-reveal' });
    clipRect = svgEl('rect', { x: -400, y: 0, width: 5000, height: 0 });
    clip.appendChild(clipRect);
    defs.appendChild(gA); defs.appendChild(gB); defs.appendChild(clip);

    var g = svgEl('g', { 'clip-path': 'url(#ns-reveal)' });
    marks = svgEl('g', {});
    pathA = svgEl('path', { class: 't', stroke: 'url(#ns-ga)' });
    pathB = svgEl('path', { class: 't', stroke: 'url(#ns-gb)' });
    g.appendChild(marks); g.appendChild(pathA); g.appendChild(pathB);
    svg.appendChild(defs); svg.appendChild(g);
  }

  function layout() {
    var sRect = story.getBoundingClientRect();
    var sTop = sRect.top + window.scrollY;
    var sLeft = sRect.left;
    var H = story.offsetHeight;
    var W = story.clientWidth;
    geo.top = sTop; geo.H = H;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    var tw = parseFloat(getComputedStyle(story).getPropertyValue('--thread-w')) || 48;
    var gx = tw / 2;
    var sepScale = W < 700 ? 0.6 : 1;

    var keys = [];
    story.querySelectorAll('[data-sep]').forEach(function (n) {
      if (!visible(n)) return;
      var xs = W < 700 ? n.getAttribute('data-xm') : n.getAttribute('data-x');
      keys.push({
        y: n.getBoundingClientRect().top + window.scrollY - sTop,
        x: xs ? parseFloat(xs) * W : gx,
        sep: parseFloat(n.getAttribute('data-sep')) * sepScale,
        op: n.hasAttribute('data-op') ? parseFloat(n.getAttribute('data-op')) : 1
      });
    });
    if (!keys.length) return;
    keys.sort(function (a, b) { return a.y - b.y; });
    var y0 = keys[0].y;
    var last = keys[keys.length - 1];
    keys.push({ y: H, x: last.x, sep: last.sep, op: last.op });

    function at(y) {
      var i = 0;
      while (i < keys.length - 2 && y >= keys[i + 1].y) i++;
      var a = keys[i], b = keys[i + 1];
      var t = b.y > a.y ? Math.min(1, Math.max(0, (y - a.y) / (b.y - a.y))) : 0;
      t = t * t * (3 - 2 * t);
      return { x: a.x + (b.x - a.x) * t, sep: a.sep + (b.sep - a.sep) * t };
    }
    var amp = W < 700 ? 2.2 : 3.4;
    function cl(x) { return Math.max(1.5, Math.min(W - 1.5, x)); }
    function xa(y) { var p = at(y); return cl(p.x - p.sep / 2 + Math.sin(y / 210) * amp); }
    function xb(y) { var p = at(y); return cl(p.x + p.sep / 2 + Math.sin(y / 265 + 1.9) * amp); }
    function mid(y) { return (xa(y) + xb(y)) / 2; }

    var da = '', db = '';
    for (var y = y0; y <= H; y += 12) {
      var c = y === y0 ? 'M' : 'L';
      da += c + xa(y).toFixed(1) + ' ' + y.toFixed(0);
      db += c + xb(y).toFixed(1) + ' ' + y.toFixed(0);
    }
    da += 'L' + xa(H).toFixed(1) + ' ' + H;
    db += 'L' + xb(H).toFixed(1) + ' ' + H;
    pathA.setAttribute('d', da);
    pathB.setAttribute('d', db);

    [[gA, '--line-a'], [gB, '--line-b']].forEach(function (pair) {
      var g = pair[0];
      g.setAttribute('y2', H);
      while (g.firstChild) g.removeChild(g.firstChild);
      keys.forEach(function (k) {
        g.appendChild(svgEl('stop', {
          offset: Math.max(0, Math.min(1, k.y / H)),
          style: 'stop-color:var(' + pair[1] + ');stop-opacity:' + k.op
        }));
      });
    });

    while (marks.firstChild) marks.removeChild(marks.firstChild);

    function lineCenter(n) {
      var lh = parseFloat(getComputedStyle(n).lineHeight) || 28;
      var r = n.getBoundingClientRect();
      return { y: r.top + window.scrollY - sTop + lh / 2, left: r.left - sLeft };
    }

    // a small ring on the lines where each question sits
    story.querySelectorAll('.q-text').forEach(function (q) {
      if (!visible(q)) return;
      var p = lineCenter(q);
      if (p.y < y0) return;
      var m = mid(p.y);
      if (m > p.left - 10) return;
      marks.appendChild(svgEl('circle', { class: 'node', cx: m.toFixed(1), cy: p.y.toFixed(0), r: 3.4 }));
    });

    reveal();
  }

  // drawing: the visible length eases toward the reading position
  var shown = 0, target = 0, raf = 0;
  function computeTarget() {
    var max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    var p = Math.min(1, window.scrollY / max);
    return Math.max(0, window.scrollY + innerHeight * (0.84 + 0.16 * p) - geo.top + (p > 0.995 ? 400 : 0));
  }
  function step() {
    raf = 0;
    shown += (target - shown) * 0.075;
    if (Math.abs(target - shown) < 0.5) shown = target;
    clipRect.setAttribute('height', shown.toFixed(1));
    if (shown !== target) raf = requestAnimationFrame(step);
  }
  function reveal() {
    if (!clipRect) return;
    target = computeTarget();
    if (reduce) { clipRect.setAttribute('height', geo.H + 400); return; }
    if (!raf) raf = requestAnimationFrame(step);
  }

  if (svg) {
    setupThreads();
    window.addEventListener('scroll', reveal, { passive: true });
    window.addEventListener('resize', reveal);

    var pending = false;
    var schedule = function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; layout(); });
    };
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(story);
    else window.addEventListener('resize', schedule);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    window.addEventListener('load', schedule);
    layout();
  }

  /* ---------- contents ---------- */

  var toc = document.querySelector('.toc');
  if (toc) {
    var tocBtn = toc.querySelector('.toc-btn');
    var setOpen = function (open) {
      toc.classList.toggle('open', open);
      tocBtn.setAttribute('aria-expanded', String(open));
    };
    tocBtn.addEventListener('click', function () { setOpen(!toc.classList.contains('open')); });
    toc.querySelectorAll('.toc-list a').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('click', function (e) { if (!toc.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toc.classList.contains('open')) { setOpen(false); tocBtn.focus(); }
    });

    // mark the section being read
    var links = {};
    toc.querySelectorAll('.toc-list a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    if ('IntersectionObserver' in window) {
      var secIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          Object.keys(links).forEach(function (id) { links[id].removeAttribute('aria-current'); });
          var a = links[en.target.id];
          if (a) a.setAttribute('aria-current', 'true');
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      Object.keys(links).forEach(function (id) {
        var sec = document.getElementById(id);
        if (sec) secIO.observe(sec);
      });
    }
  }

  /* ---------- header name appears after the big one ---------- */

  var bigName = document.querySelector('.name');
  function headerState() {
    if (!bigName) return;
    root.classList.toggle('past-hero', bigName.getBoundingClientRect().bottom < 60);
  }
  window.addEventListener('scroll', headerState, { passive: true });
  headerState();

  /* ---------- quiet fade-in ---------- */

  if (!reduce && 'IntersectionObserver' in window) {
    var targets = document.querySelectorAll(
      '.grid2 > *, .look-body, .change, .ph--2019, .ph--2025, .turn, .exp, .qs li, .invite, .handle, .there, .li'
    );
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.remove('pre'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (t) {
      t.classList.add('rv');
      if (t.getBoundingClientRect().top > innerHeight) { t.classList.add('pre'); io.observe(t); }
    });
  }

  /* ---------- clock: the time in Denmark ---------- */

  var clocks = document.querySelectorAll('[data-clock]');
  if (clocks.length && window.Intl) {
    var fmt;
    try {
      fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) { fmt = null; }
    var tick = function () {
      if (!fmt) return;
      var t = fmt.format(new Date());
      clocks.forEach(function (c) { c.textContent = t; });
    };
    tick();
    setInterval(tick, 20000);
  }

  /* ---------- "?" ↔ the matching question, both ways ---------- */

  document.querySelectorAll('.ask, .back').forEach(function (a) {
    a.addEventListener('click', function () {
      var t = document.querySelector(a.getAttribute('href'));
      if (!t) return;
      t.classList.remove('pre');
      t.classList.remove('lit');
      void t.offsetWidth;
      setTimeout(function () { t.classList.add('lit'); }, reduce ? 0 : 450);
    });
  });

  /* ---------- copy ---------- */

  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var target = document.getElementById(btn.getAttribute('aria-controls'));
      function selectIt() {
        if (!target) return;
        var r = document.createRange();
        r.selectNodeContents(target);
        var s = window.getSelection();
        s.removeAllRanges(); s.addRange(r);
      }
      function done() {
        btn.classList.add('done');
        setTimeout(function () { btn.classList.remove('done'); }, 2200);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, selectIt);
      } else {
        selectIt();
      }
    });
  });

  /* ---------- YouTube (loads only when clicked) ---------- */

  document.querySelectorAll('.yt[data-yt]').forEach(function (box) {
    var id = (box.getAttribute('data-yt') || '').trim();
    if (!/^[\w-]{11}$/.test(id)) return;
    box.hidden = false;
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Play video');
    var img = document.createElement('img');
    img.src = 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
    img.alt = '';
    img.loading = 'lazy';
    var play = document.createElement('span');
    play.className = 'play';
    b.appendChild(img); b.appendChild(play);
    b.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      f.title = 'YouTube';
      f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
      f.allowFullscreen = true;
      box.replaceChildren(f);
    });
    box.appendChild(b);
  });
})();
