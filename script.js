/* Adam & Nadhila — cinematic scroll engine (ported from Mostar spec, wedding-tuned)
   Choreography: 0-650 title exit / 560-1620 split+zoom / 1760-2700 venue reveal / 2760-3560 slider fly-in
   Perf tuning: cached metrics (no getBoundingClientRect per frame), skip writes outside film,
   changed-only var writes, blur max 10px, pointer settle faster, single scroll handler.
*/
const section = document.querySelector('.cinema-scroll');
const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

let targetMouseX = 0, targetMouseY = 0, mouseX = 0, mouseY = 0;
let targetScroll = 0, smoothScroll = 0, initialized = false, rafPending = false;

/* deklarasi awal (dipakai measureChrome sejak load) */
const sectionIds = ['cinema', 'couple', 'story', 'event', 'rsvp'];
const navLinks = [...document.querySelectorAll('.bottom-nav a')];
const progressBar = document.querySelector('.progress span');
const parallaxImgs = [...document.querySelectorAll('.parallax-wrap>img,.chapter-hero>img')];

/* cached film metrics — measured, not queried per frame */
let cinemaTop = 0, cinemaRange = 1, cinemaBottom = 0;
let secTops = [], parallaxData = [], docH = 1;
function measure() {
  if (!section) return;
  cinemaTop = section.offsetTop;
  cinemaRange = Math.max(1, section.offsetHeight - window.innerHeight);
  cinemaBottom = cinemaTop + section.offsetHeight;
  measureChrome();
}
/* offset layout di-cache (baca sekali), jangan getBoundingClientRect tiap frame */
function measureChrome() {
  secTops = sectionIds.map((id) => { const el = document.getElementById(id); return el ? el.offsetTop : -1e9; });
  parallaxData = parallaxImgs.map((img) => ({ img, top: img.parentElement.offsetTop, h: img.parentElement.offsetHeight }));
  docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
}
measure();

/* ---------- helpers (verbatim) ---------- */
const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const smoothstep = (e0, e1, v) => { const x = clamp((v - e0) / (e1 - e0)); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const segmentInOut = (s, a, b, c, d) => {
  const enter = smoothstep(a, b, s), exit = smoothstep(c, d, s);
  return { enter, exit, active: enter * (1 - exit) };
};
const getScrollDistance = () => {
  if (!section) return 0;
  return clamp(window.scrollY - cinemaTop, 0, cinemaRange);
};

/* layer raksasa yang opacity-nya 0 dikeluarkan dari composite (visibility) */
const splitEls = [...document.querySelectorAll('.splitframe-img')];
const frame2El = document.querySelector('.frame-two-img');
let splitShown = true, frame2Shown = false;
function setVis(el, show) {
  const v = show ? 'visible' : 'hidden';
  if (el && el.style.visibility !== v) el.style.visibility = v;
}

/* changed-only writes: avoid redundant style recalc */
const varCache = new Map();
const rootStyle = root.style;
function setVar(n, v) { if (varCache.get(n) !== v) { varCache.set(n, v); rootStyle.setProperty(n, v); } }

/* ---------- music: porcelain_and_teak.mp3, dynamics follow chapters ---------- */
const bgAudio = document.getElementById('bgMusic');
let actx = null, musicFilter = null, musicOn = false;
let lastCutoff = -1, lastVol = -1;
function initMusicGraph() {
  if (actx || !bgAudio) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const src = actx.createMediaElementSource(bgAudio);
    musicFilter = actx.createBiquadFilter();
    musicFilter.type = 'lowpass'; musicFilter.frequency.value = 1400; musicFilter.Q.value = 0.4;
    src.connect(musicFilter); musicFilter.connect(actx.destination);
  } catch (e) { actx = null; musicFilter = null; }
}
function setMusic(on) {
  musicOn = on;
  const label = document.getElementById('musicLabel');
  if (label) label.textContent = on ? 'ON' : 'OFF';
  if (!bgAudio) return;
  if (on) {
    initMusicGraph();
    if (actx && actx.state === 'suspended') actx.resume();
    bgAudio.volume = 0.0;
    bgAudio.play().then(() => {
      // fade-in 2s
      const t0 = performance.now();
      const fade = () => {
        if (!musicOn) return;
        const k = Math.min(1, (performance.now() - t0) / 2000);
        if (bgAudio.volume < 0.7 * k) bgAudio.volume = Math.min(0.7, 0.7 * k);
        if (k < 1) requestAnimationFrame(fade);
      };
      fade();
    }).catch(() => {});
  } else {
    bgAudio.pause();
  }
}
/* intro = muffled + soft -> swell opens filter + lifts volume -> ending restrained */
function updateMusicDynamics(f2enter, f2active, f3active) {
  if (!bgAudio || !musicOn || bgAudio.paused) return;
  const cutoff = Math.round((1400 + f2enter * 9000 + f3active * 4000) / 100) * 100;
  if (cutoff !== lastCutoff) {
    lastCutoff = cutoff;
    if (musicFilter) musicFilter.frequency.setTargetAtTime(Math.min(19000, cutoff), actx.currentTime, 0.5);
  }
  const vol = Math.min(0.85, 0.5 + f2active * 0.2 + f3active * 0.12);
  const vr = Math.round(vol * 100) / 100;
  if (vr !== lastVol) { lastVol = vr; bgAudio.volume = vr; }
}

