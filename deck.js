// Branching Out — screen engine.
// space / → / PageDown / click: next · ← / PageUp: back · Home/End
// P: presenter view (notes + current/next + timer, synced) · N: notes on this screen
// T: start/reset timer · F: fullscreen
(function () {
  const params = new URLSearchParams(location.search);
  const MODE = params.has('presenter') ? 'presenter' : params.has('preview') ? 'preview' : 'audience';
  const OFFSET = MODE === 'preview' ? (parseInt(params.get('preview'), 10) || 0) : 0;
  document.documentElement.classList.add('mode-' + MODE);

  const deck = document.getElementById('deck');
  const screens = Array.from(deck.querySelectorAll('.screen'));
  const notes = document.getElementById('notes-panel');
  const graph = document.getElementById('graph');
  const tabs = document.getElementById('tabs');
  const SITE = 'ekjphd.com/aect26';
  const N = screens.length;
  let i = 0, t0 = null, presenterWin = null;
  let goImpl = () => {}, timerImpl = () => {};
  let st = 0; // click-to-reveal steps shown on the current screen
  const stepsOf = (n) => (screens[n] ? screens[n].querySelectorAll('.reveal').length : 0);

  // ---------- sync between windows (BroadcastChannel + direct postMessage) ----------
  let bc = null;
  try { bc = new BroadcastChannel('branching-out'); } catch (e) {}
  function send(msg) {
    msg.bo = 1;
    try { bc && bc.postMessage(msg); } catch (e) {}
    try { if (presenterWin && !presenterWin.closed) presenterWin.postMessage(msg, '*'); } catch (e) {}
    try { if (window.opener && !window.opener.closed) window.opener.postMessage(msg, '*'); } catch (e) {}
    document.querySelectorAll('#presenter iframe').forEach((f) => { try { f.contentWindow.postMessage(msg, '*'); } catch (e) {} });
  }
  function onMsg(m) {
    if (!m || !m.bo) return;
    if (m.type === 'go') goImpl(m.i, true, m.st || 0);
    else if (m.type === 't0') { t0 = m.t0; timerImpl(); }
    else if (m.type === 'hello' && MODE === 'audience') { send({ type: 'go', i, st }); if (t0) send({ type: 't0', t0 }); }
  }
  if (bc) bc.onmessage = (e) => onMsg(e.data);
  window.addEventListener('message', (e) => onMsg(e.data));

  // ---------- timer helpers ----------
  const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const toMin = (hm) => { const [h, m] = hm.split(':').map(Number); return (h % 12) * 60 + m; };
  function targetFor(n) { for (let k = Math.min(n, N - 1); k >= 0; k--) if (screens[k].dataset.by) return screens[k].dataset.by; return '2:55'; }
  function paceHTML() {
    const by = targetFor(i);
    let h = `<span>Screen ${i + 1} / ${N}</span><span>Target: at ${by} pm</span>`;
    if (t0) {
      const el = Date.now() - t0, due = (toMin(by) - toMin('2:55')) * 60000;
      h += `<span>Elapsed <b>${fmt(el)}</b> of 20:00</span>`;
      h += el > due + 60000 ? `<span class="late">~${fmt(el - due)} behind</span>` : `<span class="ok">on pace</span>`;
    } else h += `<span>Press T to start the timer</span>`;
    return h;
  }
  function startTimer() { t0 = Date.now(); send({ type: 't0', t0 }); timerImpl(); }

  // ================= PRESENTER WINDOW =================
  if (MODE === 'presenter') {
    document.title = 'Presenter · Branching Out';
    const base = location.href.split('?')[0].split('#')[0];
    const P = document.createElement('div');
    P.id = 'presenter';
    P.innerHTML = `
      <div class="p-top"><div class="p-clock"></div><div class="p-pace"></div>
        <div class="p-btns"><button data-d="-1">◀ back</button><button data-d="1">next ▶</button><button data-t>start timer (T)</button></div></div>
      <div class="p-main">
        <div class="p-cur"><div class="p-label">NOW</div><div class="p-frame"><iframe src="${base}?preview=0" title="current screen"></iframe></div></div>
        <div class="p-side"><div class="p-label">NEXT</div><div class="p-frame small"><iframe src="${base}?preview=1" title="next screen"></iframe></div>
          <div class="p-notes"></div></div>
      </div>
      <div class="p-help">space / → next · ← back · T timer · keep this window on your laptop; the audience window follows.</div>`;
    document.body.appendChild(P);
    const notesBox = P.querySelector('.p-notes'), pace = P.querySelector('.p-pace'), clock = P.querySelector('.p-clock');
    P.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => (Number(b.dataset.d) > 0 ? pNext() : pPrev()));
    P.querySelector('[data-t]').onclick = startTimer;

    const pRender = () => {
      pace.innerHTML = paceHTML();
      clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };
    const pGo = (n, remote, s = 0) => {
      i = Math.max(0, Math.min(N - 1, n));
      st = Math.max(0, Math.min(stepsOf(i), s));
      const a = screens[i].querySelector('.notes');
      notesBox.innerHTML = `<div class="p-label">NOTES · screen ${i + 1}</div>${a ? a.innerHTML : ''}`;
      pRender();
      if (!remote) send({ type: 'go', i, st });
      else P.querySelectorAll('iframe').forEach((f) => { try { f.contentWindow.postMessage({ bo: 1, type: 'go', i, st }, '*'); } catch (e) {} });
    };
    const pNext = () => (st < stepsOf(i) ? pGo(i, false, st + 1) : pGo(i + 1, false, 0));
    const pPrev = () => (st > 0 ? pGo(i, false, st - 1) : pGo(i - 1, false, i > 0 ? stepsOf(i - 1) : 0));
    goImpl = pGo; timerImpl = pRender;
    setInterval(pRender, 1000);
    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if ([' ', 'ArrowRight', 'ArrowDown', 'PageDown', 'Enter'].includes(k)) { e.preventDefault(); pNext(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); pPrev(); }
      else if (k === 'Home') pGo(0);
      else if (k === 'End') pGo(N - 1);
      else if (k === 't' || k === 'T') startTimer();
    });
    // once the previews load, sync them; then ask the audience window where it is
    P.querySelectorAll('iframe').forEach((f) => f.addEventListener('load', () => { try { f.contentWindow.postMessage({ bo: 1, type: 'go', i, st }, '*'); } catch (e) {} }));
    pGo((parseInt(location.hash.slice(1), 10) || 1) - 1, true);
    send({ type: 'hello' });
    return;
  }

  // ================= AUDIENCE + PREVIEW =================
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  function tear(el) {
    const bg = document.createElement('div');
    bg.className = 'bg';
    el.prepend(bg);
    const w = el.offsetWidth || 1000, h = el.offsetHeight || 600, pts = [];
    const edge = (n, f) => { for (let k = 0; k <= n; k++) pts.push(f(k / n)); };
    const j = (px, size) => (px / size) * 100;
    edge(28, (t) => `${(t * 100).toFixed(2)}% ${j(rnd() * 9, h).toFixed(2)}%`);
    edge(14, (t) => `${(100 - j(rnd() * 4, w)).toFixed(2)}% ${(t * 100).toFixed(2)}%`);
    edge(28, (t) => `${((1 - t) * 100).toFixed(2)}% ${(100 - j(rnd() * 11, h)).toFixed(2)}%`);
    edge(14, (t) => `${j(rnd() * 4, w).toFixed(2)}% ${((1 - t) * 100).toFixed(2)}%`);
    bg.style.clipPath = `polygon(${pts.join(',')})`;
  }
  deck.querySelectorAll('.torn').forEach(tear);

  screens.forEach((s) => {
    const u = document.createElement('div');
    u.className = 'site-url';
    u.textContent = SITE;
    s.appendChild(u);
  });

  // end card for the "next" preview after the last screen
  const end = document.createElement('section');
  end.className = 'screen s-end';
  end.innerHTML = '<div class="hand" style="font-size:calc(120 * var(--p))">end</div>';
  deck.appendChild(end);

  const parts = [];
  screens.forEach((s, n) => { if (s.dataset.part) parts.push({ name: s.dataset.part, n }); });
  const homeBtn = document.createElement('button');
  homeBtn.textContent = 'Home';
  homeBtn.onclick = () => go(0);
  tabs.appendChild(homeBtn);
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

  function renderTimer() {
    if (MODE !== 'audience' || !notes.classList.contains('on')) return;
    const a = screens[i].querySelector('.notes');
    notes.innerHTML = `<div class="meta">${paceHTML()}</div>${a ? a.innerHTML : ''}`;
  }
  setInterval(renderTimer, 1000);
  goImpl = (n, remote, s) => go(n, remote, s); timerImpl = renderTimer;

  function go(n, remote, s = 0) {
    i = Math.max(0, Math.min(N - 1, n));
    st = Math.max(0, Math.min(stepsOf(i), s));
    const shown = i + OFFSET;
    screens.forEach((s, k) => s.classList.toggle('active', k === shown));
    if (screens[shown]) screens[shown].querySelectorAll('.reveal').forEach((el, x) => el.classList.toggle('shown', x < (OFFSET ? 0 : st)));
    end.classList.toggle('active', shown >= N);
    dots.forEach((d, k) => { d.classList.toggle('done', k < i); d.classList.toggle('here', k === i); });
    let cur = -1; parts.forEach((p, k) => { if (p.n <= i) cur = k; });
    Array.from(tabs.children).forEach((b, k) => b.classList.toggle('on', k === cur + 1)); // index 0 = Home
    if (MODE === 'audience') {
      renderTimer();
      if (history.replaceState) history.replaceState(null, '', '#' + (i + 1));
      if (!remote) send({ type: 'go', i, st });
    }
  }
  const next = () => (st < stepsOf(i) ? go(i, false, st + 1) : go(i + 1, false, 0));
  const prev = () => (st > 0 ? go(i, false, st - 1) : go(i - 1, false, i > 0 ? stepsOf(i - 1) : 0));

  if (MODE === 'audience') {
    function openPresenter() {
      const url = location.href.split('?')[0].split('#')[0] + '?presenter#' + (i + 1);
      presenterWin = window.open(url, 'bo-presenter', 'width=1280,height=800');
    }
    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if ([' ', 'ArrowRight', 'ArrowDown', 'PageDown', 'Enter'].includes(k)) { e.preventDefault(); next(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); prev(); }
      else if (k === 'Home') go(0);
      else if (k === 'End') go(N - 1);
      else if (k === 'n' || k === 'N') { notes.classList.toggle('on'); renderTimer(); }
      else if (k === 'p' || k === 'P') openPresenter();
      else if (k === 't' || k === 'T') startTimer();
      else if (k === 'f' || k === 'F') { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }
    });
    deck.addEventListener('click', (e) => { if (!e.target.closest('a, button') && !window.getSelection().toString()) next(); });
    let x0 = null;
    document.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    document.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) (dx < 0 ? next() : prev());
      x0 = null;
    });
  }

  // scale the embedded sandbox so the whole simulator fits its frame
  const SIM_W = 1680;
  function fitSims() {
    document.querySelectorAll('.sim-wrap').forEach((w) => {
      const f = w.querySelector('iframe'); if (!f) return;
      const sc = w.clientWidth / SIM_W; if (!sc) return;
      f.style.width = SIM_W + 'px';
      f.style.height = (w.clientHeight / sc) + 'px';
      f.style.transform = `scale(${sc})`;
    });
  }
  window.addEventListener('resize', fitSims);
  setTimeout(fitSims, 0);

  document.querySelectorAll('.qr[data-url]').forEach((el) => {
    if (typeof QRCode === 'undefined') { el.innerHTML = '<span class="hand" style="font-size:64px;text-align:center">ekjphd.com/<br>sandbox</span>'; return; }
    el.innerHTML = '';
    new QRCode(el, { text: el.dataset.url, width: 456, height: 456, colorDark: '#1f1c4d', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  });

  go((parseInt(location.hash.slice(1), 10) || 1) - 1, true);
})();
