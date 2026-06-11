/* ============================================================
   SPACE BATTLE — game.js
   Vanilla JS arcade shooter. No libraries.
   - requestAnimationFrame loop with delta time
   - Bounding-box collision
   - Responsive canvas (devicePixelRatio aware)
   - Keyboard + touch controls
   - Particles, sound (WebAudio), localStorage best, vibration
============================================================ */
(() => {
  "use strict";

  // ---- DOM ----------------------------------------------------
  const shell = document.getElementById("game");
  const board = document.getElementById("board");
  const starsCanvas = document.getElementById("stars");
  const ctx = board.getContext("2d");
  const sctx = starsCanvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const livesEl = document.getElementById("lives");
  const startScreen = document.getElementById("startScreen");
  const overScreen = document.getElementById("overScreen");
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");
  const finalScoreEl = document.getElementById("finalScore");
  const finalBestEl = document.getElementById("finalBest");

  const btnLeft = document.getElementById("btnLeft");
  const btnRight = document.getElementById("btnRight");
  const btnFire = document.getElementById("btnFire");

  // ---- Config -------------------------------------------------
  const BEST_KEY = "spaceBattleBest";
  const STATE = { MENU: 0, PLAYING: 1, OVER: 2 };

  // Logical (CSS-pixel) size of the play area; refreshed on resize.
  let W = 0;
  let H = 0;
  let dpr = 1;

  // ---- Audio (tiny WebAudio synth, no asset files) -----------
  const Sound = (() => {
    let actx = null;
    let enabled = true;
    const ensure = () => {
      if (!enabled) return null;
      try {
        if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
        if (actx.state === "suspended") actx.resume();
      } catch (e) {
        enabled = false;
        return null;
      }
      return actx;
    };
    const blip = (freq, dur, type, gain) => {
      const ac = ensure();
      if (!ac) return;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      g.gain.setValueAtTime(gain || 0.06, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur);
    };
    return {
      unlock: ensure,
      shoot: () => blip(880, 0.09, "square", 0.04),
      explode: () => {
        blip(140, 0.22, "sawtooth", 0.07);
        blip(70, 0.3, "triangle", 0.05);
      },
      hit: () => blip(110, 0.35, "sawtooth", 0.09),
      over: () => {
        blip(200, 0.18, "square", 0.06);
        setTimeout(() => blip(120, 0.4, "sawtooth", 0.07), 120);
      },
    };
  })();

  const vibrate = (pattern) => {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  };

  // ---- Resize handling ---------------------------------------
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = shell.getBoundingClientRect();
    W = Math.round(rect.width);
    H = Math.round(rect.height);

    for (const c of [board, starsCanvas]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildStars();
    if (game) game.onResize();
  }

  // ---- Starfield (its own light loop, always running) --------
  let stars = [];
  function buildStars() {
    const count = Math.round((W * H) / 6000);
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rand(0, W),
        y: rand(0, H),
        r: rand(0.4, 1.6),
        s: rand(8, 40), // px per second
        a: rand(0.2, 1),
      });
    }
  }
  function drawStars(dt) {
    sctx.clearRect(0, 0, W, H);
    for (const st of stars) {
      st.y += st.s * dt;
      if (st.y > H) {
        st.y = -2;
        st.x = rand(0, W);
      }
      sctx.globalAlpha = st.a;
      sctx.fillStyle = st.r > 1.1 ? "#9fd8ff" : "#ffffff";
      sctx.fillRect(st.x, st.y, st.r, st.r * 2.2);
    }
    sctx.globalAlpha = 1;
  }

  // ---- Helpers ------------------------------------------------
  function rand(min, max) { return min + Math.random() * (max - min); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function aabb(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  // ============================================================
  //  GAME
  // ============================================================
  class Game {
    constructor() {
      this.state = STATE.MENU;
      this.best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
      bestEl.textContent = this.best;

      this.keys = { left: false, right: false, fire: false };
      this.mouseX = null;     // last known mouse X (CSS px, relative to shell)
      this.mouseActive = false; // true while the mouse is steering the ship
      this.reset();
    }

    reset() {
      this.score = 0;
      this.lives = 3;
      this.elapsed = 0;
      this.shootCooldown = 0;
      this.spawnTimer = 0;
      this.bullets = [];
      this.enemies = [];
      this.particles = [];

      const size = clamp(Math.min(W, H) * 0.11, 34, 64);
      this.player = {
        w: size,
        h: size,
        x: W / 2 - size / 2,
        y: H - size - this.bottomInset(),
        speed: Math.max(W, 380) * 0.9, // px/sec, scales a little with width
      };
      this.syncHud();
    }

    bottomInset() {
      // keep the ship above the touch controls
      return clamp(H * 0.14, 70, 120);
    }

    onResize() {
      // Keep player in bounds and pinned to the bottom band after a resize.
      if (!this.player) return;
      this.player.x = clamp(this.player.x, 0, W - this.player.w);
      this.player.y = H - this.player.h - this.bottomInset();
    }

    start() {
      this.reset();
      this.state = STATE.PLAYING;
      startScreen.classList.add("overlay--hidden");
      overScreen.classList.add("overlay--hidden");
      Sound.unlock();
    }

    gameOver() {
      this.state = STATE.OVER;
      if (this.score > this.best) {
        this.best = this.score;
        localStorage.setItem(BEST_KEY, String(this.best));
        bestEl.textContent = this.best;
      }
      finalScoreEl.textContent = this.score;
      finalBestEl.textContent = this.best;
      overScreen.classList.remove("overlay--hidden");
      Sound.over();
      vibrate([60, 40, 120]);
    }

    syncHud() {
      scoreEl.textContent = this.score;
      bestEl.textContent = Math.max(this.best, this.score);
      livesEl.textContent = this.lives > 0 ? "♥".repeat(this.lives) : "—";
    }

    // ---- difficulty curves ----
    get spawnInterval() {
      // starts ~1.1s, ramps toward ~0.38s
      return Math.max(0.38, 1.1 - this.elapsed * 0.012);
    }
    get enemySpeed() {
      // base downward speed grows with time, scaled to screen height
      return (H * 0.12) + this.elapsed * (H * 0.0045);
    }

    spawnEnemy() {
      const size = clamp(Math.min(W, H) * 0.085, 26, 52);
      this.enemies.push({
        w: size,
        h: size,
        x: rand(0, W - size),
        y: -size,
        vy: this.enemySpeed * rand(0.85, 1.2),
        hue: rand(0, 1) > 0.5 ? "#ff6b8b" : "#b66bff",
        wob: rand(0, Math.PI * 2),
      });
    }

    fire() {
      if (this.shootCooldown > 0 || this.state !== STATE.PLAYING) return;
      const bw = clamp(W * 0.012, 4, 7);
      this.bullets.push({
        w: bw,
        h: clamp(H * 0.03, 14, 22),
        x: this.player.x + this.player.w / 2 - bw / 2,
        y: this.player.y - 8,
        vy: H * 1.4,
      });
      this.shootCooldown = 0.28; // cooldown in seconds
      Sound.shoot();
      vibrate(8);
    }

    spawnExplosion(x, y, color) {
      const n = 14;
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n + rand(-0.3, 0.3);
        const sp = rand(40, 200);
        this.particles.push({
          x, y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          life: rand(0.3, 0.7),
          age: 0,
          r: rand(1.5, 3.5),
          color,
        });
      }
    }

    // ---- update -------------------------------------------------
    update(dt) {
      if (this.state !== STATE.PLAYING) return;
      this.elapsed += dt;
      this.shootCooldown -= dt;

      // input -> movement
      // Priority: keyboard/touch buttons when held, otherwise follow the mouse.
      const p = this.player;
      let dir = 0;
      if (this.keys.left) dir -= 1;
      if (this.keys.right) dir += 1;
      if (dir !== 0) {
        this.mouseActive = false; // pressing a key takes over from the mouse
        p.x = clamp(p.x + dir * p.speed * dt, 0, W - p.w);
      } else if (this.mouseActive && this.mouseX != null) {
        const target = clamp(this.mouseX - p.w / 2, 0, W - p.w);
        p.x += (target - p.x) * Math.min(1, dt * 18); // smooth follow
      }
      if (this.keys.fire) this.fire();

      // bullets
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.y -= b.vy * dt;
        if (b.y + b.h < 0) this.bullets.splice(i, 1);
      }

      // spawn enemies
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.spawnTimer = this.spawnInterval;
      }

      // enemies
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        e.wob += dt * 2;
        e.y += e.vy * dt;
        e.x = clamp(e.x + Math.sin(e.wob) * (W * 0.05) * dt, 0, W - e.w);
        // reached bottom -> lose life
        if (e.y > H) {
          this.enemies.splice(i, 1);
          this.loseLife(e);
          continue;
        }
        // hit player
        if (aabb(e, p)) {
          this.enemies.splice(i, 1);
          this.spawnExplosion(p.x + p.w / 2, p.y + p.h / 2, "#38e8ff");
          this.loseLife(e);
          continue;
        }
      }

      // bullet vs enemy
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        for (let j = this.bullets.length - 1; j >= 0; j--) {
          if (aabb(e, this.bullets[j])) {
            this.spawnExplosion(e.x + e.w / 2, e.y + e.h / 2, e.hue);
            this.enemies.splice(i, 1);
            this.bullets.splice(j, 1);
            this.score += 10;
            this.syncHud();
            Sound.explode();
            vibrate(12);
            break;
          }
        }
      }

      // particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.age += dt;
        if (pt.age >= pt.life) { this.particles.splice(i, 1); continue; }
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.96;
        pt.vy *= 0.96;
      }
    }

    loseLife() {
      this.lives -= 1;
      this.syncHud();
      Sound.hit();
      vibrate([30, 30, 30]);
      if (this.lives <= 0) this.gameOver();
    }

    // ---- render -------------------------------------------------
    draw() {
      ctx.clearRect(0, 0, W, H);
      if (this.state === STATE.MENU) return;

      // particles (behind ships)
      for (const pt of this.particles) {
        ctx.globalAlpha = clamp(1 - pt.age / pt.life, 0, 1);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // bullets
      for (const b of this.bullets) {
        ctx.fillStyle = "#9af7ff";
        ctx.shadowColor = "#38e8ff";
        ctx.shadowBlur = 12;
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      ctx.shadowBlur = 0;

      // enemies
      for (const e of this.enemies) this.drawEnemy(e);

      // player
      if (this.state === STATE.PLAYING) this.drawPlayer();
    }

    drawPlayer() {
      const p = this.player;
      const cx = p.x + p.w / 2;
      ctx.save();
      ctx.shadowColor = "#38e8ff";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#38e8ff";
      ctx.beginPath();
      ctx.moveTo(cx, p.y);                 // nose
      ctx.lineTo(p.x + p.w, p.y + p.h);    // bottom-right
      ctx.lineTo(cx, p.y + p.h * 0.78);    // tail notch
      ctx.lineTo(p.x, p.y + p.h);          // bottom-left
      ctx.closePath();
      ctx.fill();
      // cockpit
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#eaf2ff";
      ctx.beginPath();
      ctx.arc(cx, p.y + p.h * 0.42, p.w * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawEnemy(e) {
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      ctx.save();
      ctx.shadowColor = e.hue;
      ctx.shadowBlur = 14;
      ctx.fillStyle = e.hue;
      ctx.beginPath();
      ctx.moveTo(cx, e.y + e.h);            // nose down
      ctx.lineTo(e.x, e.y);
      ctx.lineTo(cx, e.y + e.h * 0.28);
      ctx.lineTo(e.x + e.w, e.y);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(5,6,10,0.85)";
      ctx.beginPath();
      ctx.arc(cx, cy, e.w * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ============================================================
  //  INPUT
  // ============================================================
  function bindKeyboard(game) {
    const map = (e, down) => {
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          game.keys.left = down; break;
        case "ArrowRight":
        case "d":
        case "D":
          game.keys.right = down; break;
        case " ":
        case "Spacebar":
          game.keys.fire = down;
          if (down) e.preventDefault();
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", (e) => {
      if (e.repeat && e.key === " ") return;
      map(e, true);
    });
    window.addEventListener("keyup", (e) => map(e, false));
  }

  function bindHold(btn, onDown, onUp) {
    const down = (e) => {
      e.preventDefault();
      btn.classList.add("is-down");
      Sound.unlock();
      onDown();
    };
    const up = (e) => {
      if (e) e.preventDefault();
      btn.classList.remove("is-down");
      onUp();
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
    // prevent the synthetic context menu / text selection on long press
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  function bindTouch(game) {
    bindHold(btnLeft, () => (game.keys.left = true), () => (game.keys.left = false));
    bindHold(btnRight, () => (game.keys.right = true), () => (game.keys.right = false));
    bindHold(btnFire, () => (game.keys.fire = true), () => (game.keys.fire = false));
  }

  // Mouse steers the ship left/right (desktop). Firing stays on Space.
  function bindMouse(game) {
    shell.addEventListener("pointermove", (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return; // ignore touch/pen
      const rect = shell.getBoundingClientRect();
      game.mouseX = e.clientX - rect.left;
      game.mouseActive = true;
    });
  }

  // ============================================================
  //  MAIN LOOP
  // ============================================================
  let game = null;
  let last = 0;

  function frame(now) {
    const dt = Math.min((now - last) / 1000 || 0, 0.05); // clamp big gaps
    last = now;

    drawStars(dt);
    if (game) {
      game.update(dt);
      game.draw();
    }
    requestAnimationFrame(frame);
  }

  // ---- boot ---------------------------------------------------
  function init() {
    resize();
    game = new Game();
    bindKeyboard(game);
    bindTouch(game);
    bindMouse(game);

    startBtn.addEventListener("click", () => game.start());
    restartBtn.addEventListener("click", () => game.start());

    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", () => setTimeout(resize, 150));

    requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
