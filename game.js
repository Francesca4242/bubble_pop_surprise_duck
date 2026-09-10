(() => {
  "use strict";

  // ---------- Config ----------
  const BUBBLE_MIN_SIZE = 46;
  const BUBBLE_MAX_SIZE = 90;
  const SPAWN_INTERVAL_MS = 650;
  const FLOAT_DURATION_RANGE = [5500, 10000]; // ms
  const DUCK_METER_MAX = 20; // pops to fill the shared meter
  const RANDOM_DUCK_CHANCE = 0.045; // surprise even before the meter fills
  const GOOSE_CHANCE = 0.05; // "not quite a duck" gag
  const NORMAL_POINTS = 1;
  const GOOSE_POINTS = 3;
  const DUCK_POINTS = 25;

  // ---------- State ----------
  let score = 0;
  let duckCount = 0;
  let popsTowardDuck = 0;
  let soundOn = true;
  let spawnTimer = null;
  let running = false;

  // ---------- DOM ----------
  const bubbleLayer = document.getElementById("bubbleLayer");
  const toastLayer = document.getElementById("toastLayer");
  const scoreEl = document.getElementById("score");
  const duckCountEl = document.getElementById("duckCount");
  const duckMeterFill = document.getElementById("duckMeterFill");
  const soundToggle = document.getElementById("soundToggle");
  const introOverlay = document.getElementById("introOverlay");
  const startButton = document.getElementById("startButton");
  const gameEl = document.getElementById("game");

  // ---------- Audio (tiny WebAudio blips, no files needed) ----------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    return audioCtx;
  }

  function playTone(freq, duration, type = "sine", gainValue = 0.08) {
    if (!soundOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainValue;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  }

  function playPopSound() {
    playTone(520 + Math.random() * 120, 0.12, "triangle", 0.06);
  }

  function playDuckSound() {
    playTone(700, 0.12, "square", 0.09);
    setTimeout(() => playTone(500, 0.18, "square", 0.09), 110);
  }

  function playGooseSound() {
    playTone(220, 0.25, "sawtooth", 0.07);
  }

  // ---------- Helpers ----------
  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function updateHUD() {
    scoreEl.textContent = score;
    duckCountEl.textContent = duckCount;
    const pct = Math.min(100, (popsTowardDuck / DUCK_METER_MAX) * 100);
    duckMeterFill.style.width = pct + "%";
  }

  function spawnToast(x, y, text, cssClass) {
    const toast = document.createElement("div");
    toast.className = "toast " + cssClass;
    toast.textContent = text;
    toast.style.left = x + "px";
    toast.style.top = y + "px";
    toastLayer.appendChild(toast);
    setTimeout(() => toast.remove(), 1200);
  }

  function showDuckBanner() {
    const existing = document.getElementById("duckBanner");
    if (existing) existing.remove();
    const banner = document.createElement("div");
    banner.id = "duckBanner";
    banner.innerHTML =
      '<img src="images/surprise_duck.png" alt="Surprise duck" />' +
      "<span>SURPRISE DUCK! +" + DUCK_POINTS + "</span>";
    gameEl.appendChild(banner);
    setTimeout(() => banner.remove(), 2200);
  }

  // ---------- Bubble creation ----------
  function createBubble() {
    if (!running) return;

    const bubble = document.createElement("button");
    bubble.className = "bubble";
    bubble.type = "button";
    bubble.setAttribute("aria-label", "Pop bubble");

    const size = rand(BUBBLE_MIN_SIZE, BUBBLE_MAX_SIZE);
    bubble.style.width = size + "px";
    bubble.style.height = size + "px";

    const gameWidth = gameEl.clientWidth;
    const leftPos = rand(10, Math.max(10, gameWidth - size - 10));
    bubble.style.left = leftPos + "px";

    const floatDuration = rand(FLOAT_DURATION_RANGE[0], FLOAT_DURATION_RANGE[1]);
    const swayDuration = rand(2000, 3600);
    bubble.style.animationDuration = floatDuration + "ms, " + swayDuration + "ms";

    const img = document.createElement("img");
    img.src = "images/bubble.png";
    img.alt = "Bubble";
    img.draggable = false;
    bubble.appendChild(img);

    bubble.dataset.popped = "false";

    bubble.addEventListener("animationend", (e) => {
      if (e.animationName === "float-up" && bubble.dataset.popped === "false") {
        bubble.remove();
      }
    });

    bubble.addEventListener("click", () => onBubblePopped(bubble));
    bubble.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        onBubblePopped(bubble);
      },
      { passive: false }
    );

    bubbleLayer.appendChild(bubble);
  }

  function onBubblePopped(bubble) {
    if (bubble.dataset.popped === "true") return;
    bubble.dataset.popped = "true";

    const rect = bubble.getBoundingClientRect();
    const gameRect = gameEl.getBoundingClientRect();
    const centerX = rect.left - gameRect.left + rect.width / 2;
    const centerY = rect.top - gameRect.top;

    const img = bubble.querySelector("img");

    const meterFull = popsTowardDuck >= DUCK_METER_MAX;
    const luckyDuck = Math.random() < RANDOM_DUCK_CHANCE;
    const isDuck = meterFull || luckyDuck;
    const isGoose = !isDuck && Math.random() < GOOSE_CHANCE;

    if (isDuck) {
      img.src = "images/surprise_duck.png";
      img.alt = "Surprise duck!";
      bubble.classList.add("duck-reveal");
      score += DUCK_POINTS;
      duckCount += 1;
      popsTowardDuck = 0;
      spawnToast(centerX, centerY, "+" + DUCK_POINTS + " QUACK!", "duck");
      showDuckBanner();
      playDuckSound();
    } else if (isGoose) {
      img.src = "images/goose.png";
      img.alt = "Just a goose";
      bubble.classList.add("goose-reveal");
      score += GOOSE_POINTS;
      popsTowardDuck += 1;
      spawnToast(centerX, centerY, "Honk! Not a duck +" + GOOSE_POINTS, "goose");
      playGooseSound();
    } else {
      bubble.classList.add("popping");
      score += NORMAL_POINTS;
      popsTowardDuck += 1;
      spawnToast(centerX, centerY, "+" + NORMAL_POINTS, "normal");
      playPopSound();
    }

    updateHUD();
    setTimeout(() => bubble.remove(), 1000);
  }

  // ---------- Game loop control ----------
  function startGame() {
    if (running) return;
    running = true;
    ensureAudio();
    spawnTimer = setInterval(createBubble, SPAWN_INTERVAL_MS);
    createBubble();
  }

  soundToggle.addEventListener("click", () => {
    soundOn = !soundOn;
    soundToggle.textContent = soundOn ? "🔊" : "🔇";
    soundToggle.setAttribute("aria-pressed", String(soundOn));
  });

  startButton.addEventListener("click", () => {
    introOverlay.setAttribute("hidden", "");
    startGame();
  });

  updateHUD();
})();