/* ---------- per-frame update (Mostar math, mouse halved for wedding) ---------- */
function update() {
  rafPending = false;
  targetScroll = getScrollDistance();
  // enteng: tanpa inersia lerp (stepper + smooth-scroll native sudah memberi easing).
  // 1 frame per event, tanpa ekor rAF panjang.
  smoothScroll = targetScroll; initialized = true;

  mouseX = lerp(mouseX, targetMouseX, 0.2);
  mouseY = lerp(mouseY, targetMouseY, 0.2);

  const frame2 = segmentInOut(smoothScroll, 560, 900, 1300, 1620);
  const frame3 = segmentInOut(smoothScroll, 1760, 2140, 2540, 2700);

  // music follows film even when we skip paint writes
  updateMusicDynamics(frame2.enter, frame2.active, frame3.active);

  // perf: film jauh di luar viewport -> snap, skip 40+ style writes
  const y = window.scrollY;
  const filmVisible = y > cinemaTop - window.innerHeight && y < cinemaBottom;
  if (!filmVisible) {
    smoothScroll = targetScroll;
    if (Math.abs(mouseX - targetMouseX) > 0.001 || Math.abs(mouseY - targetMouseY) > 0.001) requestTick();
    return;
  }

  const progress = clamp(smoothScroll / 2700);
  const introExit = smoothstep(90, 650, smoothScroll);
  const blurActive = clamp(frame2.active + frame3.active);
  const frame2Opacity = frame2.active * (1 - frame3.enter);
  const splitDrift = Math.pow(frame2.enter, 1.5);
  const panel2Opacity = frame2.active * (1 - frame2.exit);
  const panel3Opacity = frame3.active * (1 - frame3.exit);
  const backScale = 0.76 + progress * 0.2 + frame2.enter * 0.18 + frame3.enter * 0.16;
  const sharedHeroY = progress * -74;
  const sharedHeroScale = progress * 0.23;

  const mx = reduceMotion.matches ? 0 : mouseX;
  const my = reduceMotion.matches ? 0 : mouseY;
  // subtle parallax: ~50% of Mostar travel version
  setVar('--mx', mx.toFixed(4));
  setVar('--my', my.toFixed(4));
  setVar('--back-opacity', (1 - frame2.active * 0.06).toFixed(4));
  setVar('--back-x', `${(mx * -6).toFixed(2)}px`);
  setVar('--back-y', `${(my * -2).toFixed(2)}px`);
  setVar('--back-scale', backScale.toFixed(4));
  setVar('--four-y', `${(10 + progress * 10).toFixed(2)}vh`);
  setVar('--four-scale', (0.78 + progress * 0.16).toFixed(4));
  setVar('--bazaar-y', `${(20 - progress * 8).toFixed(2)}vh`);
  // hero fokus satu subjek: lapisan tengah memudar masuk mengikuti scroll
  setVar('--bazaar-opacity', (0.2 + progress * 0.8).toFixed(3));
  // perf: dimming via opacity overlays (compositor-only), bukan filter animasi
  setVar('--dim', (blurActive * 0.28).toFixed(3));
  setVar('--shade-strength', blurActive.toFixed(3));
  setVar('--shade-z', frame2.active > 0.02 ? '2' : '0');

  setVar('--title-y', `${(introExit * -210).toFixed(1)}px`);
  setVar('--title-scale', (1 - introExit * 0.08).toFixed(4));
  setVar('--title-opacity', (1 - introExit).toFixed(4));

  setVar('--bridge-x', `calc(-50% + ${(mx * 9).toFixed(2)}px)`);
  setVar('--bridge-y', `${(my * 4 + sharedHeroY - frame2.exit * 760).toFixed(1)}px`);
  setVar('--bridge-bottom', `${(5 - frame2.enter * 13).toFixed(2)}vh`);
  setVar('--bridge-width', `${(67.2 + frame2.enter * 37.8).toFixed(2)}vw`);
  setVar('--bridge-scale', (1.02 + sharedHeroScale + frame2.exit * 0.46).toFixed(4));

  setVar('--split-left-x', `calc(-50% + ${(-splitDrift * 46).toFixed(2)}vw + ${(mx * 11).toFixed(2)}px)`);
  setVar('--split-left-y', `${(my * 5 + sharedHeroY - splitDrift * 180).toFixed(1)}px`);
  setVar('--split-left-scale', (1 + sharedHeroScale + frame2.enter * 0.74).toFixed(4));
  setVar('--split-right-x', `calc(-50% + ${(splitDrift * 46).toFixed(2)}vw + ${(mx * 11).toFixed(2)}px)`);
  setVar('--split-right-y', `${(my * 5 + sharedHeroY - splitDrift * 180).toFixed(1)}px`);
  setVar('--split-right-scale', (1 + sharedHeroScale + frame2.enter * 0.74).toFixed(4));
  // pintu terbelah SEKALIGUS memudar: foto opaque tak bisa minggir total dgn drift 46vw,
  // fade pastikan frame-two tak tertutup sisa belahan; yang sudah 0 dikeluarkan dari composite
  const splitOp = 1 - frame2.exit;
  setVar('--split-opacity', splitOp.toFixed(3));
  const showSplits = splitOp > 0.02;
  if (showSplits !== splitShown) { splitShown = showSplits; for (const el of splitEls) setVis(el, showSplits); }

  setVar('--frame2-opacity', frame2Opacity.toFixed(4));
  if ((frame2Opacity > 0.02) !== frame2Shown) { frame2Shown = frame2Opacity > 0.02; setVis(frame2El, frame2Shown); }
  setVar('--frame2-x', `calc(-50% + ${(mx * 5).toFixed(2)}px)`);
  setVar('--frame2-y', `calc(-50% + ${(my * 4 - frame2.exit * 150).toFixed(1)}px)`);
  setVar('--frame2-scale', (1.06 + frame2.enter * 0.08 + frame2.exit * 0.08).toFixed(4));

  setVar('--intro-copy-y', `${(introExit * 90).toFixed(1)}px`);
  setVar('--intro-copy-opacity', (1 - introExit).toFixed(4));
  setVar('--panel2-opacity', panel2Opacity.toFixed(4));
  setVar('--panel2-y', `calc(-50% + ${(-frame2.exit * 86 + (1 - frame2.enter) * 58).toFixed(1)}px)`);
  setVar('--panel3-opacity', panel3Opacity.toFixed(4));
  setVar('--panel3-y', `calc(-50% + ${(-frame3.exit * 86 + (1 - frame3.enter) * 58).toFixed(1)}px)`);

  if (Math.abs(mouseX - targetMouseX) > 0.001 || Math.abs(mouseY - targetMouseY) > 0.001) requestTick();
}
function requestTick() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(update);
}

