const playfield = document.getElementById('playfield');
const frame = document.getElementById('frame');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const restartBtn = document.getElementById('restart-btn');
const scoreEl = document.getElementById('score');
const poppedEl = document.getElementById('popped-count');
const streakEl = document.getElementById('streak');
const timerEl = document.getElementById('timer');
const activeCountEl = document.getElementById('active-count');
const form = document.getElementById('entry-form');
const input = document.getElementById('word-input');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayDetail = document.getElementById('overlay-detail');
const introOverlay = document.getElementById('intro-overlay');
const introClose = document.getElementById('intro-close');
const rotateBtn = document.getElementById('rotate-btn');
const mobileOverlay = document.getElementById('mobile-overlay');
const mobileContinue = document.getElementById('mobile-continue');
const pinToggles = document.querySelectorAll('.pin-toggle input');
const themeButtons = document.querySelectorAll('[data-theme]');
const heroBox = document.querySelector('.hero');
const statsBox = document.querySelector('.stats');
const controlsBox = document.querySelector('.game-controls');
const rotateBox = document.querySelector('.rotate-panel');

const WORDS = [
  'orbit', 'pulse', 'flash', 'matrix', 'echo', 'slide', 'glow', 'spark', 'trace', 'drift',
  'storm', 'wave', 'pixel', 'shift', 'flare', 'bounce', 'swift', 'nova', 'comet', 'aura',
  'nexus', 'quark', 'vivid', 'sonic', 'lumen', 'prism', 'glyph', 'rally', 'sprint', 'prime',
  'chase', 'fleet', 'clear', 'bold', 'rapid', 'punch', 'blaze', 'ripple', 'bright', 'shine',
  'racer', 'quick', 'laser', 'hatch', 'tempo', 'rush', 'dodge', 'sparkle', 'tumble', 'sketch',
  'vector', 'cinder', 'ember', 'flick', 'rider', 'streak', 'swirl', 'hustle', 'snap', 'scale',
  'craft', 'thrive', 'climb', 'float', 'pilot', 'atlas', 'rover', 'drone', 'pioneer', 'zenith',
  'flashy', 'ready', 'punchy', 'burst', 'dart', 'fling', 'hover', 'jolt', 'leap', 'loom',
  'loop', 'nudge', 'quiver', 'scout', 'swoop', 'twist', 'vault', 'vortex', 'whirl', 'zip'
];

const state = {
  running: false,
  words: [],
  spawnTimer: null,
  countdownTimer: null,
  timeLeft: 60,
  score: 0,
  popped: 0,
  streak: 0,
  bestStreak: 0,
  nextId: 0,
  lastTick: 0,
  floaters: [],
  theme: 'dark',
  rotationEnabled: false,
  mobileDismissed: false,
  currentLevel: 0,
  instability: 0,
  missedWords: 0,
  entropy: 0,
  levelPopped: 0,
  collapseTimer: null, // L5 Collapse Timer
  l3Metrics: {
    avgSpeed: 0,
    popCount: 0,
    fastCount: 0,
    slowCount: 0,
    missedPool: [],
    activeRule: null // 'SPLIT', 'HEAVY', 'RECUR'
  },
  l4Metrics: {
    mergedPop: false
  }
};

function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}


function randomVelocity() {
  // Level 0: Stable System - Constant speed, no chaos
  if (state.currentLevel === 0) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 100; // Constant speed
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };
  }

  const angle = Math.random() * Math.PI * 2;
  const speed = 60 + Math.random() * 140; // pixels per second
  return {
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  };
}

function getHeavyVelocity() {
  // Rule B: Heavy words fall faster
  const angle = Math.random() * Math.PI; // Downward bias? No, just random direction but heavy gravity feel?
  // Actually physics is simple constant velocity in this game. 
  // "Heavier words fall faster" -> Simple high Y velocity.
  // Let's force a downward trajectory with high speed.
  return {
    vx: (Math.random() - 0.5) * 50, // Minimal horizontal
    vy: 200 + Math.random() * 100,  // Fast downward
  };
}

function scheduleNextSpawn() {
  if (!state.running) return;

  let delay = 1000;

  // Level 1: Dynamic spawn rate based on instability
  if (state.currentLevel === 1) {
    // Spawn rate increases as instability increases
    // Base 1000ms, reduces by up to 600ms based on instability
    const reduction = Math.min(600, state.instability * 50);
    delay = 1000 - reduction;
  }

  state.spawnTimer = setTimeout(() => {
    spawnWord();
    scheduleNextSpawn();
  }, delay);
}

