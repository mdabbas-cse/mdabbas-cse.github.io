/* ============================================================
   MD. ABBAS UDDIN — PORTFOLIO SCRIPT
   Vanilla JavaScript · no libraries
   ------------------------------------------------------------
   MODULES
   01. Helpers & feature detection
   02. Page loader
   03. Custom cursor + mouse-follow glow
   04. Header (scroll state + mobile nav)
   05. Active navigation indicator (scroll spy)
   06. Scroll progress bar
   07. Smooth anchor scrolling
   08. Reveal on scroll (IntersectionObserver)
   09. Hero line + word stagger
   10. Counter animations
   11. Skill bars
   12. Timeline progress
   13. Parallax
   14. Contact form validation
   15. Footer year
============================================================ */

(function () {
  'use strict';

  /* --------------------------------------------------------
     01. HELPERS & FEATURE DETECTION
  -------------------------------------------------------- */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none), (max-width: 768px)').matches;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    pageLoader();
    customCursor();
    header();
    activeNav();
    progressBar();
    smoothScroll();
    revealOnScroll();
    counters();
    skillBars();
    timelineProgress();
    parallax();
    contactForm();
    footerYear();
  }

  /* --------------------------------------------------------
     02. PAGE LOADER  (counts 0 → 100 then slides away)
  -------------------------------------------------------- */
  function pageLoader() {
    const loader = $('#loader');
    const count  = $('#loaderCount');
    if (!loader) return;

    if (prefersReduced) {
      loader.classList.add('is-done');
      document.body.classList.add('cursor-ready');
      startHero();
      return;
    }

    let n = 0;
    const tick = () => {
      n += Math.floor(Math.random() * 8) + 3;
      if (n >= 100) n = 100;
      if (count) count.textContent = n;
      if (n < 100) {
        setTimeout(tick, 55 + Math.random() * 55);
      } else {
        setTimeout(() => {
          loader.classList.add('is-done');
          document.body.classList.add('cursor-ready');
          startHero();
        }, 320);
      }
    };
    tick();
  }

  /* Kick off hero reveal once loader has gone */
  function startHero() {
    const hero = $('#hero');
    if (hero) hero.classList.add('is-visible');
    heroStagger();
  }

  /* --------------------------------------------------------
     03. CUSTOM CURSOR + MOUSE-FOLLOW GLOW
  -------------------------------------------------------- */
  function customCursor() {
    if (isTouch) return;
    const ring = $('#cursor');
    const dot  = $('#cursorDot');
    const glow = $('#mouseGlow');
    if (!ring || !dot) return;

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rx = mx, ry = my;     // ring (eased)
    let gx = mx, gy = my;     // glow (slower)

    window.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });

    const render = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      gx += (mx - gx) * 0.08;
      gy += (my - gy) * 0.08;

      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      dot.style.transform  = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
      if (glow) glow.style.transform = `translate(${gx}px, ${gy}px) translate(-50%, -50%)`;
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);

    // Hover state on interactive elements
    $$('[data-cursor="hover"]').forEach((el) => {
      el.addEventListener('mouseenter', () => ring.classList.add('is-hover'));
      el.addEventListener('mouseleave', () => ring.classList.remove('is-hover'));
    });
  }

  /* --------------------------------------------------------
     04. HEADER — scrolled state + mobile nav toggle
  -------------------------------------------------------- */
  function header() {
    const head   = $('#header');
    const toggle = $('#navToggle');
    const nav    = $('#nav');

    const onScroll = () => {
      if (head) head.classList.toggle('is-scrolled', window.scrollY > 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('is-open');
        toggle.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        document.body.style.overflow = open ? 'hidden' : '';
      });
      $$('.nav__link', nav).forEach((link) =>
        link.addEventListener('click', () => {
          nav.classList.remove('is-open');
          toggle.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
        })
      );
    }
  }

  /* --------------------------------------------------------
     05. ACTIVE NAVIGATION INDICATOR (scroll spy)
  -------------------------------------------------------- */
  function activeNav() {
    const links = $$('.nav__link');
    const map = new Map();
    links.forEach((l) => {
      const id = l.getAttribute('href');
      if (id && id.startsWith('#')) {
        const sec = document.querySelector(id);
        if (sec) map.set(sec, l);
      }
    });
    if (!map.size || !('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          links.forEach((l) => l.classList.remove('is-active'));
          const link = map.get(entry.target);
          if (link) link.classList.add('is-active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    map.forEach((_, sec) => io.observe(sec));
  }

  /* --------------------------------------------------------
     06. SCROLL PROGRESS BAR
  -------------------------------------------------------- */
  function progressBar() {
    const bar = $('#progressBar');
    if (!bar) return;
    const update = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const pct = h > 0 ? (window.scrollY / h) * 100 : 0;
      bar.style.width = pct + '%';
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  /* --------------------------------------------------------
     07. SMOOTH ANCHOR SCROLL (with header offset)
  -------------------------------------------------------- */
  function smoothScroll() {
    $$('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('href');
        if (id.length < 2) return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top, behavior: prefersReduced ? 'auto' : 'smooth' });
      });
    });
  }

  /* --------------------------------------------------------
     08. REVEAL ON SCROLL
  -------------------------------------------------------- */
  function revealOnScroll() {
    const items = $$('[data-reveal]');
    $$('[data-words]').forEach(prepWords);

    if (!('IntersectionObserver' in window) || prefersReduced) {
      items.forEach((el) => el.classList.add('is-visible'));
      $$('[data-words]').forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const delay = el.getAttribute('data-reveal-delay');
        if (delay) el.style.setProperty('--reveal-delay', delay + 's');
        el.classList.add('is-visible');
        obs.unobserve(el);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    items.forEach((el) => io.observe(el));

    const wio = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.3 });
    $$('[data-words]').forEach((el) => wio.observe(el));
  }

  /* Split a [data-words] block into individually animated words */
  function prepWords(block) {
    const text = block.textContent.trim();
    block.textContent = '';
    text.split(/\s+/).forEach((w, i) => {
      const word = document.createElement('span');
      word.className = 'word';
      const inner = document.createElement('span');
      inner.textContent = w;
      inner.style.setProperty('--word-delay', (i * 0.045) + 's');
      word.appendChild(inner);
      block.appendChild(word);
      block.appendChild(document.createTextNode(' '));
    });
  }

  /* --------------------------------------------------------
     09. HERO LINE STAGGER
  -------------------------------------------------------- */
  function heroStagger() {
    $$('[data-stagger]').forEach((el, i) => {
      el.style.setProperty('--stagger-delay', (0.15 + i * 0.12) + 's');
    });
  }

  /* --------------------------------------------------------
     10. COUNTER ANIMATIONS
  -------------------------------------------------------- */
  function counters() {
    const els = $$('[data-counter]');
    if (!els.length) return;

    const animate = (el) => {
      const target = parseInt(el.getAttribute('data-counter'), 10);
      const suffix = el.getAttribute('data-suffix') || '';
      if (prefersReduced) { el.textContent = target + suffix; return; }
      const dur = 1700;
      const start = performance.now();
      const step = (now) => {
        const p = clamp((now - start) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);     // easeOutCubic
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { animate(e.target); obs.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    els.forEach((el) => io.observe(el));
  }

  /* --------------------------------------------------------
     11. SKILL BARS (animate width when category enters)
  -------------------------------------------------------- */
  function skillBars() {
    const cats = $$('.skill-cat');
    if (!cats.length) return;

    const fill = (cat) => {
      $$('.skill__bar i', cat).forEach((bar) => {
        const val = parseInt(bar.getAttribute('data-bar') || '0', 10);
        bar.style.width = val + '%';
      });
    };

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { fill(e.target); obs.unobserve(e.target); }
      });
    }, { threshold: 0.3 });
    cats.forEach((c) => io.observe(c));
  }

  /* --------------------------------------------------------
     12. TIMELINE PROGRESS LINE
  -------------------------------------------------------- */
  function timelineProgress() {
    const wrap = $('.timeline');
    const prog = $('#timelineProgress');
    if (!wrap || !prog) return;

    const update = () => {
      const rect = wrap.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height;
      const scrolled = clamp((vh * 0.5 - rect.top) / total, 0, 1);
      prog.style.height = (scrolled * 100) + '%';
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  /* --------------------------------------------------------
     13. PARALLAX  (translateY on [data-parallax])
  -------------------------------------------------------- */
  function parallax() {
    if (prefersReduced) return;
    const els = $$('[data-parallax]');
    if (!els.length) return;

    let ticking = false;
    const run = () => {
      const vh = window.innerHeight;
      els.forEach((el) => {
        const speed = parseFloat(el.getAttribute('data-parallax')) || 0.1;
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > vh) return;
        const offset = (rect.top + rect.height / 2 - vh / 2) * -speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });
      ticking = false;
    };
    const onScroll = () => { if (!ticking) { requestAnimationFrame(run); ticking = true; } };
    run();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', run);
  }

  /* --------------------------------------------------------
     14. CONTACT FORM VALIDATION
  -------------------------------------------------------- */
  function contactForm() {
    const form = $('#contactForm');
    if (!form) return;
    const success = $('#formSuccess');
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Company is optional — only validated fields are required
    const fields = {
      name:    { el: $('#name'),    test: (v) => v.trim().length >= 2,   msg: 'Please enter your name.' },
      email:   { el: $('#email'),   test: (v) => emailRe.test(v.trim()), msg: 'Please enter a valid email.' },
      message: { el: $('#message'), test: (v) => v.trim().length >= 10,  msg: 'Tell me a little more (10+ chars).' },
    };

    const setError = (key, show) => {
      const f = fields[key];
      const wrap = f.el.closest('.field');
      const err = $('[data-error]', wrap);
      wrap.classList.toggle('has-error', show);
      if (err) err.textContent = show ? f.msg : '';
    };

    Object.keys(fields).forEach((key) => {
      const f = fields[key];
      f.el.addEventListener('blur', () => setError(key, !f.test(f.el.value)));
      f.el.addEventListener('input', () => {
        if (f.el.closest('.field').classList.contains('has-error')) {
          setError(key, !f.test(f.el.value));
        }
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let valid = true;
      Object.keys(fields).forEach((key) => {
        const ok = fields[key].test(fields[key].el.value);
        setError(key, !ok);
        if (!ok && valid) { fields[key].el.focus(); valid = false; }
      });
      if (!valid) return;

      // No backend wired — simulate a successful send
      if (success) success.hidden = false;
      form.reset();
      setTimeout(() => { if (success) success.hidden = true; }, 6000);
    });
  }

  /* --------------------------------------------------------
     15. FOOTER YEAR
  -------------------------------------------------------- */
  function footerYear() {
    const y = $('#year');
    if (y) y.textContent = new Date().getFullYear();
  }

})();
