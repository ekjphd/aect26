// Branching Out — screen engine.
// space / → / PageDown / click: next · ← / PageUp: back · Home/End
// N: speaker notes + timer · T: start/reset timer · F: fullscreen
(function () {
  const deck = document.getElementById('deck');
  const screens = Array.from(deck.querySelectorAll('.screen'));
  const notes = document.getElementById('notes-panel');
  const graph = document.getElementById('graph');
  const tabs = document.getElementById('tabs');
  const SITE = 'ekjphd.com/aect26';
  let i = 0, t0 = null;

  // ---- seeded randomness so torn edges look the same every time ----
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  function tear(el) {
    const bg = document.createElement('div');
    bg.className = 'bg';
    el.prepend(bg);
    const w = el.offsetWidth, h = el.offsetHeight, pts = [];
    const edge = (n, f) => { for (let k = 0; k <= n; k++) pts.push(f(k / n)); };
    const j = (px, size) => (px / size) * 100;
    edge(28, (t) => `${(t * 100).toFixed(2)}% ${j(rnd() * 9, h).toFixed(2)}%`);                 // top
    edge(14, (t) => `${(100 - j(rnd() * 4, w)).toFixed(2)}% ${(t * 100).toFixed(2)}%`);           // right
    edge(28, (t) => `${((1 - t) * 100).toFixed(2)}% ${(100 - j(rnd() * 11, h)).toFixed(2)}%`);   // bottom
    edge(14, (t) => `${j(rnd() * 4, w).toFixed(2)}% ${((1 - t) * 100).toFixed(2)}%`);             // left
    bg.style.clipPath = `polygon(${pts.join(',')})`;
  }
  deck.querySelectorAll('.torn').forEach(tear);

  // ---- site address on every screen ----
  screens.forEach((s) => {
    const u = document.createElement('div');
    u.className = 'site-url';
    u.textContent = SITE;
    s.appendChild(u);
  });

  // ---- section tabs + commit-graph progress ----
  const parts = [];
  screens.forEach((s, n) => { if (s.dataset.part) parts.push({ name: s.dataset.part, n }); });
  parts.forEach((p) => {
    const b = document.createElement('button');
    b.textContent = p.name;
    b.onclick = () => go(p.n);
    tabs.appendChild(b);
  });
  screens.forEach((s, n) => {
    const d = document.createElement('i');
    if (s.dataset.part) d.className = 'part';
    d.title = `${n + 1}`;
    d.onclick = () => go(n);
    graph.appendChild(d);
  });
  const dots = Array.from(graph.children);


  // ---- timer ----
  const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const toMin = (hm) => { const [h, m] = hm.split(':').map(Number); return (h % 12) * 60 + m; };
  function targetFor(n) { for (let k = n; k >= 0; k--) if (screens[k].dataset.by) return screens[k].dataset.by; return '2:55'; }

  function renderNotes() {
    const a = screens[i].querySelector('.notes');
    const by = targetFor(i);
    let meta = `<span>Screen ${i + 1} / ${screens.length}</span><span>Target: at ${by} pm</span>`;
    if (t0) {
      const el = Date.now() - t0;
      const due = (toMin(by) - toMin('2:55')) * 60000;
      meta += `<span>Elapsed ${fmt(el)} of 20:00</span>`;
      meta += el > due + 60000 ? `<span class="late">~${fmt(el - due)} behind</span>` : `<span>on pace</span>`;
    } else meta += `<span>Press T to start the timer</span>`;
    notes.innerHTML = `<div class="meta">${meta}</div>${a ? a.innerHTML : ''}`;
  }
  setInterval(() => { if (notes.classList.contains('on')) renderNotes(); }, 1000);

  function go(n) {
    i = Math.max(0, Math.min(screens.length - 1, n));
    screens.forEach((s, k) => s.classList.toggle('active', k === i));
    dots.forEach((d, k) => { d.classList.toggle('done', k < i); d.classList.toggle('here', k === i); });
    let cur = -1; parts.forEach((p, k) => { if (p.n <= i) cur = k; });
    Array.from(tabs.children).forEach((b, k) => b.classList.toggle('on', k === cur));
    renderNotes();
    if (history.replaceState) history.replaceState(null, '', '#' + (i + 1));
  }

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if ([' ', 'ArrowRight', 'ArrowDown', 'PageDown', 'Enter'].includes(k)) { e.preventDefault(); go(i + 1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); go(i - 1); }
    else if (k === 'Home') go(0);
    else if (k === 'End') go(screens.length - 1);
    else if (k === 'n' || k === 'N') { notes.classList.toggle('on'); renderNotes(); }
    else if (k === 't' || k === 'T') { t0 = Date.now(); renderNotes(); }
    else if (k === 'f' || k === 'F') { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }
  });

  // click the table/paper to advance (but not links, tabs, or the notes panel)
  deck.addEventListener('click', (e) => { if (!e.target.closest('a, button') && !window.getSelection().toString()) go(i + 1); });

  let x0 = null;
  document.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
    x0 = null;
  });

  document.querySelectorAll('.qr[data-url]').forEach((el) => {
    if (typeof QRCode === 'undefined') { el.innerHTML = '<span class="hand" style="font-size:64px;text-align:center">ekjphd.com/<br>sandbox</span>'; return; }
    el.innerHTML = '';
    new QRCode(el, { text: el.dataset.url, width: 456, height: 456, colorDark: '#1f1c4d', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  });

  go((parseInt(location.hash.slice(1), 10) || 1) - 1);
})();