// Level 4 Helper: Logic for merging words
function mergeWords(w1, w2) {
  // Remove original words
  w1.el.remove();
  w2.el.remove();
  // Filter out from state
  state.words = state.words.filter(w => w.id !== w1.id && w.id !== w2.id);

  // Create new merged details
  // Text: Combined
  const newText = w1.text + w2.text;
  const isUnstable = w1.unstable || w2.unstable;

  // Position: Midpoint
  const mx = (w1.x + w2.x) / 2;
  const my = (w1.y + w2.y) / 2;

  // Spawn new mega word
  const el = document.createElement('span');
  el.className = 'word spawn mega';
  el.textContent = newText;
  if (isUnstable) el.classList.add('unstable');

  const id = state.nextId++;
  el.dataset.id = String(id);
  playfield.appendChild(el);

  const { width, height } = el.getBoundingClientRect();

  // Slower velocity for merged words
  // Inherit direction momentum? Or just slow down?
  // "Merged words fall slower"
  const mvx = (w1.vx + w2.vx) / 2 * 0.7;
  const mvy = Math.abs((w1.vy + w2.vy) / 2 * 0.7); // Ensure falling down mostly? Or just slower.

  state.words.push({
    id,
    text: newText,
    originalText: newText,
    x: mx, y: my,
    vx: mvx, vy: mvy,
    w: width, h: height,
    el,
    popped: false,
    angle: 0,
    lastBounce: 0,
    spawnTime: performance.now(),
    unstable: isUnstable,
    isMerged: true // Flag for victory condition
  });
}

function getCorruptedWord(word, entropy) {
  // Level 2: Letter removal probability based on entropy (0 to 100)
  // Max corruption chance ~50% at 100 entropy
  const chance = Math.min(0.5, entropy / 200);

  let textToType = '';
  let displayText = '';

  for (const char of word) {
    if (Math.random() < chance) {
      // Corrupt this letter
      displayText += '_';
      // Do not add to textToType (user skips this letter)
    } else {
      textToType += char;
      displayText += char;
    }
  }

  // Ensure at least one character is typed, or whole word is lost (which is fine, just pop it? No, avoid empty)
  if (textToType.length === 0) {
    // Force keep first char
    const first = word[0];
    textToType = first;
    displayText = first + displayText.substring(1);
  }

  return { textToType, displayText };
}

function spawnWord(overrideText = null, isSplitPart = false) {
  if (!state.running) return;

  // Decide Word Source
  let word = overrideText;

  // Rule C: Error Adaptation (Recur corrupted missed words)
  if (!word && state.currentLevel === 3 && state.l3Metrics.activeRule === 'RECUR' && state.l3Metrics.missedPool.length > 0) {
    // 50% chance to spawn a missed word if available
    if (Math.random() > 0.5) {
      word = state.l3Metrics.missedPool.shift();
      // Recurs returns corrupted (managed below or here?)
      // Requirement: "Corrupted words may have missing or scrambled letters."
      // We can use getCorruptedWord from Level 2 with high factor, handled below.
    }
  }

  if (!word) {
    const activeTexts = new Set(state.words.map(w => w.text.toLowerCase()));
    const available = WORDS.filter(w => !activeTexts.has(w.toLowerCase()));
    if (!available.length) return;
    word = available[Math.floor(Math.random() * available.length)];
  }

  // Rule A: Fast Typing Adaptation (Split Words)
  // If we just picked a new word (not an override), and Rule A is active, split it!
  if (!overrideText && state.currentLevel === 3 && state.l3Metrics.activeRule === 'SPLIT' && word.length >= 4) {
    const mid = Math.floor(word.length / 2);
    const part1 = word.slice(0, mid);
    const part2 = word.slice(mid);
    spawnWord(part1, true);
    setTimeout(() => spawnWord(part2, true), 200); // Slight delay for second part
    return; // Don't spawn the original
  }

  // Level 4 Spatial Pressure Check (Failure Condition)
  if (state.currentLevel === 4 && !overrideText) {
    // "Screen becomes too crowded to spawn new words"
    // Simple heuristic: If we failed to find a spawn spot X times? 
    // Or just check word count? 
    // Let's check overlap of potential spawn.
    // But standard spawn logic just picks random X.
    // "The more words on screen: The less horizontal space is available"
    // If we have > 15 words?
    if (state.words.length > 15) {
      failLevel4();
      return;
    }
  }

  const el = document.createElement('span');
  el.className = 'word spawn';

  let text = word;
  let velocity = randomVelocity();

  // Level 3 Logic per spawn
  if (state.currentLevel === 3) {
    // Visuals for rules
    if (state.l3Metrics.activeRule === 'HEAVY') {
      el.classList.add('heavy'); // Ensure CSS supports or just use velocity
      velocity = getHeavyVelocity();
    }

    // Recur corruption is applied if we pulled from missedPool?
    // Or just generic corruption for Rule C?
    // "Previously missed words return in corrupted form."
    // Let's check if this was a recur spawn (we don't strictly track origin here easily without extra arg,
    // but we can just corrupt if rule is RECUR).
    if (state.l3Metrics.activeRule === 'RECUR') {
      // Apply corruption
      const corrupted = getCorruptedWord(word, 100); // High corruption
      text = corrupted.textToType;
      el.textContent = corrupted.displayText;
      el.classList.add('glitch');
    } else if (isSplitPart) {
      // Maybe visual indicator for split?
      el.style.color = '#ff00ff'; // Distinct color for split parts? Prompt said subtle.
      el.textContent = word;
    } else {
      el.textContent = word;
    }
  }
  // Level 2 Corruption Logic
  else if (state.currentLevel === 2) {
    const corrupted = getCorruptedWord(word, state.entropy);
    text = corrupted.textToType;
    el.textContent = corrupted.displayText; // Show with underscores
  } else if (state.currentLevel === 5) {
    // Level 5: Text Rendering Instability
    // Sometimes corrupted, sometimes not. Flickering?
    // We can just rely on CSS glitch or occasional scramble here.
    el.classList.add('glitch');
    el.textContent = word;
  } else {
    el.textContent = word;
  }

  // Level 5: Broken Rules (Rule Breakdown)
  if (state.currentLevel === 5) {
    // Randomly fluctuate speed (inconsistent physics)
    if (Math.random() < 0.1) {
      velocity.vx += (Math.random() - 0.5) * 500;
      velocity.vy += (Math.random() - 0.5) * 500;
    }
  }

  const id = state.nextId++;
  el.dataset.id = String(id);
  playfield.appendChild(el);

  const rect = playfield.getBoundingClientRect();
  const { width, height } = el.getBoundingClientRect();
  const maxX = Math.max(0, rect.width - width);
  const maxY = Math.max(0, rect.height - height);
  const x = Math.random() * maxX;
  const y = Math.random() * maxY;

  // Use calculated velocity (standard or heavy)
  const { vx, vy } = velocity;

  state.words.push({
    id,
    text: text, // Use the potentially corrupted (typed) text
    originalText: word,
    x, y, vx, vy, w: width, h: height,
    el,
    popped: false,
    angle: 0,
    lastBounce: 0,
    spawnTime: performance.now(),
  });
  updateWordPosition(state.words[state.words.length - 1]);
  requestAnimationFrame(() => el.classList.remove('spawn'));
  renderCounts();
}

