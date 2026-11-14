(function () {
  var $ = function (id) { return document.getElementById(id); };
  var scene = $('scene'), wall = $('wall'), rig = $('rig'), head = $('head'), eyeMark = $('eyeMark');
  var irisL = $('irisL'), irisR = $('irisR'), n1 = $('n1'), n2 = $('n2');
  var scrimL = $('scrimL'), scrimR = $('scrimR'), scrimB = $('scrimB');
  var hudN = $('hudN'), hudName = $('hudName'), hudZ = $('hudZ'), hudGaze = $('hudGaze'), pinGaze = $('pinGaze');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phone = window.matchMedia('(max-width: 860px)');

  /* Camera stops. fx, fy: the point on him to frame (image units, 720 x 768).
     z: zoom. ax, ay: where that point sits on screen (0..1). r: roll in degrees.
     sl, sr, sb: how dark the left, right, bottom text scrims are. */
  var SHOTS = {
    hero:    { fx: 360, fy: 384, z: 1.0, ax: .50, ay: .50, r: 0,  sl: 0, sr: 0, sb: 1, name: 'full frame' },
    head:    { fx: 372, fy: 150, z: 2.1, ax: .27, ay: .50, r: -5, sl: 0, sr: 1, sb: 0, name: 'head' },
    eyes:    { fx: 365, fy: 258, z: 3.3, ax: .27, ay: .47, r: 3,  sl: 0, sr: 1, sb: 0, name: 'eyes' },
    pocket:  { fx: 513, fy: 650, z: 2.5, ax: .75, ay: .50, r: 4,  sl: 1, sr: 0, sb: 0, name: 'pocket' },
    b1:      { fx: 320, fy: 513, z: 3.0, ax: .25, ay: .50, r: -3, sl: 0, sr: 1, sb: 0, name: 'button 1' },
    b2:      { fx: 321, fy: 621, z: 3.0, ax: .25, ay: .50, r: 0,  sl: 0, sr: 1, sb: 0, name: 'button 2' },
    b3:      { fx: 229, fy: 638, z: 3.0, ax: .25, ay: .50, r: 3,  sl: 0, sr: 1, sb: 0, name: 'button 3' },
    b4:      { fx: 513, fy: 638, z: 3.0, ax: .25, ay: .50, r: -3, sl: 0, sr: 1, sb: 0, name: 'button 4' },
    contact: { fx: 365, fy: 290, z: 1.5, ax: .28, ay: .50, r: 0,  sl: 0, sr: 1, sb: 0, name: 'full frame' }
  };
  var KEYS = ['fx', 'fy', 'z', 'ax', 'ay', 'r', 'sl', 'sr', 'sb'];
  var shotEls = Array.prototype.slice.call(document.querySelectorAll('[data-shot]'));
  var pins = {};
  Array.prototype.forEach.call(document.querySelectorAll('[data-pin]'), function (p) { pins[p.getAttribute('data-pin')] = p; });

  var W = 1, H = 1, s0 = 1;
  function measure() {
    var r = scene.getBoundingClientRect(); W = r.width; H = r.height;
    s0 = Math.min(H * 0.96 / 768, W * 1.15 / 720);
    var avail = (W / s0 - 720) / 2 + 232 - 14;           // room left of his head for the first name
    rig.style.setProperty('--name-size', '100px');
    var per100 = Math.max(n1.offsetWidth, n2.offsetWidth, 1);            // real width of the wider word at 100px, whatever font loaded
    rig.style.setProperty('--name-size', Math.max(36, Math.min(175, 100 * avail / per100)).toFixed(1) + 'px');
  }

  /* ----- which stop are we at? blend between the two nearest by scroll ----- */
  var shotIndex = 0, weights = {};
  function cameraTarget() {
    var line = phone.matches ? H + (window.innerHeight - H) * 0.38 : window.innerHeight * 0.5;
    var a = 0, b = 0, t = 0, n = shotEls.length, cs = [];
    for (var i = 0; i < n; i++) { var r = shotEls[i].getBoundingClientRect(); cs.push((r.top + r.bottom) / 2); }
    if (line <= cs[0]) { a = b = 0; }
    else if (line >= cs[n - 1]) { a = b = n - 1; }
    else { for (var j = 0; j < n - 1; j++) if (line >= cs[j] && line < cs[j + 1]) { a = j; b = j + 1; t = (line - cs[j]) / (cs[j + 1] - cs[j]); break; } }
    var u = Math.max(0, Math.min(1, (t - 0.22) / 0.56)); u = u * u * (3 - 2 * u);   // rest at each stop, glide between
    var A = SHOTS[shotEls[a].getAttribute('data-shot')], B = SHOTS[shotEls[b].getAttribute('data-shot')], out = {};
    for (var k = 0; k < KEYS.length; k++) { var key = KEYS[k]; out[key] = A[key] + (B[key] - A[key]) * u; }
    out.z = Math.exp(Math.log(A.z) + (Math.log(B.z) - Math.log(A.z)) * u);
    weights = {}; weights[shotEls[a].getAttribute('data-shot')] = 1 - u;
    weights[shotEls[b].getAttribute('data-shot')] = (weights[shotEls[b].getAttribute('data-shot')] || 0) + u;
    shotIndex = u > 0.5 ? b : a;
    if (phone.matches) { out.ax = 0.5; out.ay = 0.5; out.r *= 0.5; out.sl = out.sr = 0; out.sb = 0; }
    return out;
  }

  /* ----- lit rows and nav state ----- */
  var focusItems = Array.prototype.slice.call(document.querySelectorAll('[data-focus]'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-section]'));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.top nav a'));
  var lit = null, activeSection = sections[0];
  function onScroll() {
    var top = phone.matches ? H : 0, line = top + (window.innerHeight - top) * 0.46, best = null, bestD = 1e9;
    for (var i = 0; i < focusItems.length; i++) {
      var r = focusItems[i].getBoundingClientRect();
      if (r.bottom < top || r.top > window.innerHeight) continue;
      var d = Math.abs((r.top + r.bottom) / 2 - line);
      if (d < bestD && d < window.innerHeight * 0.3) { bestD = d; best = focusItems[i]; }
    }
    if (best !== lit) { if (lit) lit.classList.remove('lit'); if (best) best.classList.add('lit'); lit = best; }
    var sec = sections[0];
    for (var j = 0; j < sections.length; j++) if (sections[j].getBoundingClientRect().top <= line) sec = sections[j];
    if (sec !== activeSection) {
      activeSection = sec;
      navLinks.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + sec.getAttribute('data-section')); });
    }
  }

  /* ----- gaze: cursor first, then whatever content is active ----- */
  var pointer = null, lastMove = 0, hovered = null, IDLE = 1800;
  function lookName(el) { var n = el.hasAttribute('data-look') ? el : el.querySelector('[data-look]'); return n ? n.getAttribute('data-look') : 'the page'; }
  function centreOf(el) {
    var r = el.getBoundingClientRect(), t = Math.max(r.top, 0), b = Math.min(r.bottom, window.innerHeight);
    if (b <= t) { t = r.top; b = r.bottom; }
    return { x: r.left + Math.min(r.width, 460) / 2, y: (t + b) / 2 };
  }
  function pickTarget(now) {
    var f = document.activeElement;
    if (f && f.matches && f.matches('[data-look]:focus-visible')) return { p: centreOf(f), name: f.getAttribute('data-look') };
    if (pointer && now - lastMove < IDLE) return { p: pointer, name: hovered ? hovered.getAttribute('data-look') : 'cursor' };
    if (hovered) return { p: centreOf(hovered), name: hovered.getAttribute('data-look') };
    if (lit) return { p: centreOf(lit), name: lookName(lit) };
    var el = shotEls[shotIndex];
    return { p: centreOf(el), name: lookName(el) };
  }
  window.addEventListener('pointermove', function (e) {
    pointer = { x: e.clientX, y: e.clientY }; lastMove = performance.now();
    hovered = e.target && e.target.closest ? e.target.closest('[data-look]') : null;
  }, { passive: true });
  window.addEventListener('pointerdown', function (e) {
    pointer = { x: e.clientX, y: e.clientY };
    lastMove = performance.now() - (e.pointerType === 'touch' ? IDLE - 700 : 0);
    if (e.pointerType === 'touch') hovered = null;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', function () { pointer = null; hovered = null; });
  window.addEventListener('blur', function () { pointer = null; hovered = null; });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { measure(); onScroll(); });
  measure(); onScroll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  /* ----- one loop: move the camera, then the eyes and head ----- */
  var cam = null, eye = { x: 0, y: 0 }, turn = { x: 0, y: 0 }, shown = {};
  function setText(el, key, v) { if (shown[key] !== v) { shown[key] = v; el.textContent = v; } }
  function frame(now) {
    var tgt = cameraTarget();
    if (!cam) cam = tgt;
    var kc = reduce ? 1 : 0.085;
    for (var k = 0; k < KEYS.length; k++) cam[KEYS[k]] += (tgt[KEYS[k]] - cam[KEYS[k]]) * kc;

    var s = s0 * cam.z, rad = cam.r * Math.PI / 180;
    var px = cam.ax * W, py = cam.ay * H;
    var bottom = py + (768 - cam.fy) * s, need = H + 30 + Math.abs(Math.sin(rad)) * W * 0.5;   // never show below his hem
    if (bottom < need) py += need - bottom;
    rig.style.transform = 'translate(' + px.toFixed(2) + 'px,' + py.toFixed(2) + 'px) rotate(' + cam.r.toFixed(3) + 'deg) scale(' + s.toFixed(4) + ') translate(' + (-cam.fx).toFixed(2) + 'px,' + (-cam.fy).toFixed(2) + 'px)';
    rig.style.setProperty('--inv', (1 / s).toFixed(4));
    wall.style.transform = 'translate(' + ((cam.ax - 0.5) * W * 0.35 + (360 - cam.fx) * s * 0.1).toFixed(1) + 'px,' + ((384 - cam.fy) * s * 0.08).toFixed(1) + 'px) scale(' + (1 + (cam.z - 1) * 0.14).toFixed(4) + ')';
    var nameO = Math.max(0, Math.min(1, 1 - (cam.z - 1.02) / 0.3)).toFixed(3);
    n1.style.opacity = nameO; n2.style.opacity = nameO;
    scrimL.style.opacity = cam.sl.toFixed(3); scrimR.style.opacity = cam.sr.toFixed(3); scrimB.style.opacity = cam.sb.toFixed(3);
    for (var name in pins) { var w = weights[name] || 0; pins[name].style.opacity = Math.max(0, (w - 0.55) / 0.45).toFixed(3); }

    var t = pickTarget(now), m = eyeMark.getBoundingClientRect();
    var dx = t.p.x - m.left, dy = t.p.y - m.top, reach = Math.max(170, 165 * s);
    var len = Math.sqrt(dx * dx + dy * dy + reach * reach), gx = dx / len, gy = dy / len;
    var ke = reduce ? 1 : 0.2, kh = reduce ? 0 : 0.06;
    eye.x += (gx - eye.x) * ke; eye.y += (gy - eye.y) * ke;
    turn.x += (gx - turn.x) * kh; turn.y += (gy - turn.y) * kh;
    var tr = 'translate(' + (eye.x * 7.5).toFixed(2) + ' ' + (eye.y * 5).toFixed(2) + ')';
    irisL.setAttribute('transform', tr); irisR.setAttribute('transform', tr);
    /* The head pivots about the base of the neck and never slides, so the join stays closed. */
    if (!reduce) head.style.transform = 'perspective(1100px) rotateY(' + (turn.x * 7).toFixed(2) + 'deg) rotateX(' + (-turn.y * 4.5).toFixed(2) + 'deg) rotateZ(' + (turn.x * 0.9).toFixed(2) + 'deg)';

    var idx = shotIndex + 1, total = shotEls.length;
    setText(hudN, 'n', (idx < 10 ? '0' : '') + idx + '/' + (total < 10 ? '0' : '') + total);
    setText(hudName, 'name', SHOTS[shotEls[shotIndex].getAttribute('data-shot')].name);
    setText(hudZ, 'z', cam.z.toFixed(1) + '×');
    setText(hudGaze, 'g', t.name); setText(pinGaze, 'pg', t.name);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (!reduce) (function blink() {
    setTimeout(function () { head.classList.add('blink'); setTimeout(function () { head.classList.remove('blink'); blink(); }, 130); }, 2400 + Math.random() * 3800);
  })();
  window.__look = function (x, y) { pointer = { x: x, y: y }; lastMove = performance.now() + 1e7; };   // test hook
})();