/* ---------- detents: scroll film nge-grid seperti potensio ber-takik ----------
   0 = opening · 1100 = panel couple · 2340 = panel event · 2650 = akhir film.
   Magnet hanya aktif saat scroll melambat/berhenti di dekat takik, lalu dijentik halus + getar 3ms. */
const DETENTS = [0, 1100, 2340, 2650];
const DETENT_RADIUS = 170;
let snapTimer = 0, snapping = false;
function nearestDetent(local) {
  let best = null, bd = Infinity;
  for (const d of DETENTS) { const diff = Math.abs(d - local); if (diff < bd) { bd = diff; best = d; } }
  return bd <= DETENT_RADIUS ? best : null;
}
function settleToDetent() {
  snapTimer = 0;
  if (snapping || reduceMotion.matches || document.body.classList.contains('locked')) return;
  const y = window.scrollY;
  if (y < cinemaTop - window.innerHeight * 0.5 || y > cinemaBottom) return;
  const d = nearestDetent(y - cinemaTop);
  if (d === null || Math.abs(d - (y - cinemaTop)) < 4) return;
  snapping = true;
  try { if (navigator.vibrate) navigator.vibrate(3); } catch (e) {}
  window.scrollTo({ top: cinemaTop + d, behavior: 'smooth' });
  setTimeout(() => { snapping = false; }, 750);
}
function scheduleSettle() {
  if (snapping) return;
  if (snapTimer) clearTimeout(snapTimer);
  snapTimer = setTimeout(settleToDetent, 150);
}
window.addEventListener('scrollend', settleToDetent);