function updateWordPosition(word) {
  word.el.style.transform = `translate(${word.x}px, ${word.y}px) rotate(${word.angle}deg)`;
}

function tick(now) {
  const delta = (now - state.lastTick) / 1000 || 0;
  state.lastTick = now;

  if (state.running) {
    // Level 2: Entropy Growth & Visual Decay
    if (state.currentLevel === 2) {
      // Entropy increases continuously (e.g., 2 per second)
      // Slowed slightly by active play? Prompt says "never reverse".
      state.entropy += delta * 1.5;

      // Critical Threshold Failure
      if (state.entropy >= 100) {
        failLevel2();
      }

      // Visual Decay Effects
      // Brightness drops to 50%, slight blur
      const brightness = Math.max(0.5, 1 - (state.entropy / 200));
      const blur = Math.min(2, state.entropy / 50); // max 2px blur
      document.body.style.filter = `brightness(${brightness}) blur(${blur}px) grayscale(${state.entropy}%)`;
    }

    // Level 5: Visual Chaos Update
    if (state.currentLevel === 5) {
      // Random rapid filter changes
      if (Math.random() < 0.2) {
        const invert = Math.random() < 0.5 ? 0 : 0.9;
        const blur = Math.random() * 2;
        document.body.style.filter = `invert(${invert}) blur(${blur}px) hue-rotate(${Math.random() * 360}deg)`;
      }
    }

    updateFloaters(delta, now);
  }

  if (state.running) {
    const bounds = playfield.getBoundingClientRect();
    for (const word of state.words) {
      if (word.popped) continue;
      word.x += word.vx * delta;
      word.y += word.vy * delta;
      let bounced = false;

      if (word.x <= 0) {
        word.x = 0;
        word.vx = Math.abs(word.vx);
        bounced = true;
      } else if (word.x + word.w >= bounds.width) {
        word.x = bounds.width - word.w;
        word.vx = -Math.abs(word.vx);
        bounced = true;
      }

      if (word.y <= 0) {
        word.y = 0;
        word.vy = Math.abs(word.vy);
        bounced = true;
      } else if (word.y + word.h >= bounds.height) {
        word.y = bounds.height - word.h;
        word.vy = -Math.abs(word.vy);
        bounced = true;

        // Level 1 Failure Condition: Too many words reach bottom
        if (state.currentLevel === 1) {
          state.missedWords++;
          if (state.missedWords >= 5) {
            failLevel1();
          }
        }

        // Level 3 Tracking: Missed words
        if (state.currentLevel === 3) {
          state.missedWords++;
          // Store for RECUR rule
          if (word.originalText) {
            state.l3Metrics.missedPool.push(word.originalText);
          }

          if (state.missedWords >= 8) { // Threshold for L3 failure
            failLevel3();
          }
        }
      }

      // Level 1: Feedback Loop Physics
      // Apply instability to speed and drift
      if (state.currentLevel === 1) {
        // Speed multiplier adds up to 2x speed based on instability
        const speedMultiplier = 1 + (state.instability * 0.1);
        word.x += (word.vx * delta * (speedMultiplier - 1)); // Add extra motion
        word.y += (word.vy * delta * (speedMultiplier - 1));

        // Random horizontal drift when instability is high
        if (state.instability > 5) {
          word.x += (Math.random() - 0.5) * state.instability * delta * 10;
        }
      }

      if (state.rotationEnabled && bounced && state.currentLevel !== 0) {
        const since = now - (word.lastBounce || 0);
        if (since > 40) {
          word.angle = (word.angle + 90) % 360;
          word.lastBounce = now;
        }
      }

      updateWordPosition(word);
    }
  }

  requestAnimationFrame(tick);
}

