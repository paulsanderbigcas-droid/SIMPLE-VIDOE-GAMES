const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hpFill = document.getElementById("hpFill");
const hpText = document.getElementById("hpText");
const distText = document.getElementById("distText");
const bestText = document.getElementById("bestText");
const gemsText = document.getElementById("gemsText");
const scoreText = document.getElementById("scoreText");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const startBtn = document.getElementById("startBtn");
const overlay = document.getElementById("overlay");

const W = canvas.width;
const H = canvas.height;
const PX_PER_METER = 28;
const BOSS_INTERVAL_METERS = 500;

let bestMeters = Number(localStorage.getItem("rooftopDriftBest") || 0);
bestText.textContent = `${bestMeters}m`;

let gameState = "menu"; // "menu" | "playing" | "paused" | "gameover"
let cameraX = 0;
let distancePx = 0;
let gems = 0;
let score = 0;
let runCycle = 0;
let nextBossMilestone = BOSS_INTERVAL_METERS;
let bossBannerTimer = 0;
let bossBannerText = "";

const keys = {};
let jumpBufferTimer = 0;
let coyoteTimer = 0;

const player = {
  x: 160,
  y: 260,
  w: 24,
  h: 42,
  vx: 0,
  vy: 0,
  hp: 100,
  maxHp: 100,
  invulnTimer: 0,
  facing: 1,
  onGround: false,
  onWall: 0,
  jumpsLeft: 2,
  scaleX: 1,
  scaleY: 1,
  slashTimer: 0,
  slashCooldown: 0,
  shotCooldown: 0,
  scarf: []
};

let platforms = [];
let enemies = [];
let collectibles = [];
let bolts = [];
let enemyShots = [];
let shockwaves = [];
let particles = [];
let bgBuildingsFar = [];
let bgBuildingsMid = [];
let activeBoss = null;

function initScenery() {
  bgBuildingsFar = [];
  bgBuildingsMid = [];

  let fx = 0;
  for (let i = 0; i < 24; i++) {
    const bw = 70 + ((i * 37) % 85);
    const bh = 90 + ((i * 53) % 140);
    bgBuildingsFar.push({ x: fx, w: bw, h: bh });
    fx += bw + 12;
  }

  let mx = 0;
  for (let i = 0; i < 20; i++) {
    const bw = 95 + ((i * 43) % 95);
    const bh = 70 + ((i * 61) % 115);
    const windows = [];
    const cols = Math.max(2, Math.floor((bw - 24) / 18));
    const rows = Math.max(2, Math.floor((bh - 30) / 22));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (((i * 7 + r * 3 + c * 5) % 9) === 0) {
          windows.push({ r, c });
        }
      }
    }
    bgBuildingsMid.push({ x: mx, w: bw, h: bh, windows });
    mx += bw + 24;
  }
}

function spawnEnemyOnPlatform(plat, forceType = null) {
  const roll = Math.random();
  const type = forceType || (roll < 0.34 ? "turret" : roll < 0.68 ? "drone" : "patrol");

  if (type === "turret") {
    enemies.push({
      type: "turret",
      x: plat.x + plat.w * (0.52 + Math.random() * 0.28),
      y: plat.y - 24,
      w: 28,
      h: 24,
      hp: 40,
      maxHp: 40,
      hitFlash: 0,
      aimAngle: Math.PI,
      fireCooldown: 1.2 + Math.random() * 0.9
    });
  } else if (type === "drone") {
    enemies.push({
      type: "drone",
      x: plat.x + plat.w * (0.35 + Math.random() * 0.45),
      baseY: plat.y - 68 - Math.random() * 32,
      y: plat.y - 75,
      w: 28,
      h: 22,
      vx: -55,
      hp: 30,
      maxHp: 30,
      hitFlash: 0,
      phase: Math.random() * Math.PI * 2,
      minX: plat.x + 16,
      maxX: plat.x + plat.w - 16
    });
  } else {
    enemies.push({
      type: "patrol",
      x: plat.x + plat.w * (0.4 + Math.random() * 0.4),
      y: plat.y - 38,
      w: 24,
      h: 38,
      vx: -65,
      vy: 0,
      hp: 45,
      maxHp: 45,
      hitFlash: 0,
      walkCycle: Math.random() * 6,
      minX: plat.x + 18,
      maxX: plat.x + plat.w - 18
    });
  }
}

function addGemsForPlatform(prevPlat, nextPlat) {
  if (prevPlat) {
    const gapCenterX = (prevPlat.x + prevPlat.w + nextPlat.x) * 0.5;
    const arcTopY = Math.max(95, Math.min(prevPlat.y, nextPlat.y) - 54);
    collectibles.push({
      x: gapCenterX,
      y: arcTopY,
      collected: false,
      bobPhase: nextPlat.x * 0.02
    });
  }

  if (nextPlat.w >= 200) {
    collectibles.push({
      x: nextPlat.x + nextPlat.w * 0.35,
      y: nextPlat.y - 34,
      collected: false,
      bobPhase: nextPlat.x * 0.03 + 1.2
    });
  }
}

function generateInitialWorld() {
  platforms = [
    { x: 40, y: 340, w: 360, h: 190, style: "stone" },
    { x: 455, y: 300, w: 255, h: 230, style: "moss" },
    { x: 765, y: 255, w: 250, h: 275, style: "stone" },
    { x: 1070, y: 325, w: 295, h: 205, style: "moss" },
    { x: 1420, y: 275, w: 265, h: 255, style: "stone" }
  ];

  enemies = [];
  collectibles = [];

  for (let i = 1; i < platforms.length; i++) {
    addGemsForPlatform(platforms[i - 1], platforms[i]);
  }

  spawnEnemyOnPlatform(platforms[1], "patrol");
  spawnEnemyOnPlatform(platforms[2], "turret");
  spawnEnemyOnPlatform(platforms[3], "drone");
}