/* ---------- chapter stepper: 1 gestur scroll = 1 timeline berikutnya ----------
   Di dalam area film, scroll biasa dibajak: tiap swipe/putaran wheel melompat
   tepat ke detent berikut/sebelumnya. Di tepi (awal/akhir) scroll native
   dibiarkan agar user bisa keluar-masuk film dengan natural. */
let chapAnimating = false, chapTarget = 0;
const inFilmStrict = () => {
  const local = window.scrollY - cinemaTop;
  return local > 40 && local < cinemaRange - 40;
};
function detentIndexInDir(local, dir) {
  if (dir > 0) {
    for (let i = 0; i < DETENTS.length; i++) if (DETENTS[i] > local + 8) return i;
  } else {
    for (let i = DETENTS.length - 1; i >= 0; i--) if (DETENTS[i] < local - 8) return i;
  }
  return null;
}
function gotoDetent(i) {
  chapAnimating = true; snapping = true;
  chapTarget = cinemaTop + DETENTS[i];
  try { if (navigator.vibrate) navigator.vibrate(3); } catch (e) {}
  window.scrollTo({ top: chapTarget, behavior: 'smooth' });
  setTimeout(() => { chapAnimating = false; snapping = false; }, 900);
}
window.addEventListener('wheel', (e) => {
  if (reduceMotion.matches || document.body.classList.contains('locked')) return;
  if (!inFilmStrict()) return;
  if (chapAnimating) { e.preventDefault(); return; }
  const idx = detentIndexInDir(window.scrollY - cinemaTop, e.deltaY > 0 ? 1 : -1);
  if (idx === null) return; // tepi film: biarkan scroll native keluar
  e.preventDefault();
  gotoDetent(idx);
}, { passive: false });
let touchStartY = null;
window.addEventListener('touchstart', (e) => {
  touchStartY = inFilmStrict() ? e.touches[0].clientY : null;
}, { passive: true });
window.addEventListener('touchmove', (e) => {
  if (touchStartY === null || document.body.classList.contains('locked')) return;
  if (!inFilmStrict()) { touchStartY = null; return; }
  e.preventDefault();
}, { passive: false });
window.addEventListener('touchend', (e) => {
  if (touchStartY === null) return;
  const dy = touchStartY - e.changedTouches[0].clientY;
  touchStartY = null;
  if (chapAnimating || reduceMotion.matches || document.body.classList.contains('locked')) return;
  if (Math.abs(dy) < 40 || !inFilmStrict()) return;
  const idx = detentIndexInDir(window.scrollY - cinemaTop, dy > 0 ? 1 : -1);
  if (idx === null) {
    // mentok di ujung: dorong sedikit agar lepas ke scroll native
    window.scrollBy({ top: dy > 0 ? 160 : -160, behavior: 'smooth' });
    return;
  }
  gotoDetent(idx);
});
window.addEventListener('keydown', (e) => {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
  if (reduceMotion.matches || document.body.classList.contains('locked') || chapAnimating) return;
  if (!inFilmStrict()) return;
  const nextKeys = ['ArrowDown', 'PageDown', ' '];
  const prevKeys = ['ArrowUp', 'PageUp'];
  let dir = 0;
  if (nextKeys.includes(e.key)) dir = 1;
  else if (prevKeys.includes(e.key)) dir = -1;
  else return;
  const idx = detentIndexInDir(window.scrollY - cinemaTop, dir);
  if (idx === null) return;
  e.preventDefault();
  gotoDetent(idx);
});

/* ---------- single scroll handler: engine + progress + nav + parallax ----------
   (deklarasi sectionIds dkk sudah di atas, dipakai measureChrome sejak load) */
