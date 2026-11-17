'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3, shootingStar = false) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.shootingStar = shootingStar;
    this.radius = shootingStar ? 25 : RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = (SPEEDS[size] + rand(-15, 15)) * (shootingStar ? 2 : 1);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    const n = shootingStar ? 10 : randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = shootingStar
        ? this.radius * (i % 2 === 0 ? 1 : 0.45)
        : this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.shootingStar || this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.shootingStar) {
      ctx.rotate(Math.atan2(this.vy, this.vx));
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';

      const trail = ctx.createLinearGradient(-20, 0, -100, 0);
      trail.addColorStop(0, '#ffd46b');
      trail.addColorStop(1, 'rgba(255, 212, 107, 0)');
      ctx.strokeStyle = trail;
      ctx.beginPath();
      ctx.moveTo(...this.verts[4]);
      ctx.quadraticCurveTo(-60, 15, -100, 0);
      ctx.quadraticCurveTo(-60, -15, ...this.verts[6]);
      ctx.stroke();

      ctx.strokeStyle = '#ffd46b';
      ctx.beginPath();
      ctx.moveTo(...this.verts[0]);
      for (let i = 1; i < this.verts.length; i++)
        ctx.lineTo(...this.verts[i]);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const ROT   = 3.5;   // rad/s
    const THRUST = 260 * (speedTimer > 0 ? 2 : 1);  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();

    // Círculo del escudo
    if (shieldHits > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const flash = shieldFlash > 0 ? 1 + shieldFlash * 2 : 1;  // se expande al golpear
      const alpha = shieldFlash > 0 ? 0.9 : 0.35;
      ctx.strokeStyle = `rgba(125, 255, 90, ${alpha.toFixed(2)})`;
      ctx.lineWidth = shieldFlash > 0 ? 3 : 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 24 * flash, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

class FireworkParticle extends Particle {
  constructor(x, y, angle) {
    super(x, y);
    const speed = rand(90, 175);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.9, 1.3);
    this.ttl = this.life;
  }

  draw() {
    const alpha = Math.max(0, this.ttl / this.life);
    ctx.strokeStyle = `rgba(255, 195, 80, ${alpha.toFixed(2)})`;
    ctx.fillStyle = `rgba(255, 235, 160, ${alpha.toFixed(2)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.14, this.y - this.vy * 0.14);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.x, this.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Speed pickup ──────────────────────────────────────────────────────────────
function spawnSpeedPickup() {
  let x, y;
  do {
    x = rand(30, W - 30);
    y = rand(40, H - 30);
  } while (Math.hypot(x - W / 2, y - H / 2) < 130);
  speedPickup = { x, y, radius: 12 };
}

function drawSpeedPickup() {
  if (!speedPickup) return;
  ctx.strokeStyle = '#00dfff';
  ctx.fillStyle = '#00dfff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(speedPickup.x, speedPickup.y, speedPickup.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('S', speedPickup.x, speedPickup.y + 5);
}

// ── Shield pickup ─────────────────────────────────────────────────────────────
function spawnShieldPickup() {
  let x, y;
  do {
    x = rand(30, W - 30);
    y = rand(40, H - 30);
  } while (Math.hypot(x - W / 2, y - H / 2) < 130);
  shieldPickup = { x, y, radius: 12 };
}

function drawShieldPickup() {
  if (!shieldPickup) return;
  ctx.strokeStyle = '#7dff5a';
  ctx.fillStyle = '#7dff5a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(shieldPickup.x, shieldPickup.y, shieldPickup.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('E', shieldPickup.x, shieldPickup.y + 5);
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let speedPickup, speedTimer;
let shieldPickup, shieldHits, shieldFlash;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3, Math.random() < 0.2));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  speedTimer = 0;
  shieldHits = 0;
  shieldFlash = 0;
  spawnAsteroids(4);
  spawnSpeedPickup();
  spawnShieldPickup();
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  ship.reset();
  spawnAsteroids(3 + level);
  spawnSpeedPickup();
  spawnShieldPickup();
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function explodeShootingStar(x, y) {
  const count = 48;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rand(-0.05, 0.05);
    particles.push(new FireworkParticle(x, y, angle));
  }
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  speedTimer = Math.max(0, speedTimer - dt);
  shieldFlash = Math.max(0, shieldFlash - dt);
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  if (speedPickup && dist(ship, speedPickup) < ship.radius + speedPickup.radius) {
    speedTimer = 30;
    speedPickup = null;
  }
  if (shieldPickup && dist(ship, shieldPickup) < ship.radius + shieldPickup.radius) {
    shieldHits = 3;
    shieldPickup = null;
  }
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        if (a.shootingStar) explodeShootingStar(a.x, a.y);
        else explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        if (shieldHits > 0) {
          // El escudo absorbe el impacto: destruye el asteroide sin dividirlo
          shieldHits--;
          shieldFlash = 0.3;
          a.dead = true;
          if (a.shootingStar) explodeShootingStar(a.x, a.y);
          else explode(a.x, a.y, a.size * 5);
        } else {
          killShip();
        }
        break;
      }
    }
    asteroids = asteroids.filter(a => !a.dead);
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  if (speedTimer > 0) {
    ctx.fillStyle = '#00dfff';
    ctx.fillText(`SPEED ${Math.ceil(speedTimer)}s`, W / 2, 48);
  }

  if (shieldHits > 0) {
    ctx.fillStyle = '#7dff5a';
    ctx.fillText(`ESCUDO x${shieldHits}`, W / 2, speedTimer > 0 ? 68 : 48);
  }

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  bullets.forEach(b => b.draw());
  drawSpeedPickup();
  drawShieldPickup();
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