function popWord(word) {
  if (!word || word.popped) return;
  word.popped = true;
  word.el.classList.add('popping');
  const gain = word.text.length;
  state.score += gain;
  state.popped += 1;
  state.streak += 1;
  state.bestStreak = Math.max(state.bestStreak, state.streak);
  renderCounts();
  word.el.addEventListener('animationend', () => {
    word.el.remove();
  });
  state.words = state.words.filter(w => w.id !== word.id);

  // Level 1 Feedback Loop
  if (state.currentLevel === 1) {
    const now = performance.now();
    const timeToPop = (now - word.spawnTime) / 1000;
    const instabilityGain = Math.min(2.0, 1.0 / Math.max(0.2, timeToPop));
    state.instability += instabilityGain;
  }

  // Level 2 Progress: Pop 30 corrupted words
  if (state.currentLevel === 2) {
    state.levelPopped++;
    // Entropy is not reduced, but maybe we can flash a cleaner screen?
    // Prompt says "Player actions may slightly slow entropy growth, but never reverse it."
    // We handle growth in tick(), maybe we can reduce the rate temporarily there, but simpler is just fixed growth.

    if (state.levelPopped >= 30 && state.entropy < 100) {
      completeLevel2();
    }
  }

  // Level 3 Progress
  if (state.currentLevel === 3) {
    const now = performance.now();
    const timeToPop = (now - word.spawnTime) / 1000;

    // Update Average Speed
    state.l3Metrics.popCount++;
    const prevAvg = state.l3Metrics.avgSpeed;
    state.l3Metrics.avgSpeed = prevAvg + (timeToPop - prevAvg) / state.l3Metrics.popCount;

    // Track streaks
    if (timeToPop < 1.0) { // Fast pop
      state.l3Metrics.fastCount++;
      state.l3Metrics.slowCount = 0;
    } else if (timeToPop > 2.5) { // Slow pop
      state.l3Metrics.slowCount++;
      state.l3Metrics.fastCount = 0;
    } else {
      state.l3Metrics.fastCount = 0;
      state.l3Metrics.slowCount = 0;
    }

    // Select Adaptive Rule
    // Priority: Error > Fast > Slow
    // Or just dominance based on recent behavior.

    // Rule C: Errors (if missed words high recently)
    // We check missedWords count. If > 3.
    if (state.missedWords > 3) {
      state.l3Metrics.activeRule = 'RECUR';
    }
    // Rule A: Fast Typing
    else if (state.l3Metrics.fastCount >= 3 || state.l3Metrics.avgSpeed < 1.2) {
      state.l3Metrics.activeRule = 'SPLIT';
    }
    // Rule B: Slow Typing
    else if (state.l3Metrics.slowCount >= 2 || state.l3Metrics.avgSpeed > 2.0) {
      state.l3Metrics.activeRule = 'HEAVY';
    }
    else {
      state.l3Metrics.activeRule = null;
    }
  }

  // Level 4 Goal: Pop ONE merged word
  if (state.currentLevel === 4 && word.isMerged) {
    completeLevel4();
  }

  // Level 0 Goal
  if (state.currentLevel === 0 && state.popped >= 20) {
    completeLevel0();
  }
}

function handleInput(value) {
  const target = value.trim().toLowerCase();
  if (!target) return;

  // Level 5: Input Failure (Broken Interaction)
  if (state.currentLevel === 5) {
    // 20% Chance to ignore input completely
    if (Math.random() < 0.2) return;

    // Artificial Delay? (Simulated by setTimeout logic wrapper if we wanted complex)
    // For now, simpler: random failure is annoying enough.
    // "Input delay increases slightly" -> can't easily block sync thread, but ignoring some chars works or input lag visuals.
  }

  const match = state.words.find(w => w.text.toLowerCase() === target);
  if (match) {
    popWord(match);
  } else {
    state.score -= target.length;
    state.streak = 0;
    renderCounts();
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 180);
  }
  input.value = '';
}

