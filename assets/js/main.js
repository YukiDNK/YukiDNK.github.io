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

  // smooth curve through (y, x) anchors that never overshoots between two of them
  // (Fritsch–Carlson monotone cubic), flat at both ends
  function monotone(anc) {
    var n = anc.length, dl = [], m = [], j;
    for (j = 0; j < n - 1; j++) dl.push((anc[j + 1][1] - anc[j][1]) / Math.max(1, anc[j + 1][0] - anc[j][0]));
    m.push(0);
    for (j = 1; j < n - 1; j++) m.push(dl[j - 1] * dl[j] <= 0 ? 0 : (dl[j - 1] + dl[j]) / 2);
    m.push(0);
    for (j = 0; j < n - 1; j++) {
      if (dl[j] === 0) { m[j] = 0; m[j + 1] = 0; continue; }
      var al = m[j] / dl[j], be = m[j + 1] / dl[j], hh = al * al + be * be;
      if (hh > 9) { var k = 3 / Math.sqrt(hh); m[j] = k * al * dl[j]; m[j + 1] = k * be * dl[j]; }
    }
    return function (y) {
      if (y <= anc[0][0]) return anc[0][1];
      if (y >= anc[n - 1][0]) return anc[n - 1][1];
      var i = 0;
      while (i < n - 2 && y >= anc[i + 1][0]) i++;
      var h = Math.max(1, anc[i + 1][0] - anc[i][0]), t = (y - anc[i][0]) / h;
      var t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * anc[i][1] + (t3 - 2 * t2 + t) * h * m[i] +
             (-2 * t3 + 3 * t2) * anc[i + 1][1] + (t3 - t2) * h * m[i + 1];
    };
  }

  /* ---- Section 5: the one place the lines leave the margin ----
     Between "What I don't know yet" and "Together" the two lines swing out
     once and pass around the questions, then settle back into the margin.
     The route is measured from the real text so it never crosses a letter:
       - with the sticky side headings (wide screens): in through Section 5's
         empty top padding, then past each question on its open side (right of
         the left-set ones, left of the indented ones), out through Section 6's
         top padding. The side headings never sit in those two paddings.
       - narrow screens: the lines only drift into the empty space to the left
         of the indented questions.                                        */
  function planOrbit(sTop, sLeft, W, tw, gx) {
    var sec = document.getElementById('unknown');
    var next = document.getElementById('together');
    if (!sec || !next || !visible(sec)) return null;
    var sy = window.scrollY;
    function box(r) { return { t: r.top + sy - sTop, b: r.bottom + sy - sTop, l: r.left - sLeft, r: r.right - sLeft }; }

    // everything in Section 5 the lines must stay clear of: the actual text lines, the ↑ links, the heading
    var sticky = getComputedStyle(sec.querySelector('.sh') || sec).position === 'sticky';
    var obs = [];
    sec.querySelectorAll(sticky ? '.qs p, .qs .back' : '.qs p, .qs .back, .sh').forEach(function (n) {
      if (!visible(n)) return;
      var rg = document.createRange();
      rg.selectNodeContents(n);
      Array.prototype.forEach.call(rg.getClientRects(), function (r) {
        if (r.width > 1 && r.height > 1) obs.push(box(r));
      });
    });
    if (!obs.length) return null;

    var secBox = box(sec.getBoundingClientRect());
    var nextBox = box(next.getBoundingClientRect());
    var padTop = parseFloat(getComputedStyle(sec).paddingTop) || 0;
    var padNext = parseFloat(getComputedStyle(next).paddingTop) || 0;
    var viewR = document.documentElement.clientWidth - sLeft;   // right edge of the page, in story coordinates


    var y0, y1;
    function ease(t) { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); }

    if (sticky) {
      // one pass per question, on the side that is open: the right of the left-set
      // questions, the empty space to the left of the indented ones
      var head = sec.querySelector('.sh').getBoundingClientRect();
      var headR = head.right - sLeft;
      var sepO = Math.min(tw * 0.5, 26);
      var clearX = Math.max(52, W * 0.045), clearY = 44;
      var maxX = viewR - Math.max(24, (viewR - W) * 0.4);
      var qs = [];
      sec.querySelectorAll('.qs li').forEach(function (li) {
        if (!visible(li)) return;
        var bx = null;
        obs.forEach(function (o) {
          var lr = box(li.getBoundingClientRect());
          if (o.t >= lr.t - 1 && o.b <= lr.b + 1) {
            bx = bx ? { t: Math.min(bx.t, o.t), b: Math.max(bx.b, o.b), l: Math.min(bx.l, o.l), r: Math.max(bx.r, o.r) } : { t: o.t, b: o.b, l: o.l, r: o.r };
          }
        });
        if (bx) qs.push(bx);
      });
      if (qs.length < 2) return null;
      var lo = headR + clearX + sepO / 2;                   // never near the sticky side heading
      var pass = [];
      for (var qi = 0; qi < qs.length; qi++) {
        var q = qs[qi];
        var rightC = q.r + clearX + sepO / 2 + (qi % 2 ? 34 : 14);   // a little uneven
        var leftC = q.l - clearX - sepO / 2;
        var rightOk = rightC + sepO / 2 <= maxX;
        var leftOk = leftC >= lo + 24;
        var wantRight = q.l - lo < W * 0.12;                // left-set question: go round its right
        if (wantRight && rightOk) pass.push(rightC);
        else if (!wantRight && leftOk) pass.push(Math.max(lo + 12, leftC - (q.l - lo) * 0.18));
        else if (rightOk) pass.push(rightC);
        else if (leftOk) pass.push(leftC);
        else return null;                                   // no clean route at this width
      }

      // way in: through Section 5's empty top padding (clear of anything hanging down from Section 4)
      var above = sec.previousElementSibling;
      var yA = secBox.t + 10;
      if (above) {
        var tw2 = document.createTreeWalker(above, NodeFilter.SHOW_TEXT), tn;
        while ((tn = tw2.nextNode())) {
          if (!tn.textContent.trim() || !visible(tn.parentElement)) continue;
          var rg2 = document.createRange(); rg2.selectNodeContents(tn);
          Array.prototype.forEach.call(rg2.getClientRects(), function (r) { var bb = box(r); if (bb.b > yA - 30) yA = Math.max(yA, bb.b + 30); });
        }
        above.querySelectorAll('.clip').forEach(function (c) { var bb = box(c.getBoundingClientRect()); if (bb.b > yA - 30) yA = Math.max(yA, bb.b + 30); });
      }
      var yB = Math.min(secBox.t + padTop - 10, qs[0].t - clearY);
      // way out: through Section 6's empty top padding
      var yC = nextBox.t + 10;
      var yD = nextBox.t + padNext - 24;
      if (yB - yA < 50 || yD - yC < 60) return null;
      // centre line: a smooth monotone curve through (y, x) anchors. It never
      // overshoots between two anchors, so every stretch beside a question stays
      // on the side that was checked above.
      var anc = [[yA, gx], [yB, pass[0]]];
      for (qi = 0; qi < qs.length; qi++) {
        // drift a little while passing a question, so the curve is uneven rather than a rail
        var pA = pass[qi], pB = pass[qi] + (pass[qi] > qs[qi].r ? 26 : -Math.min(22, pass[qi] - lo)) * (qi === 0 ? 0.6 : 1);
        if (qi > 0) anc.push([qs[qi].t - clearY, pA]); else anc[1][1] = pA;
        anc.push([qs[qi].b + clearY, pB]);
      }
      anc.push([yC, lo + 6]);
      anc.push([yD, gx]);
      y0 = yA; y1 = yD;
      var centre = monotone(anc);
      function spread(y) { return ease(Math.min((y - yA) / (yB - yA), (yD - y) / (yD - yC), 1)); }
      return {
        y0: y0, y1: y1,
        x: function (y, base, side) {
          if (y <= y0 || y >= y1) return base;
          var k = spread(y);
          var cx = centre(y) + Math.sin(y / 310 + (side < 0 ? 0 : 1.7)) * 3 * k;
          var v = cx + side * (sepO / 2) * k;
          var w = y < yB ? ease((y - yA) / (yB - yA)) : y > yC ? 1 - ease((y - yC) / (yD - yC)) : 1;
          return base + (v - base) * w;
        }
      };
    }

    // narrow screens: the side headings sit in the text column, so the lines stay
    // on the left and only swell into the empty space beside the indented questions
    var clearL = Math.max(22, W * 0.06), gapY = 36;
    var sepN = Math.min(tw * 0.7, 22);
    var rows = [];
    sec.querySelectorAll('.qs li').forEach(function (li) {
      if (!visible(li)) return;
      var lr = box(li.getBoundingClientRect()), bx = null;
      obs.forEach(function (o) {
        if (o.t >= lr.t - 1 && o.b <= lr.b + 1) bx = bx ? { t: Math.min(bx.t, o.t), b: Math.max(bx.b, o.b), l: Math.min(bx.l, o.l) } : { t: o.t, b: o.b, l: o.l };
      });
      if (bx) rows.push(bx);
    });
    if (!rows.length) return null;
    var ancN = [[rows[0].t - 200, gx]], moved = false;
    rows.forEach(function (r, i) {
      var room = r.l - clearL - sepN / 2;
      var x = room - gx > sepN ? Math.min(room - (i % 2 ? 4 : 10), gx + W * 0.26) : gx;
      if (x > gx) moved = true;
      ancN.push([r.t - gapY, x]);
      ancN.push([r.b + gapY, x > gx ? x - 6 : gx]);
    });
    if (!moved) return null;
    ancN.push([rows[rows.length - 1].b + 220, gx]);
    var centreN = monotone(ancN);
    y0 = ancN[0][0]; y1 = ancN[ancN.length - 1][0];
    return {
      y0: y0, y1: y1,
      x: function (y, base, side) {
        if (y <= y0 || y >= y1) return base;
        var c = centreN(y);
        var k = Math.max(0, Math.min(1, (c - gx) / (sepN * 2)));
        k = k * k * (3 - 2 * k);                            // eases in and out, no corner
        var target = c + side * sepN / 2 + Math.sin(y / 260 + (side < 0 ? 0 : 1.9)) * 1.5;
        return base + (target - base) * k;
      }
    };
  }

  function layout() {
    var sRect = story.getBoundingClientRect();
    var sTop = sRect.top + window.scrollY;
    var sLeft = sRect.left;
    var H = story.offsetHeight;
    var W = story.clientWidth;
    geo.top = sTop; geo.H = H;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    // The two lines live only in the left margin (the --thread-w gutter).
    // They never move toward the text: data-x is ignored, and each data-sep
    // is squeezed into a small range so the lines only open and close a little.
    var tw = parseFloat(getComputedStyle(story).getPropertyValue('--thread-w')) || 48;
    var gx = tw / 2;
    var minS = tw * 0.07, maxS = tw * 0.36;
    function sepPx(v, quiet) {
      var t = Math.max(0, Math.min(1, (v + 4) / 44));
      if (quiet) t = Math.min(t, 0.45);
      return minS + (maxS - minS) * t;
    }

    var keys = [];
    story.querySelectorAll('[data-sep]').forEach(function (n) {
      if (!visible(n)) return;
      keys.push({
        y: n.getBoundingClientRect().top + window.scrollY - sTop,
        x: gx,
        sep: sepPx(parseFloat(n.getAttribute('data-sep')), !!n.closest('.unknown, .foot')),
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
    var amp = tw * 0.04;
    function cl(x) { return Math.max(2, Math.min(tw - 4, x)); }
    function baseA(y) { var p = at(y); return cl(p.x - p.sep / 2 + Math.sin(y / 210) * amp); }
    function baseB(y) { var p = at(y); return cl(p.x + p.sep / 2 + Math.sin(y / 265 + 1.9) * amp); }

    var orbit = planOrbit(sTop, sLeft, W, tw, gx);
    function xa(y) { return orbit ? orbit.x(y, baseA(y), -1) : baseA(y); }
    function xb(y) { return orbit ? orbit.x(y, baseB(y), 1) : baseB(y); }

    var da = '', db = '';
    var y = y0, first = true;
    while (y <= H) {
      var c = first ? 'M' : 'L';
      first = false;
      da += c + xa(y).toFixed(1) + ' ' + y.toFixed(0);
      db += c + xb(y).toFixed(1) + ' ' + y.toFixed(0);
      y += orbit && y > orbit.y0 - 40 && y < orbit.y1 + 40 ? 3 : 12;
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