function spawnBossArena(milestoneMeters) {
  const deckW = 680;
  const deckY = 335;
  const lastPlat = platforms[platforms.length - 1];
  const baseX = lastPlat ? lastPlat.x + lastPlat.w + 70 : player.x + 120;
  const deckX = Math.max(baseX, player.x + 140);

  const bossDeck = {
    x: deckX,
    y: deckY,
    w: deckW,
    h: H - deckY + 60,
    style: "stone",
    isBossDeck: true
  };
  platforms.push(bossDeck);

  // Add a stepping rooftop if there's a big gap so you can easily reach the boss deck
  if (lastPlat && deckX - (lastPlat.x + lastPlat.w) > 150) {
    const midX = lastPlat.x + lastPlat.w + 65;
    const midW = Math.max(120, deckX - midX - 65);
    platforms.push({
      x: midX,
      y: Math.min(lastPlat.y, deckY) - 10,
      w: midW,
      h: H - (Math.min(lastPlat.y, deckY) - 10) + 60,
      style: "moss"
    });
  }

  enemies = [];

  collectibles.push({
    x: deckX - 35,
    y: deckY - 56,
    collected: false,
    bobPhase: 0.3
  });

  const tier = Math.max(1, Math.round(milestoneMeters / BOSS_INTERVAL_METERS));
  const maxHp = 220 + (tier - 1) * 110;
  const bossW = 54;
  const bossH = 68;

  activeBoss = {
    milestone: milestoneMeters,
    tier,
    x: deckX + deckW - 140,
    y: deckY - bossH,
    vy: 0,
    w: bossW,
    h: bossH,
    deckX,
    deckY,
    deckW,
    hp: maxHp,
    maxHp,
    hitFlash: 0,
    strideCycle: 0,
    attackTimer: 1.1,
    telegraphTimer: 0,
    pendingAttack: "volley",
    patternStep: 0
  };

  bossBannerText = `BOSS — ${milestoneMeters}M WARDEN`;
  bossBannerTimer = 3.0;
}

function checkMilestoneBoss() {
  if (activeBoss) return;
  const currentMeters = Math.floor(distancePx / PX_PER_METER);
  if (currentMeters >= nextBossMilestone) {
    const milestone = nextBossMilestone;
    nextBossMilestone += BOSS_INTERVAL_METERS;
    spawnBossArena(milestone);
  }
}

function extendWorldIfNeeded() {
  if (activeBoss) return;

  const rightEdgeNeeded = cameraX + W + 550;
  let last = platforms[platforms.length - 1];

  while (last && last.x + last.w < rightEdgeNeeded) {
    const gap = 80 + Math.random() * 95;
    const w = 185 + Math.random() * 185;
    const minY = 190;
    const maxY = 380;
    const deltaY = (Math.random() - 0.5) * 125;
    const y = Math.max(minY, Math.min(maxY, last.y + deltaY));
    const style = Math.random() < 0.5 ? "moss" : "stone";

    const nextPlat = { x: last.x + last.w + gap, y, w, h: H - y + 60, style };
    platforms.push(nextPlat);
    addGemsForPlatform(last, nextPlat);

    if (w >= 195 && Math.random() < 0.78) {
      spawnEnemyOnPlatform(nextPlat);
    }

    last = nextPlat;
  }

  const pruneX = cameraX - 420;
  platforms = platforms.filter((p) => p.x + p.w > pruneX);
  enemies = enemies.filter((e) => e.x > pruneX && e.y < H + 120);
  collectibles = collectibles.filter((c) => !c.collected && c.x > pruneX);
}

function resetRunState() {
  player.x = 160;
  player.y = 340 - player.h;
  player.vx = 0;
  player.vy = 0;
  player.hp = player.maxHp;
  player.invulnTimer = 0;
  player.facing = 1;
  player.onGround = false;
  player.onWall = 0;
  player.jumpsLeft = 2;
  player.scaleX = 1;
  player.scaleY = 1;
  player.slashTimer = 0;
  player.slashCooldown = 0;
  player.shotCooldown = 0;
  player.scarf = Array.from({ length: 7 }, (_, i) => ({
    x: player.x - i * 5,
    y: player.y + 13
  }));

  cameraX = 0;
  distancePx = 0;
  gems = 0;
  score = 0;
  runCycle = 0;
  nextBossMilestone = BOSS_INTERVAL_METERS;
  bossBannerTimer = 0;
  bossBannerText = "";
  activeBoss = null;

  bolts = [];
  enemyShots = [];
  shockwaves = [];
  particles = [];
  jumpBufferTimer = 0;
  coyoteTimer = 0;

  pauseBtn.textContent = "Pause (P)";
  initScenery();
  generateInitialWorld();
  updateHud();
}

function updateHud() {
  const meters = Math.floor(distancePx / PX_PER_METER);
  distText.textContent = `${meters}m`;
  gemsText.textContent = String(gems);
  scoreText.textContent = String(score);
  hpText.textContent = String(Math.max(0, Math.ceil(player.hp)));

  const pct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
  hpFill.style.width = `${pct}%`;
  hpFill.style.backgroundColor = pct < 35 ? "var(--hp-low)" : "var(--hp)";

  if (meters > bestMeters) {
    bestMeters = meters;
    bestText.textContent = `${bestMeters}m`;
    localStorage.setItem("rooftopDriftBest", String(bestMeters));
  }
}

