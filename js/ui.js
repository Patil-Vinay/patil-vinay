// Page side: boot screen, chapter rail, text scramble, cursor, tilt cards, certificates and lightbox.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fine = matchMedia('(pointer: fine)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function boot() {
  const el = $('#boot'), out = $('#boot-log'), bar = $('#boot-bar');
  const t0 = performance.now();
  return (msg, p, last) => {
    const line = document.createElement('div');
    line.textContent = msg;
    out.appendChild(line);
    out.scrollTop = out.scrollHeight;
    if (p !== undefined) bar.style.width = `${Math.round(p * 100)}%`;
    if (last) {
      const wait = Math.max(0, 1500 - (performance.now() - t0));
      setTimeout(() => {
        el.classList.add('done');
        document.body.classList.add('ready');
        $$('.chapter.on h1, .chapter.on h2').forEach(scramble);
        setTimeout(() => el.remove(), 1200);
      }, wait);
    }
  };
}

const GLYPHS = '01<>/\\[]{}#$%&*+=?ABCDEFGHJKLMNPRSTUVXYZ';
function scramble(el) {
  if (reduced || el.dataset.busy) return;
  const text = el.dataset.text || (el.dataset.text = el.textContent);
  el.dataset.busy = 1;
  let f = 0;
  const total = 26;
  const run = () => {
    const done = Math.floor((f / total) * text.length);
    el.textContent = [...text].map((ch, i) => (i < done || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
    if (++f <= total) requestAnimationFrame(run);
    else { el.textContent = text; delete el.dataset.busy; }
  };
  run();
}

export function initUI({ measure }) {
  // chapter rail
  const rail = $('#rail');
  const chapters = $$('[data-label]');
  chapters.forEach((sec, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<i></i><span>${sec.dataset.label}</span>`;
    b.setAttribute('aria-label', `Go to ${sec.dataset.label}`);
    b.addEventListener('click', () => sec.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: sec.classList.contains('chapter') ? 'center' : 'start' }));
    rail.appendChild(b);
  });
  const railBtns = $$('button', rail);

  // fade chapter cards in and out around the middle of the screen
  const cards = $$('.chapter');
  const progress = $('#progress');
  let lastActive = -1;
  const onScroll = () => {
    const vh = innerHeight;
    cards.forEach(sec => {
      const r = sec.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - vh / 2) / vh;
      const v = Math.max(0, Math.min(1, 1 - (d - 0.18) / 0.32));
      sec.style.setProperty('--vis', v.toFixed(3));
      const on = v > 0.6;
      if (on && !sec.classList.contains('on')) { sec.classList.add('on'); if (document.body.classList.contains('ready')) $$('h1, h2', sec).forEach(scramble); }
      else if (!on) sec.classList.remove('on');
    });
    let active = 0;
    chapters.forEach((sec, i) => { if (sec.getBoundingClientRect().top < vh * 0.55) active = i; });
    if (active !== lastActive) { railBtns.forEach((b, i) => b.classList.toggle('on', i === active)); lastActive = active; }
    const max = document.documentElement.scrollHeight - vh;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  // panels scramble their heading once when they come in
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); $$('h2', e.target).forEach(scramble); io.unobserve(e.target); }
  }), { threshold: 0.15 });
  $$('.panel').forEach(p => io.observe(p));
  const io2 = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io2.unobserve(e.target); } }), { threshold: 0.1 });
  $$('.rise').forEach(p => io2.observe(p));

  // reticle cursor
  if (fine && !reduced) {
    const cur = $('#cursor'), xy = $('#cursor-xy');
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; });
    const loop = () => {
      cx += (x - cx) * 0.25; cy += (y - cy) * 0.25;
      cur.style.transform = `translate(${cx}px, ${cy}px)`;
      xy.textContent = `${String(Math.round(x)).padStart(4, '0')} ${String(Math.round(y)).padStart(4, '0')}`;
      requestAnimationFrame(loop);
    };
    loop();
    document.addEventListener('pointerover', e => cur.classList.toggle('hot', !!e.target.closest('a, button, .tilt, [data-zoom]')));
    document.body.classList.add('has-cursor');
  }

  // holo tilt on cards
  if (fine && !reduced) $$('.tilt').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--rx', `${(0.5 - py) * 8}deg`);
      card.style.setProperty('--ry', `${(px - 0.5) * 10}deg`);
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  });

  // certificate filter
  const chips = $$('#cert-filter button');
  chips.forEach(c => c.addEventListener('click', () => {
    chips.forEach(b => b.classList.toggle('on', b === c));
    const f = c.dataset.f;
    $$('#cert-fold .cert').forEach(el => { el.hidden = f !== 'all' && !el.dataset.g.split(' ').includes(f); });
    measure();
  }));

  // gallery rows: same speed whatever their length
  const pace = () => $$('.marquee .track').forEach(t => t.style.setProperty('--dur', (t.scrollWidth / 2 / 42).toFixed(1) + 's'));
  pace();
  addEventListener('resize', pace);

  // certificates open and close: label and section height change
  const fold = $('#cert-fold');
  if (fold) fold.addEventListener('toggle', () => {
    fold.querySelector('summary span').textContent = fold.open ? 'Hide certificates' : 'Show 27 more certificates';
    measure();
  });

  // lightbox for images and certificates
  const box = $('#lightbox'), img = $('#lightbox img'), cap = $('#lightbox p');
  document.addEventListener('click', e => {
    const z = e.target.closest('[data-zoom]');
    if (!z) return;
    e.preventDefault();
    img.src = z.dataset.zoom;
    img.alt = z.dataset.cap || '';
    cap.textContent = z.dataset.cap || '';
    box.showModal();
  });
  box.addEventListener('click', () => box.close());

  // headings hover glitch
  $$('.glitch').forEach(el => el.setAttribute('data-g', el.textContent));
  $('#year').textContent = new Date().getFullYear();
  // images load late and change the page height
  $$('img').forEach(i => { if (!i.complete) i.addEventListener('load', measure, { once: true }); });
}