function startGame() {
  if (state.running) return;
  hideIntro();
  resetGame();
  state.running = true;
  state.timeLeft = 60;
  state.lastTick = performance.now();
  startBtn.disabled = true;
  overlay.classList.add('hidden');
  spawnWord();
  scheduleNextSpawn();
  state.countdownTimer = setInterval(() => {
    state.timeLeft -= 1;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      if (state.currentLevel === 1) {
        completeLevel1();
      } else {
        endGame();
      }
    }
    renderCounts();
  }, 1000);
  renderCounts();
  input.focus();
  requestAnimationFrame(tick);
}

function stopGame() {
  resetGame();
  startBtn.disabled = false;
  overlay.classList.add('hidden');
}

function endGame() {
  state.running = false;
  clearInterval(state.spawnTimer);
  clearTimeout(state.spawnTimer);
  clearInterval(state.countdownTimer);
  startBtn.disabled = false;
  overlayTitle.textContent = 'Time!';
  overlayDetail.textContent = `Words: ${state.popped} | Score: ${state.score} | Best streak: ${state.bestStreak}`;
  overlay.classList.remove('hidden');
}

function resetGame() {
  state.running = false;
  clearInterval(state.spawnTimer);
  clearInterval(state.countdownTimer);
  state.score = 0;
  state.popped = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.timeLeft = 60;
  state.words.forEach(w => w.el.remove());
  state.words = [];
  state.currentLevel = 0; // Always start at Level 0
  state.instability = 0;
  state.missedWords = 0;
  state.entropy = 0;
  state.levelPopped = 0;
  document.body.style.filter = ''; // Reset visuals
  clearTimeout(state.spawnTimer);
  renderCounts();
}

function startLevel1() {
  state.currentLevel = 1;
  state.instability = 0;
  state.missedWords = 0;
  state.timeLeft = 45; // Level 1 timer
  state.running = true;
  state.lastTick = performance.now();

  // Show level start message? For now just start mechanics
  scheduleNextSpawn();

  state.countdownTimer = setInterval(() => {
    state.timeLeft -= 1;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      completeLevel1();
    }
    renderCounts();
  }, 1000);

  requestAnimationFrame(tick);
}

function failLevel1() {
  state.running = false;
  clearTimeout(state.spawnTimer);
  clearInterval(state.countdownTimer);
  overlayTitle.textContent = 'SYSTEM OVERLOAD';
  overlayDetail.textContent = 'RETRY LEVEL 1';

  // Custom retry action for Level 1
  restartBtn.textContent = 'Retry Level 1';
  const retryHandler = () => {
    restartBtn.removeEventListener('click', retryHandler);
    restartBtn.textContent = 'Play again'; // Reset text
    resetGame(); // Full reset or just level reset? 
    // Request implies "Retry Level 1", but usually that means resetting state.
    // For simplicity, let's just reset the game loop logic but force startLevel1?
    // User flow: Fail L1 -> Click Retry -> Start L1?
    // Current resetGame sets Level 0. Let's make a special start for L1 or just standard reset.
    // Standard reset goes to L0. Let's redirect to startLevel1 if they were on L1.
    // Actually, prompt says "RETRY LEVEL 1", so we should restart L1.
    hideIntro();
    overlay.classList.add('hidden');
    state.words.forEach(w => w.el.remove());
    state.words = [];
    state.score = 0; // Keep score? Or reset? Usually reset level score.
    // Keeping accumulated score from L0 might be tricky if we don't track snapshots.
    // Let's just hard reset to L1 start state (score 0 effectively or kept).
    startLevel1();
  };
  restartBtn.onclick = retryHandler; // Override default listener

  overlay.classList.remove('hidden');
}

function completeLevel1() {
  // Pause gameplay
  state.running = false;
  clearTimeout(state.spawnTimer);
  clearInterval(state.countdownTimer);

  // Show status message
  overlayTitle.textContent = 'FEEDBACK LOOP CONFIRMED';
  overlayDetail.textContent = 'Processing feedback...';
  restartBtn.classList.add('hidden');
  overlay.classList.remove('hidden');

  // Transition after 2 seconds
  setTimeout(() => {
    state.currentLevel = 2; // Move to next
    overlay.classList.add('hidden');
    restartBtn.classList.remove('hidden');
    state.running = false;
    // Transition to Level 2
    startLevel2();
  }, 2000);
}

function startLevel2() {
  state.currentLevel = 2;
  state.entropy = 0;
  state.levelPopped = 0;
  state.running = true;
  state.lastTick = performance.now();

  // No strict timer, pressure comes from entropy
  // Clear any existing timers just in case
  clearInterval(state.countdownTimer);
  timerEl.textContent = 'Decay';

  scheduleNextSpawn();
  requestAnimationFrame(tick);
}

function failLevel2() {
  state.running = false;
  clearTimeout(state.spawnTimer);
  overlayTitle.textContent = 'SYSTEM DECAY CRITICAL';
  overlayDetail.textContent = 'STRUCTURAL INTEGRITY LOST';

  restartBtn.textContent = 'Retry Level 2';
  const retryHandler = () => {
    restartBtn.removeEventListener('click', retryHandler);
    restartBtn.textContent = 'Play again';
    document.body.style.filter = ''; // Reset visuals
    resetGame();
    hideIntro();
    overlay.classList.add('hidden');
    state.words.forEach(w => w.el.remove());
    state.words = [];
    state.score = 0;
    startLevel2();
  };
  restartBtn.onclick = retryHandler;

  overlay.classList.remove('hidden');
}