let chromePending = false;
function updateChrome() {
  chromePending = false;
  const y = window.scrollY, vh = window.innerHeight;
  if (progressBar) progressBar.style.width = ((y / docH) * 100).toFixed(2) + '%';
  let current = sectionIds[0];
  const edge = y + vh * 0.46;
  for (let i = 0; i < sectionIds.length; i++) if (secTops[i] < edge) current = sectionIds[i];
  for (const a of navLinks) a.classList.toggle('active', a.getAttribute('href') === '#' + current);
  if (!reduceMotion.matches) {
    for (const d of parallaxData) {
      if (d.top + d.h < y || d.top > y + vh) continue;
      const mid = (d.top + d.h / 2) - y - vh / 2;
      d.img.style.transform = `translateY(${(mid * -0.035).toFixed(1)}px)`;
    }
  }
}
function onScroll() {
  // lepas kunci chapter begitu animasi mendarat (jangan tunggu timeout)
  if (chapAnimating && Math.abs(window.scrollY - chapTarget) < 8) { chapAnimating = false; snapping = false; }
  requestTick();
  scheduleSettle();
  if (!chromePending) { chromePending = true; requestAnimationFrame(updateChrome); }
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => { measure(); requestTick(); });
window.addEventListener('load', () => { measure(); requestTick(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); });
/* enteng: HP tanpa hover tidak butuh parallax pointer (sentuh = rAF churn) */
const noHover = matchMedia('(hover: none)').matches;
window.addEventListener('pointermove', (e) => {
  if (noHover) return;
  targetMouseX = e.clientX / window.innerWidth - 0.5;
  targetMouseY = e.clientY / window.innerHeight - 0.5;
  requestTick();
}, { passive: true });
const toEvent = document.getElementById('toEvent');
if (toEvent) toEvent.addEventListener('click', () => document.getElementById('event')?.scrollIntoView({ behavior: 'smooth' }));

/* ---------- gate + music toggle ---------- */
const params = new URLSearchParams(location.search);
const guest = params.get('to') || params.get('guest');
if (guest) { const g = document.getElementById('guestName'); if (g) g.textContent = guest; }
const gate = document.getElementById('gate'), main = document.getElementById('mainContent'), nav = document.getElementById('bottomNav');
const openBtn = document.getElementById('openInvitation');
if (openBtn) openBtn.addEventListener('click', () => {
  setMusic(true);
  if (gate) { gate.classList.add('opened'); setTimeout(() => gate.style.display = 'none', 1150); }
  document.body.classList.remove('locked');
  if (main) main.setAttribute('aria-hidden', 'false');
  if (nav) nav.classList.add('visible');
  measure(); requestTick();
});
const musicToggle = document.getElementById('musicToggle');
if (musicToggle) musicToggle.addEventListener('click', (e) => { e.stopPropagation(); setMusic(!musicOn); });

/* ---------- reveals, forms, lightbox ---------- */
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in-view'); }), { threshold: 0.16 });
document.querySelectorAll('.reveal-section,.reveal-card').forEach((el) => io.observe(el));

const calBtn = document.getElementById('calendarBtn');
if (calBtn) calBtn.addEventListener('click', () => {
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Adam & Nadhila//Wedding//ID','BEGIN:VEVENT','UID:adam-nadhila-20261226','DTSTAMP:20260918T000000Z','DTSTART:20261226T020000Z','SUMMARY:Pernikahan Adam & Nadhila','LOCATION:Jl. Nilam II No. 5\\, Jatiraden\\, Jatisampurna\\, Bekasi 17433','DESCRIPTION:The Wedding of Adam Alfiansyah & Nadhila Rachmawati\\, S.Psi.','END:VEVENT','END:VCALENDAR'].join('\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Adam-Nadhila-26-12-2026.ics'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
const copyBtn = document.getElementById('copyAccount');
if (copyBtn) copyBtn.addEventListener('click', async (e) => {
  try { await navigator.clipboard.writeText('7401662727'); } catch (err) {}
  const old = e.currentTarget.textContent; e.currentTarget.textContent = 'Nomor rekening disalin ✓';
  setTimeout(() => e.currentTarget.textContent = old, 2200);
});
const form = document.getElementById('rsvpForm'), status = document.getElementById('formStatus');
if (form) form.addEventListener('submit', async (e) => {
  e.preventDefault(); if (status) status.textContent = 'Mengirim...';
  const fd = new FormData(form);
  try {
    const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fd).toString() });
    if (!res.ok) throw new Error();
    form.reset(); if (status) status.textContent = 'Terima kasih. Sampai bertemu di hari bahagia kami.';
  } catch (err) { if (status) status.textContent = 'Konfirmasi belum terkirim. Silakan coba lagi.'; }
});
const dlg = document.getElementById('lightbox'), dlgImg = document.getElementById('lightboxImage');
document.querySelectorAll('.gallery-item').forEach((b) => b.addEventListener('click', () => {
  if (dlgImg) dlgImg.src = b.dataset.src; if (dlg && dlg.showModal) dlg.showModal();
}));
const closeLb = document.getElementById('closeLightbox');
if (closeLb) closeLb.addEventListener('click', () => dlg && dlg.close());
if (dlg) dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

/* ---------- load ---------- */
requestTick();