function spawnParticles(x, y, count, color = "rgba(203, 213, 225, 0.6)", speedScale = 1) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 12,
      y: y + (Math.random() - 0.5) * 12,
      vx: (Math.random() - 0.5) * 145 * speedScale,
      vy: (-25 - Math.random() * 90) * speedScale,
      r: 2.2 + Math.random() * 3.4,
      life: 0.32 + Math.random() * 0.28,
      maxLife: 0.6,
      color
    });
  }
}

function handleBossDefeated() {
  if (!activeBoss) return;
  const bx = activeBoss.x + activeBoss.w / 2;
  const by = activeBoss.y + activeBoss.h / 2;

  score += 250 * activeBoss.tier;
  player.hp = Math.min(player.maxHp, player.hp + 25);
  spawnParticles(bx, by, 22, "#7dd3fc", 1.5);
  spawnParticles(bx, by, 14, "#facc15", 1.3);

  for (let i = -2; i <= 2; i++) {
    collectibles.push({
      x: bx + i * 38,
      y: activeBoss.deckY - 42 - Math.abs(i) * 10,
      collected: false,
      bobPhase: i * 0.7
    });
  }

  const nextPlat = {
    x: activeBoss.deckX + activeBoss.deckW + 80,
    y: activeBoss.deckY - 25,
    w: 280,
    h: H - (activeBoss.deckY - 25) + 60,
    style: "moss"
  };
  platforms.push(nextPlat);

  bossBannerText = `${activeBoss.milestone}M BOSS DEFEATED!`;
  bossBannerTimer = 2.4;
  activeBoss = null;
  enemyShots = [];
  shockwaves = [];
  updateHud();
}

function damageBoss(dmg, knockDir) {
  if (!activeBoss) return;
  activeBoss.hp -= dmg;
  activeBoss.hitFlash = 0.1;
  activeBoss.x = Math.max(
    activeBoss.deckX + 110,
    Math.min(activeBoss.deckX + activeBoss.deckW - activeBoss.w - 20, activeBoss.x + knockDir * 6)
  );
  spawnParticles(activeBoss.x + activeBoss.w / 2, activeBoss.y + 28, 6, "#bae6fd", 0.9);

  if (activeBoss.hp <= 0) {
    handleBossDefeated();
  }
}

function damageEnemy(enemy, dmg, knockDir) {
  enemy.hp -= dmg;
  enemy.hitFlash = 0.12;
  if (enemy.type !== "turret") {
    enemy.x += knockDir * 14;
  }
  spawnParticles(enemy.x, enemy.y + enemy.h * 0.4, 6, "#bae6fd", 0.9);

  if (enemy.hp <= 0) {
    score += enemy.type === "turret" ? 50 : enemy.type === "drone" ? 40 : 25;
    spawnParticles(
      enemy.x,
      enemy.y + enemy.h * 0.4,
      12,
      enemy.type === "turret" ? "#fdba74" : enemy.type === "drone" ? "#c4b5fd" : "#fca5a5",
      1.25
    );
    updateHud();
  }
}

function triggerSlash() {
  if (gameState !== "playing" || player.slashCooldown > 0) return;

  player.slashTimer = 0.16;
  player.slashCooldown = 0.32;
  spawnParticles(
    player.x + player.w / 2 + player.facing * 24,
    player.y + player.h * 0.5,
    4,
    "rgba(125, 211, 252, 0.7)",
    0.7
  );

  const reachCenterX = player.x + player.w / 2 + player.facing * 32;
  const reachCenterY = player.y + player.h * 0.5;

  for (let s = enemyShots.length - 1; s >= 0; s--) {
    const shot = enemyShots[s];
    if (Math.hypot(shot.x - reachCenterX, shot.y - reachCenterY) < 36) {
      spawnParticles(shot.x, shot.y, 6, "#fdba74", 0.9);
      enemyShots.splice(s, 1);
      score += 10;
      updateHud();
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const ex = e.x;
    const ey = e.y + e.h * 0.5;
    if (Math.abs(ex - reachCenterX) < 40 && Math.abs(ey - reachCenterY) < 38) {
      damageEnemy(e, 25, player.facing);
      if (e.hp <= 0) enemies.splice(i, 1);
    }
  }

  if (activeBoss) {
    const bossCx = activeBoss.x + activeBoss.w * 0.5;
    const bossCy = activeBoss.y + activeBoss.h * 0.5;
    if (
      Math.abs(bossCx - reachCenterX) < activeBoss.w * 0.6 + 24 &&
      Math.abs(bossCy - reachCenterY) < activeBoss.h * 0.5 + 24
    ) {
      damageBoss(25, player.facing);
    }
  }
}

function triggerPulseBolt(aimX = null, aimY = null) {
  if (gameState !== "playing" || player.shotCooldown > 0) return;

  player.shotCooldown = 0.26;
  const originX = player.x + player.w / 2 + player.facing * 12;
  const originY = player.y + 18;

  let angle = player.facing === 1 ? 0 : Math.PI;
  if (typeof aimX === "number" && typeof aimY === "number") {
    const worldAimX = aimX + cameraX;
    angle = Math.atan2(aimY - originY, worldAimX - originX);
    player.facing = Math.cos(angle) >= 0 ? 1 : -1;
  }

  const speed = 550;
  bolts.push({
    x: originX,
    y: originY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 1.15
  });
}

function damagePlayer(dmg, reasonTitle) {
  if (player.invulnTimer > 0) return;
  player.hp -= dmg;
  player.invulnTimer = 0.75;
  player.vy = -240;
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 10, "#f87171", 1.1);
  updateHud();

  if (player.hp <= 0) {
    showGameOver(reasonTitle || "Defeated on the Rooftops");
  }
}