function completeLevel2() {
  state.running = false;
  clearTimeout(state.spawnTimer);

  overlayTitle.textContent = 'ENTROPY STABILIZED';
  overlayDetail.textContent = 'TEMPORARY RECOVERY ACHIEVED';
  restartBtn.classList.add('hidden');
  overlay.classList.remove('hidden');

  setTimeout(() => {
    state.currentLevel = 3;
    overlay.classList.add('hidden');
    restartBtn.classList.remove('hidden');
    document.body.style.filter = ''; // Reset visuals for next level (or keep?)
    // Proceed to Level 3
    startLevel3();
  }, 2000);
}

function startLevel3() {
  state.currentLevel = 3;
  state.missedWords = 0; // Reset for L3 tracking
  state.entropy = 0;     // Clear L2 entropy
  document.body.style.filter = ''; // Reset visuals

  // Init Layout 3 Metrics
  state.l3Metrics = {
    avgSpeed: 0,
    popCount: 0,
    fastCount: 0,
    slowCount: 0,
    missedPool: [],
    activeRule: null
  };

  state.timeLeft = 60; // 60s Survival
  state.running = true;
  state.lastTick = performance.now();

  // Clear any existing timers
  clearInterval(state.countdownTimer);
  clearTimeout(state.spawnTimer);

  // Countdown for L3
  state.countdownTimer = setInterval(() => {
    state.timeLeft -= 1;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      completeLevel3(); // Survival complete
    }
    renderCounts();
  }, 1000);

  scheduleNextSpawn();
  requestAnimationFrame(tick);
}

function failLevel3() {
  state.running = false;
  clearTimeout(state.spawnTimer);
  clearInterval(state.countdownTimer);

  overlayTitle.textContent = 'ADAPTIVE DEFENSE FAILED';
  overlayDetail.textContent = 'SYSTEM OVERRUN';

  restartBtn.textContent = 'Retry Level 3';
  const retryHandler = () => {
    restartBtn.removeEventListener('click', retryHandler);
    restartBtn.textContent = 'Play again';
    resetGame();
    hideIntro();
    overlay.classList.add('hidden');
    state.words.forEach(w => w.el.remove());
    state.words = [];
    state.score = 0;
    startLevel3();
  };
  restartBtn.onclick = retryHandler;
  overlay.classList.remove('hidden');
}

function completeLevel3() {
  state.running = false;
  clearTimeout(state.spawnTimer);
  clearInterval(state.countdownTimer);

  overlayTitle.textContent = 'RULES MUTATED';
  overlayDetail.textContent = 'SYSTEM LEARNING CONFIRMED';
  restartBtn.classList.add('hidden');
  overlay.classList.remove('hidden');

  setTimeout(() => {
    state.currentLevel = 4;
    overlay.classList.add('hidden');
    restartBtn.classList.remove('hidden');
    alert("Level 4 Not Implemented Yet");
  }, 2000);
}

function startLevel4() {
  state.currentLevel = 4;
  state.words.forEach(w => w.el.remove());
  state.words = [];
  state.l4Metrics = { mergedPop: false };

  // Disable timers
  clearInterval(state.spawnTimer);
  clearTimeout(state.spawnTimer);
  clearInterval(state.countdownTimer);
  timerEl.textContent = '∞';

  state.running = true;
  state.lastTick = performance.now();

  scheduleNextSpawn();
  requestAnimationFrame(tick);
}

function failLevel4() {
  state.running = false;
  clearTimeout(state.spawnTimer);

  overlayTitle.textContent = 'SYSTEM SATURATION REACHED';
  overlayDetail.textContent = 'EMERGENT OVERLOAD';

  restartBtn.textContent = 'Retry Level 4';
  const retryHandler = () => {
    restartBtn.removeEventListener('click', retryHandler);
    restartBtn.textContent = 'Play again';
    resetGame();
    hideIntro();
    overlay.classList.add('hidden');
    startLevel4();
  };
  restartBtn.onclick = retryHandler;
  overlay.classList.remove('hidden');
}

function completeLevel4() {
  state.running = false;
  clearTimeout(state.spawnTimer);

  overlayTitle.textContent = 'EMERGENT STRUCTURE DETECTED';
  overlayDetail.textContent = 'SYSTEM STATE UNSTABLE';
  restartBtn.classList.add('hidden');
  overlay.classList.remove('hidden');

  setTimeout(() => {
    state.currentLevel = 5;
    overlay.classList.add('hidden');
    restartBtn.classList.remove('hidden');
    // Proceed to Level 5
    startLevel5();
  }, 2000);
}