function performJump() {
  if (coyoteTimer > 0) {
    player.vy = -510;
    player.onGround = false;
    coyoteTimer = 0;
    player.jumpsLeft = 1;
    player.scaleX = 0.8;
    player.scaleY = 1.24;
    spawnParticles(player.x + player.w / 2, player.y + player.h, 6);
    jumpBufferTimer = 0;
    return true;
  }

  if (player.onWall !== 0) {
    player.vy = -485;
    player.vx = -player.onWall * 310;
    player.facing = -player.onWall;
    player.jumpsLeft = 1;
    player.scaleX = 0.82;
    player.scaleY = 1.22;
    spawnParticles(
      player.onWall === 1 ? player.x + player.w : player.x,
      player.y + player.h * 0.5,
      7
    );
    jumpBufferTimer = 0;
    return true;
  }

  if (player.jumpsLeft > 0) {
    player.vy = -455;
    player.jumpsLeft--;
    player.scaleX = 0.84;
    player.scaleY = 1.2;
    spawnParticles(player.x + player.w / 2, player.y + player.h, 7, "rgba(125, 211, 252, 0.55)");
    jumpBufferTimer = 0;
    return true;
  }

  return false;
}

function showGameOver(reasonTitle) {
  gameState = "gameover";
  const meters = Math.floor(distancePx / PX_PER_METER);
  overlay.innerHTML = `
    <h1>${reasonTitle}</h1>
    <p>
      Distance: <strong>${meters}m</strong> · Best: <strong>${bestMeters}m</strong> · Gems: <strong>${gems}</strong> · Score: <strong>${score}</strong>
    </p>
    <button class="btn primary" id="retryBtn" type="button">Run Again</button>
  `;
  overlay.style.display = "flex";
  document.getElementById("retryBtn").addEventListener("click", startNewRun);
}

function startNewRun() {
  overlay.style.display = "none";
  resetRunState();
  gameState = "playing";
}

function updateBoss(dt, px, py) {
  if (!activeBoss) return;
  const b = activeBoss;
  if (b.hitFlash > 0) b.hitFlash -= dt;

  // Smoothly frame the boss arena so the Warden is visible on screen
  const arenaCamTarget = Math.max(cameraX, b.deckX - 180);
  cameraX += (arenaCamTarget - cameraX) * Math.min(1, dt * 3.5);

  b.vy += 1100 * dt;
  b.y += b.vy * dt;
  if (b.y + b.h >= b.deckY) {
    if (b.vy > 350) {
      shockwaves.push({
        x: b.x + b.w * 0.5,
        y: b.deckY - 6,
        dir: -1,
        speed: 255,
        life: 2.4,
        hit: false
      });
      spawnParticles(b.x + b.w * 0.5, b.deckY, 12, "#fdba74", 1.2);
    }
    b.y = b.deckY - b.h;
    b.vy = 0;
  }

  const targetX = b.deckX + b.deckW - 155 + Math.sin(b.strideCycle * 0.4) * 55;
  b.x += (targetX - b.x) * Math.min(1, dt * 2.2);
  b.strideCycle += dt * 5;

  if (b.telegraphTimer > 0) {
    b.telegraphTimer -= dt;
    if (b.telegraphTimer <= 0) {
      if (b.pendingAttack === "slam" && b.y + b.h >= b.deckY - 1) {
        b.vy = -440;
      } else {
        const originX = b.x + 8;
        const originY = b.y + 26;
        const baseAngle = Math.atan2(py - originY, px - originX);
        const spreads = [-0.18, 0, 0.18];
        for (const offset of spreads) {
          const ang = baseAngle + offset;
          const spd = 235 + (b.tier - 1) * 15;
          enemyShots.push({
            x: originX,
            y: originY,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            life: 3.0
          });
        }
      }
      b.attackTimer = Math.max(1.25, 1.9 - (b.tier - 1) * 0.15);
    }
  } else {
    b.attackTimer -= dt;
    if (b.attackTimer <= 0) {
      b.patternStep = (b.patternStep + 1) % 2;
      b.pendingAttack = b.patternStep === 0 ? "volley" : "slam";
      b.telegraphTimer = 0.55;
    }
  }

  if (
    Math.abs(px - (b.x + b.w * 0.5)) < (player.w + b.w) * 0.44 &&
    Math.abs(py - (b.y + b.h * 0.5)) < (player.h + b.h) * 0.44
  ) {
    damagePlayer(22, `Fallen to ${b.milestone}m Boss`);
  }
}

function update(dt, timeSec) {
  if (gameState !== "playing") return;

  if (bossBannerTimer > 0) bossBannerTimer -= dt;

  player.scaleX += (1 - player.scaleX) * Math.min(1, dt * 14);
  player.scaleY += (1 - player.scaleY) * Math.min(1, dt * 14);

  if (jumpBufferTimer > 0) jumpBufferTimer -= dt;
  if (coyoteTimer > 0) coyoteTimer -= dt;
  if (player.slashTimer > 0) player.slashTimer -= dt;
  if (player.slashCooldown > 0) player.slashCooldown -= dt;
  if (player.shotCooldown > 0) player.shotCooldown -= dt;
  if (player.invulnTimer > 0) player.invulnTimer -= dt;

  let moveDir = 0;
  if (keys["KeyA"] || keys["ArrowLeft"]) moveDir -= 1;
  if (keys["KeyD"] || keys["ArrowRight"]) moveDir += 1;

  const targetSpeed = moveDir !== 0 ? moveDir * 295 : 145;
  const accel = player.onGround ? 18 : 9;
  player.vx += (targetSpeed - player.vx) * Math.min(1, dt * accel);

  if (moveDir !== 0) {
    player.facing = moveDir;
  } else if (player.vx > 20) {
    player.facing = 1;
  }

  player.vy += 1260 * dt;

  const wasOnGround = player.onGround;
  player.onGround = false;
  player.onWall = 0;

  player.x += player.vx * dt;
  if (player.x < cameraX + 24) {
    player.x = cameraX + 24;
    if (player.vx < 0) player.vx = 0;
  }

  for (const p of platforms) {
    const overlapY = player.y + player.h > p.y + 4 && player.y < p.y + p.h;
    if (!overlapY) continue;

    if (player.vx > 0 && player.x + player.w > p.x && player.x < p.x) {
      player.x = p.x - player.w;
      player.vx = 0;
      if (!player.onGround && player.vy > 0) player.onWall = 1;
    } else if (player.vx < 0 && player.x < p.x + p.w && player.x + player.w > p.x + p.w) {
      player.x = p.x + p.w;
      player.vx = 0;
      if (!player.onGround && player.vy > 0) player.onWall = -1;
    }
  }

  if (player.onWall !== 0 && player.vy > 115) {
    player.vy = 115;
    if (Math.random() < 0.35) {
      spawnParticles(
        player.onWall === 1 ? player.x + player.w : player.x,
        player.y + player.h * 0.65,
        1,
        "rgba(203, 213, 225, 0.5)",
        0.5
      );
    }
  }

  const prevBottom = player.y + player.h;
  player.y += player.vy * dt;

  for (const p of platforms) {
    const overlapX = player.x + player.w - 4 > p.x && player.x + 4 < p.x + p.w;
    if (!overlapX) continue;

    if (player.vy >= 0 && prevBottom <= p.y + 14 && player.y + player.h >= p.y) {
      const impactVy = player.vy;
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.onWall = 0;
      player.jumpsLeft = 2;
      coyoteTimer = 0.11;

      if (!wasOnGround && impactVy > 180) {
        player.scaleX = 1.22;
        player.scaleY = 0.8;
        spawnParticles(player.x + player.w / 2, player.y + player.h, 6);
      }
    }
  }

  if (wasOnGround && !player.onGround && player.vy >= 0) {
    coyoteTimer = 0.11;
  }

  if (jumpBufferTimer > 0) {
    performJump();
  }

  if (player.onGround && Math.abs(player.vx) > 25) {
    runCycle += dt * (Math.abs(player.vx) * 0.048);
  } else {
    runCycle += dt * 3;
  }

  const anchorX = player.x + player.w / 2 - player.facing * 5;
  const anchorY = player.y + 13;
  player.scarf[0].x = anchorX;
  player.scarf[0].y = anchorY;

  for (let i = 1; i < player.scarf.length; i++) {
    const prev = player.scarf[i - 1];
    const seg = player.scarf[i];
    seg.x -= player.facing * 55 * dt;
    seg.y += Math.sin(runCycle * 1.4 + i * 0.9) * 28 * dt + 14 * dt;

    const dx = seg.x - prev.x;
    const dy = seg.y - prev.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const spacing = 5.2;
    if (dist > spacing) {
      seg.x = prev.x + (dx / dist) * spacing;
      seg.y = prev.y + (dy / dist) * spacing;
    }
  }

  const px = player.x + player.w / 2;
  const py = player.y + player.h / 2;
  for (const c of collectibles) {
    if (c.collected) continue;
    if (Math.hypot(px - c.x, py - c.y) < 28) {
      c.collected = true;
      gems++;
      score += 15;
      updateHud();
      spawnParticles(c.x, c.y, 8, "rgba(253, 224, 71, 0.75)", 0.9);
    }
  }

  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    if (b.life <= 0 || b.x < cameraX - 60 || b.x > cameraX + W + 90 || b.y < -40 || b.y > H + 40) {
      bolts.splice(i, 1);
      continue;
    }

    if (
      activeBoss &&
      b.x > activeBoss.x - 8 &&
      b.x < activeBoss.x + activeBoss.w + 8 &&
      b.y > activeBoss.y &&
      b.y < activeBoss.y + activeBoss.h
    ) {
      damageBoss(16, Math.sign(b.vx) || 1);
      bolts.splice(i, 1);
      continue;
    }

    let hitEnemy = false;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (
        b.x > e.x - e.w * 0.65 &&
        b.x < e.x + e.w * 0.65 &&
        b.y > e.y &&
        b.y < e.y + e.h
      ) {
        damageEnemy(e, 15, Math.sign(b.vx) || 1);
        if (e.hp <= 0) enemies.splice(j, 1);
        hitEnemy = true;
        break;
      }
    }

    if (hitEnemy) bolts.splice(i, 1);
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.hitFlash > 0) e.hitFlash -= dt;

    if (e.type === "turret") {
      const pivotX = e.x;
      const pivotY = e.y + 8;
      e.aimAngle = Math.atan2(py - pivotY, px - pivotX);
      e.fireCooldown -= dt;

      const onScreen = e.x > cameraX - 40 && e.x < cameraX + W + 120;
      if (onScreen && e.fireCooldown <= 0) {
        e.fireCooldown = 2.05;
        const orbSpeed = 245;
        enemyShots.push({
          x: pivotX + Math.cos(e.aimAngle) * 16,
          y: pivotY + Math.sin(e.aimAngle) * 16,
          vx: Math.cos(e.aimAngle) * orbSpeed,
          vy: Math.sin(e.aimAngle) * orbSpeed,
          life: 2.6
        });
      }
    } else if (e.type === "drone") {
      e.x += e.vx * dt;
      if (e.x < e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); }
      if (e.x > e.maxX) { e.x = e.maxX; e.vx = -Math.abs(e.vx); }
      e.y = e.baseY + Math.sin(timeSec * 3.5 + e.phase) * 9;
    } else {
      e.x += e.vx * dt;
      e.walkCycle += dt * 7;
      if (e.x < e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); }
      if (e.x > e.maxX) { e.x = e.maxX; e.vx = -Math.abs(e.vx); }
    }

    const ex = e.x;
    const ey = e.y + e.h * 0.5;
    if (Math.abs(px - ex) < (player.w + e.w) * 0.44 && Math.abs(py - ey) < (player.h + e.h) * 0.42) {
      const stomping = e.type !== "turret" && player.vy > 80 && player.y + player.h - player.vy * dt <= e.y + 10;
      if (stomping) {
        player.vy = -420;
        player.jumpsLeft = 1;
        damageEnemy(e, 30, player.facing);
        if (e.hp <= 0) enemies.splice(i, 1);
      } else {
        damagePlayer(20, "Defeated on the Rooftops");
        if (gameState !== "playing") return;
      }
    }
  }

  updateBoss(dt, px, py);
  if (gameState !== "playing") return;

  for (let i = enemyShots.length - 1; i >= 0; i--) {
    const s = enemyShots[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;

    if (s.life <= 0 || s.x < cameraX - 60 || s.x > cameraX + W + 100 || s.y < -40 || s.y > H + 40) {
      enemyShots.splice(i, 1);
      continue;
    }

    if (Math.hypot(s.x - px, s.y - py) < 17) {
      enemyShots.splice(i, 1);
      damagePlayer(15, "Hit by Energy Fire");
      if (gameState !== "playing") return;
    }
  }

  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.x += sw.dir * sw.speed * dt;
    sw.life -= dt;

    if (sw.life <= 0 || sw.x < cameraX - 40) {
      shockwaves.splice(i, 1);
      continue;
    }

    if (!sw.hit && Math.abs(px - sw.x) < 16 && player.y + player.h > sw.y - 14) {
      sw.hit = true;
      damagePlayer(18, "Caught by Boss Shockwave");
      if (gameState !== "playing") return;
    }
  }

  if (!activeBoss) {
    const desiredCamX = Math.max(cameraX, player.x - W * 0.34);
    cameraX += (desiredCamX - cameraX) * Math.min(1, dt * 8);
  }

  if (player.x > distancePx) {
    distancePx = player.x;
    updateHud();
    checkMilestoneBoss();
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += 180 * dt;
    pt.life -= dt;
    if (pt.life <= 0) particles.splice(i, 1);
  }

  extendWorldIfNeeded();

  if (player.y > H + 80) {
    showGameOver("Fallen Between Rooftops");
  }
}