function startLevel5() {
  state.currentLevel = 5;
  state.words.forEach(w => w.el.remove());
  state.words = [];

  // No timers, no win condition
  clearInterval(state.spawnTimer);
  clearTimeout(state.spawnTimer);
  clearInterval(state.countdownTimer);
  timerEl.textContent = 'ERROR';

  state.running = true;
  state.lastTick = performance.now();

  // Visual Collapse
  document.body.style.transition = 'filter 0.1s'; // Fast updates
  // UI Misalignment handled in render/tick via CSS classes or manual offset?
  // Let's settle for CSS filter chaos in tick() mostly.

  // Auto-schedule collapse in 15-20 seconds (System cannot hold)
  state.collapseTimer = setTimeout(triggerSystemCollapse, 15000); // 15s of torture

  scheduleNextSpawn();
  requestAnimationFrame(tick);
}

function triggerSystemCollapse() {
  state.running = false;
  clearTimeout(state.spawnTimer);
  clearTimeout(state.collapseTimer);

  // Final freeze visuals
  document.body.style.filter = 'invert(1) contrast(2) blur(4px)';

  overlayTitle.textContent = 'LANGUAGE INTEGRITY FAILED';
  overlayDetail.textContent = 'SYSTEM COLLAPSE COMPLETE';
  restartBtn.classList.add('hidden'); // Cannot manual restart, auto cycle
  overlay.classList.remove('hidden');

  // Fade to black and restart
  setTimeout(() => {
    // Fade out
    document.body.style.transition = 'opacity 2s ease';
    document.body.style.opacity = '0';

    setTimeout(() => {
      // Restart Cycle
      document.body.style.opacity = '1';
      document.body.style.filter = '';
      resetGame(); // back to 0
      hideIntro();
      overlay.classList.add('hidden');
      state.currentLevel = 0; // Ensure 0
      // Maybe auto start? Or wait for start button? 
      // Prompt: "Automatically restart the game at Level 0."
      // Usually implies waiting for user Start, or auto-running L0? 
      // "Restart the game" -> back to title screen state usually. 
      // But let's reset to clean slate.
      resetGame();
      overlay.classList.add('hidden');
      startBtn.disabled = false;
    }, 2000);
  }, 4000); // Show message for 4s
}

function completeLevel0() {
  // Pause gameplay
  state.running = false;
  clearInterval(state.spawnTimer);
  clearInterval(state.countdownTimer);

  // Show status message
  overlayTitle.textContent = 'SYSTEM STABLE';
  overlayDetail.textContent = 'BASELINE ESTABLISHED';
  restartBtn.classList.add('hidden'); // Hide restart button during transition
  overlay.classList.remove('hidden');

  // Transition after 2 seconds
  setTimeout(() => {
    state.currentLevel = 1;

    // Hide overlay and restore UI
    overlay.classList.add('hidden');
    restartBtn.classList.remove('hidden');

    // Automatically resume gameplay for Level 1
    startLevel1();
    // Level 1 logic handled in startLevel1

    requestAnimationFrame(tick);
  }, 2000);
}

function renderCounts() {
  if (state.currentLevel === 5) {
    // Flicker/Freeze score display
    if (Math.random() < 0.3) return; // 30% chance to SKIP update (freeze)

    // Random offset for UI
    // We can't easily move fixed elements without layout shift, 
    // but we can jitter values?
    if (Math.random() < 0.1) {
      scoreEl.textContent = 'ERR';
      return;
    }
  }

  scoreEl.textContent = state.score;
  poppedEl.textContent = state.popped;
  streakEl.textContent = state.streak;
  timerEl.textContent = `${state.timeLeft}s`;
  activeCountEl.textContent = state.words.length;
}

startBtn.addEventListener('click', startGame);
stopBtn.addEventListener('click', stopGame);
restartBtn.addEventListener('click', startGame);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!state.running) return;
  handleInput(input.value);
});

input.addEventListener('focus', () => {
  if (!state.running) return;
  input.select();
});

window.addEventListener('resize', () => {
  // Keep words within bounds if window shrinks.
  const bounds = playfield.getBoundingClientRect();
  for (const word of state.words) {
    word.x = Math.min(word.x, Math.max(0, bounds.width - word.w));
    word.y = Math.min(word.y, Math.max(0, bounds.height - word.h));
    updateWordPosition(word);
  }

  const vw = frame.clientWidth;
  const vh = frame.clientHeight;
  for (const floater of state.floaters) {
    floater.w = floater.el.offsetWidth;
    floater.h = floater.el.offsetHeight;
    floater.x = Math.min(floater.x, Math.max(0, vw - floater.w));
    floater.y = Math.min(floater.y, Math.max(0, vh - floater.h));
    floater.el.style.transform = `translate(${floater.x}px, ${floater.y}px)`;
  }

  checkMobileOverlay();
});