function drawSkyAndParallax() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#121724");
  sky.addColorStop(0.65, "#192032");
  sky.addColorStop(1, "#121622");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(226, 232, 240, 0.14)";
  ctx.beginPath();
  ctx.arc(W - 140, 95, 34, 0, Math.PI * 2);
  ctx.fill();

  const farScroll = (cameraX * 0.18) % 1800;
  ctx.fillStyle = "#151b2a";
  for (const b of bgBuildingsFar) {
    const sx = b.x - farScroll;
    if (sx + b.w < -60 || sx > W + 60) continue;
    ctx.fillRect(sx, H - b.h, b.w, b.h);
  }

  const midScroll = (cameraX * 0.38) % 1900;
  for (const b of bgBuildingsMid) {
    const sx = b.x - midScroll;
    if (sx + b.w < -80 || sx > W + 80) continue;
    const by = H - b.h;
    ctx.fillStyle = "#192033";
    ctx.fillRect(sx, by, b.w, b.h);
    ctx.fillStyle = "#232c45";
    ctx.fillRect(sx, by, b.w, 4);
    ctx.fillStyle = "rgba(253, 224, 130, 0.12)";
    for (const win of b.windows) {
      ctx.fillRect(sx + 12 + win.c * 18, by + 14 + win.r * 22, 8, 11);
    }
  }
}

function drawDetailedPlatforms() {
  for (const p of platforms) {
    const sx = p.x - cameraX;
    if (sx + p.w < -40 || sx > W + 40) continue;

    ctx.fillStyle = "#1e2536";
    ctx.fillRect(sx, p.y, p.w, p.h);

    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    for (let rx = sx + 28; rx < sx + p.w - 12; rx += 36) {
      ctx.fillRect(rx, p.y + 12, 2, p.h - 12);
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    for (let ry = p.y + 38; ry < p.y + p.h; ry += 34) {
      ctx.fillRect(sx, ry, p.w, 2);
    }

    if (p.isBossDeck) {
      ctx.fillStyle = "#64748b";
      ctx.fillRect(sx, p.y, p.w, 9);
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(sx, p.y, p.w, 3);
    } else if (p.style === "moss") {
      ctx.fillStyle = "#3b6e5c";
      ctx.fillRect(sx, p.y, p.w, 9);
      ctx.fillStyle = "#4f8d77";
      ctx.fillRect(sx, p.y, p.w, 3);
    } else {
      ctx.fillStyle = "#334155";
      ctx.fillRect(sx, p.y, p.w, 8);
      ctx.fillStyle = "#475569";
      ctx.fillRect(sx, p.y, p.w, 2);
    }
  }
}

function drawCollectibles(timeSec) {
  for (const c of collectibles) {
    if (c.collected) continue;
    const sx = c.x - cameraX;
    const sy = c.y + Math.sin(timeSec * 4 + c.bobPhase) * 5;
    if (sx < -30 || sx > W + 30) continue;

    ctx.fillStyle = "rgba(253, 224, 71, 0.14)";
    ctx.beginPath();
    ctx.arc(sx, sy, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.moveTo(sx, sy - 9);
    ctx.lineTo(sx + 7, sy);
    ctx.lineTo(sx, sy + 9);
    ctx.lineTo(sx - 7, sy);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.moveTo(sx, sy - 6);
    ctx.lineTo(sx + 3, sy);
    ctx.lineTo(sx, sy + 2);
    ctx.lineTo(sx - 3, sy);
    ctx.closePath();
    ctx.fill();
  }
}

function drawEnemies(timeSec) {
  for (const e of enemies) {
    const sx = e.x - cameraX;
    if (sx < -60 || sx > W + 60) continue;

    if (e.type === "turret") {
      ctx.fillStyle = e.hitFlash > 0 ? "#f8fafc" : "#334155";
      ctx.beginPath();
      ctx.roundRect(sx - 14, e.y + 12, 28, 12, 4);
      ctx.fill();

      const pivotX = sx;
      const pivotY = e.y + 8;
      ctx.save();
      ctx.translate(pivotX, pivotY);
      ctx.rotate(e.aimAngle);
      ctx.fillStyle = e.hitFlash > 0 ? "#f8fafc" : "#64748b";
      ctx.fillRect(0, -3.5, 17, 7);
      ctx.restore();

      const charging = e.fireCooldown < 0.35;
      ctx.fillStyle = e.hitFlash > 0 ? "#f8fafc" : "#475569";
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 9, Math.PI, 0);
      ctx.fill();

      ctx.fillStyle = charging ? "#fb923c" : "#f59e0b";
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, charging ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === "drone") {
      const rotorW = 14 + Math.sin(timeSec * 30) * 6;
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(sx - rotorW, e.y - 4, rotorW * 2, 3);

      ctx.fillStyle = e.hitFlash > 0 ? "#f8fafc" : "#3b3554";
      ctx.beginPath();
      ctx.roundRect(sx - 14, e.y, 28, 18, 7);
      ctx.fill();

      ctx.fillStyle = "#f472b6";
      ctx.beginPath();
      ctx.arc(sx + (e.vx >= 0 ? 5 : -5), e.y + 9, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const dir = e.vx >= 0 ? 1 : -1;
      const stride = Math.sin(e.walkCycle) * 8;

      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx, e.y + 22);
      ctx.lineTo(sx - stride, e.y + e.h);
      ctx.moveTo(sx, e.y + 22);
      ctx.lineTo(sx + stride, e.y + e.h);
      ctx.stroke();

      ctx.fillStyle = e.hitFlash > 0 ? "#f8fafc" : "#4a353b";
      ctx.beginPath();
      ctx.roundRect(sx - 7, e.y + 9, 14, 15, 3);
      ctx.fill();

      ctx.fillStyle = "#cbd5e1";
      ctx.beginPath();
      ctx.arc(sx, e.y + 6, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fb7185";
      ctx.fillRect(sx + dir * 2, e.y + 5, 4, 2.5);
    }

    if (e.hp < e.maxHp) {
      const bw = 28;
      const ratio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(sx - bw / 2, e.y - 14, bw, 4);
      ctx.fillStyle = "#fb7185";
      ctx.fillRect(sx - bw / 2, e.y - 14, bw * ratio, 4);
    }
  }
}

function drawBoss() {
  if (!activeBoss) return;
  const b = activeBoss;
  const sx = b.x - cameraX;
  const sy = b.y;
  const stride = Math.sin(b.strideCycle) * 10;

  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx + 16, sy + 44);
  ctx.lineTo(sx + 16 - stride, sy + b.h);
  ctx.moveTo(sx + b.w - 16, sy + 44);
  ctx.lineTo(sx + b.w - 16 + stride, sy + b.h);
  ctx.stroke();

  ctx.fillStyle = b.hitFlash > 0 ? "#f8fafc" : "#2b3245";
  ctx.beginPath();
  ctx.roundRect(sx, sy + 8, b.w, 40, 8);
  ctx.fill();

  ctx.fillStyle = b.hitFlash > 0 ? "#f8fafc" : "#3f4963";
  ctx.beginPath();
  ctx.roundRect(sx - 6, sy + 4, 18, 18, 5);
  ctx.roundRect(sx + b.w - 12, sy + 4, 18, 18, 5);
  ctx.fill();

  const telegraphing = b.telegraphTimer > 0;
  ctx.fillStyle = telegraphing ? "#fb923c" : "#f87171";
  ctx.fillRect(sx + 10, sy + 20, 18, telegraphing ? 9 : 6);

  const barW = 360;
  const barH = 10;
  const barX = (W - barW) / 2;
  const barY = 20;
  const ratio = Math.max(0, b.hp / b.maxHp);

  ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
  ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
  ctx.fillStyle = "#f87171";
  ctx.fillRect(barX, barY, barW * ratio, barH);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${b.milestone}M WARDEN`, W / 2, barY + barH + 14);
}

function drawProjectiles() {
  for (const b of bolts) {
    const sx = b.x - cameraX;
    ctx.fillStyle = "rgba(125, 211, 252, 0.25)";
    ctx.beginPath();
    ctx.arc(sx, b.y, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e0f2fe";
    ctx.beginPath();
    ctx.arc(sx, b.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const s of enemyShots) {
    const sx = s.x - cameraX;
    ctx.fillStyle = "rgba(251, 146, 60, 0.24)";
    ctx.beginPath();
    ctx.arc(sx, s.y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fdba74";
    ctx.beginPath();
    ctx.arc(sx, s.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const sw of shockwaves) {
    const sx = sw.x - cameraX;
    ctx.strokeStyle = "#fb923c";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sw.y, 12, Math.PI, 0);
    ctx.stroke();
  }
}

function drawDetailedRunner() {
  const sx = player.x - cameraX;
  const sy = player.y;

  if (player.scarf.length > 1) {
    ctx.strokeStyle = "#f87171";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(player.scarf[0].x - cameraX, player.scarf[0].y);
    for (let i = 1; i < player.scarf.length; i++) {
      ctx.lineTo(player.scarf[i].x - cameraX, player.scarf[i].y);
    }
    ctx.stroke();
  }

  const blinkSkip = player.invulnTimer > 0 && Math.floor(player.invulnTimer * 18) % 2 === 0;
  if (blinkSkip) return;

  ctx.save();
  ctx.translate(sx + player.w / 2, sy + player.h);
  ctx.scale(player.scaleX * player.facing, player.scaleY);

  const swing = player.onGround ? Math.sin(runCycle) * 0.65 : 0.45;

  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(-Math.sin(swing) * 10, -17);
  ctx.stroke();

  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(-Math.sin(swing) * 11, -2);
  ctx.stroke();

  ctx.fillStyle = "#7dd3fc";
  ctx.beginPath();
  ctx.roundRect(-6, -30, 12, 15, 4);
  ctx.fill();

  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(Math.sin(swing) * 11, -2);
  ctx.stroke();

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(Math.sin(swing) * 10, -17);
  ctx.stroke();

  ctx.fillStyle = "#f1f5f9";
  ctx.beginPath();
  ctx.arc(1, -36, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(4, -38, 4, 2.5);

  if (player.slashTimer > 0) {
    ctx.strokeStyle = "rgba(186, 230, 253, 0.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(10, -22, 26, -0.85, 0.75);
    ctx.stroke();
  }

  ctx.restore();
}

function drawParticles() {
  for (const pt of particles) {
    const sx = pt.x - cameraX;
    const alpha = Math.max(0, pt.life / pt.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(sx, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBanner() {
  if (bossBannerTimer <= 0 || !bossBannerText) return;
  const alpha = Math.min(1, bossBannerTimer * 1.4);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(16, 19, 26, 0.75)";
  ctx.fillRect(W / 2 - 170, 54, 340, 34);
  ctx.strokeStyle = "rgba(251, 146, 60, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(W / 2 - 170, 54, 340, 34);

  ctx.fillStyle = "#fdba74";
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(bossBannerText, W / 2, 76);
  ctx.restore();
}

function draw(timeSec) {
  drawSkyAndParallax();
  drawDetailedPlatforms();
  drawCollectibles(timeSec);
  drawEnemies(timeSec);
  drawBoss();
  drawProjectiles();
  drawDetailedRunner();
  drawParticles();
  drawBanner();

  if (gameState === "paused") {
    ctx.fillStyle = "rgba(16, 19, 26, 0.65)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Paused — Press P to Resume", W / 2, H / 2);
  }
}

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  update(dt, now / 1000);
  draw(now / 1000);
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
    e.preventDefault();
  }

  const wasDown = keys[e.code];
  keys[e.code] = true;

  if (!wasDown && (e.code === "Space" || e.code === "KeyW" || e.code === "ArrowUp")) {
    if (gameState === "playing") jumpBufferTimer = 0.13;
  }

  if (!wasDown && e.code === "KeyJ") {
    triggerSlash();
  }

  if (!wasDown && e.code === "KeyK") {
    triggerPulseBolt();
  }

  if (!wasDown && e.code === "KeyP" && (gameState === "playing" || gameState === "paused")) {
    gameState = gameState === "playing" ? "paused" : "playing";
    pauseBtn.textContent = gameState === "paused" ? "Resume (P)" : "Pause (P)";
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

canvas.addEventListener("mousedown", (e) => {
  if (gameState !== "playing") return;
  const rect = canvas.getBoundingClientRect();
  const cx = ((e.clientX - rect.left) / rect.width) * W;
  const cy = ((e.clientY - rect.top) / rect.height) * H;

  if (e.button === 0) {
    triggerSlash();
  } else if (e.button === 2) {
    triggerPulseBolt(cx, cy);
  }
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

startBtn.addEventListener("click", startNewRun);
restartBtn.addEventListener("click", startNewRun);

pauseBtn.addEventListener("click", () => {
  if (gameState === "playing" || gameState === "paused") {
    gameState = gameState === "playing" ? "paused" : "playing";
    pauseBtn.textContent = gameState === "paused" ? "Resume (P)" : "Pause (P)";
  }
});

resetRunState();
requestAnimationFrame(loop);