function applyTheme(theme) {
  const themes = ['dark', 'light', 'neon', 'crt'];
  themes.forEach(t => document.body.classList.remove(`theme-${t}`));
  if (themes.includes(theme)) {
    document.body.classList.add(`theme-${theme}`);
    state.theme = theme;
  }
  themeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function initFloaters() {
  const frameRect = frame.getBoundingClientRect();
  const innerW = frame.clientWidth;
  const innerH = frame.clientHeight;
  const entries = [
    { key: 'hero', el: heroBox, anchor: () => ({ x: 20, y: 20 }) },
    {
      key: 'stats',
      el: statsBox,
      anchor: () => {
        const rect = statsBox.getBoundingClientRect();
        return { x: innerW - rect.width - 20, y: 20 };
      },
    },
    {
      key: 'controls',
      el: controlsBox,
      anchor: () => {
        const rect = controlsBox.getBoundingClientRect();
        return { x: (innerW - rect.width) / 2, y: innerH - rect.height - 20 };
      },
    },
  ];

  if (rotateBox) {
    entries.push({
      key: 'rotate',
      el: rotateBox,
      anchor: () => {
        const rect = { width: rotateBox.offsetWidth, height: rotateBox.offsetHeight };
        return { x: innerW - rect.width - 20, y: innerH / 2 - rect.height / 2 };
      },
    });
  }

  state.floaters = entries.map(entry => {
    const rect = { width: entry.el.offsetWidth, height: entry.el.offsetHeight };
    const { x, y } = entry.anchor();
    const { vx, vy } = randomVelocity();
    return {
      key: entry.key,
      el: entry.el,
      x,
      y,
      w: rect.width,
      h: rect.height,
      vx,
      vy,
      pinned: false,
      angle: 0,
      lastBounce: 0,
    };
  });

  for (const floater of state.floaters) {
    floater.el.style.transform = `translate(${floater.x}px, ${floater.y}px)`;
  }
}

function updateFloaters(delta, now = performance.now()) {
  const bounds = { w: frame.clientWidth, h: frame.clientHeight };
  for (const floater of state.floaters) {
    if (floater.pinned) continue;
    floater.w = floater.el.offsetWidth;
    floater.h = floater.el.offsetHeight;

    floater.x += floater.vx * delta;
    floater.y += floater.vy * delta;
    let bounced = false;

    if (floater.x <= 0) {
      floater.x = 0;
      floater.vx = Math.abs(floater.vx);
      bounced = true;
    } else if (floater.x + floater.w >= bounds.w) {
      floater.x = bounds.w - floater.w;
      floater.vx = -Math.abs(floater.vx);
      bounced = true;
    }

    if (floater.y <= 0) {
      floater.y = 0;
      floater.vy = Math.abs(floater.vy);
      bounced = true;
    } else if (floater.y + floater.h >= bounds.h) {
      floater.y = bounds.h - floater.h;
      floater.vy = -Math.abs(floater.vy);
      bounced = true;
    }

    floater.x = Math.min(floater.x, Math.max(0, bounds.w - floater.w));
    floater.y = Math.min(floater.y, Math.max(0, bounds.h - floater.h));

    if (state.rotationEnabled && bounced) {
      const since = now - (floater.lastBounce || 0);
      if (since > 40) {
        floater.angle = (floater.angle + 90) % 360;
        floater.lastBounce = now;
      }
    }

    floater.el.style.transform = `translate(${floater.x}px, ${floater.y}px) rotate(${floater.angle}deg)`;
  }
}

pinToggles.forEach(toggle => {
  toggle.addEventListener('change', () => {
    const key = toggle.dataset.floater;
    const floater = state.floaters.find(f => f.key === key);
    if (floater) {
      floater.pinned = toggle.checked;
    }
  });
});

themeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    applyTheme(btn.dataset.theme);
  });
});

if (rotateBtn) {
  rotateBtn.addEventListener('click', () => {
    state.rotationEnabled = !state.rotationEnabled;
    rotateBtn.classList.toggle('active', state.rotationEnabled);
    rotateBtn.textContent = state.rotationEnabled ? 'Rotation: on' : 'Allow rotation';
    rotateBtn.setAttribute('aria-pressed', state.rotationEnabled ? 'true' : 'false');
  });
}

function checkMobileOverlay() {
  if (!mobileOverlay || state.mobileDismissed) return;
  const smallSide = Math.min(window.innerWidth, window.innerHeight);
  if (smallSide < 720) {
    mobileOverlay.classList.remove('hidden');
  } else {
    mobileOverlay.classList.add('hidden');
  }
}

if (mobileContinue) {
  mobileContinue.addEventListener('click', () => {
    state.mobileDismissed = true;
    mobileOverlay.classList.add('hidden');
  });
}

initFloaters();
applyTheme(state.theme);
checkMobileOverlay();
state.lastTick = performance.now();
requestAnimationFrame(tick);

function hideIntro() {
  if (introOverlay) {
    introOverlay.classList.add('hidden');
  }
}

if (introClose) {
  introClose.addEventListener('click', hideIntro);
}
