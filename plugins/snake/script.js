(function () {
  "use strict";

  var currentWidget = null;
  var audioCtx = null;
  var lastTime = 0;

  var state = {
    playing: false,
    paused: false,
    gameOver: false,
    speedMs: 100, // starting speed from data attribute
    soundEnabled: true,
    score: 0,
    highScore: 0,
    rafId: 0,
    
    // Grid configuration
    gridSize: 20, // 20x20 cells
    cellSize: 20, // 400px / 20

    // Game state objects
    snake: [],
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    apple: { x: 0, y: 0 },
    particles: []
  };

  // Lazy initialize AudioContext to comply with autoplay policy
  function getAudioContext() {
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playEatSound() {
    if (!state.soundEnabled) return;
    try {
      var ctx = getAudioContext();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      // Audio not supported
    }
  }

  function playGameOverSound() {
    if (!state.soundEnabled) return;
    try {
      var ctx = getAudioContext();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // Audio not supported
    }
  }

  function qs(selector) {
    return currentWidget ? currentWidget.querySelector(selector) : null;
  }

  function initFromWidget(w) {
    currentWidget = w;
    var speedAttr = parseInt(w.getAttribute("data-initial-speed"), 10);
    state.speedMs = isNaN(speedAttr) ? 100 : speedAttr;
    
    // Load high score
    try {
      var saved = localStorage.getItem("degoog-snake-highscore");
      state.highScore = saved ? parseInt(saved, 10) : 0;
      if (isNaN(state.highScore)) state.highScore = 0;
    } catch (e) {
      state.highScore = 0;
    }

    resetGame();
    updateUI();
  }

  function resetGame() {
    state.playing = false;
    state.paused = false;
    state.gameOver = false;
    state.score = 0;
    
    // Center snake
    state.snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 }
    ];
    state.direction = { x: 1, y: 0 };
    state.nextDirection = { x: 1, y: 0 };
    state.particles = [];

    spawnApple();
  }

  function spawnApple() {
    var valid = false;
    var attempts = 0;
    while (!valid && attempts < 100) {
      attempts++;
      var rx = Math.floor(Math.random() * state.gridSize);
      var ry = Math.floor(Math.random() * state.gridSize);
      
      // Check if coordinate is on snake
      var conflict = false;
      for (var i = 0; i < state.snake.length; i++) {
        if (state.snake[i].x === rx && state.snake[i].y === ry) {
          conflict = true;
          break;
        }
      }
      if (!conflict) {
        state.apple = { x: rx, y: ry };
        valid = true;
      }
    }
  }

  function spawnParticles(gridX, gridY) {
    var count = 12;
    var px = gridX * state.cellSize + state.cellSize / 2;
    var py = gridY * state.cellSize + state.cellSize / 2;
    
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 1 + Math.random() * 3.5;
      state.particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1.0,
        decay: 0.02 + Math.random() * 0.03,
        size: 2 + Math.random() * 3
      });
    }
  }

  function updateParticles() {
    for (var i = state.particles.length - 1; i >= 0; i--) {
      var p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        state.particles.splice(i, 1);
      }
    }
  }

  function setDirection(dir) {
    // Prevent 180-degree turns
    var cur = state.direction;
    if (dir.x !== 0 && cur.x === 0) {
      state.nextDirection = dir;
    } else if (dir.y !== 0 && cur.y === 0) {
      state.nextDirection = dir;
    }
  }

  function startGame() {
    getAudioContext(); // Enable Audio
    resetGame();
    state.playing = true;
    lastTime = performance.now();
    
    // Hide overlays
    qs("#snake-overlay-start").classList.add("snake-hidden");
    qs("#snake-overlay-gameover").classList.add("snake-hidden");
    qs("#snake-overlay-paused").classList.add("snake-hidden");
    
    var pauseBtn = qs("#snake-pause-btn");
    if (pauseBtn) {
      pauseBtn.disabled = false;
      pauseBtn.textContent = "Pause";
    }

    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = requestAnimationFrame(tick);
    updateUI();
  }

  function pauseGame() {
    if (!state.playing || state.gameOver) return;
    state.paused = true;
    qs("#snake-overlay-paused").classList.remove("snake-hidden");
    var pauseBtn = qs("#snake-pause-btn");
    if (pauseBtn) pauseBtn.textContent = "Resume";
    updateUI();
  }

  function resumeGame() {
    if (!state.playing || !state.paused) return;
    state.paused = false;
    qs("#snake-overlay-paused").classList.add("snake-hidden");
    var pauseBtn = qs("#snake-pause-btn");
    if (pauseBtn) pauseBtn.textContent = "Pause";
    lastTime = performance.now();
    updateUI();
  }

  function triggerGameOver() {
    state.playing = false;
    state.gameOver = true;
    playGameOverSound();
    
    // Save high score if necessary
    if (state.score > state.highScore) {
      state.highScore = state.score;
      try {
        localStorage.setItem("degoog-snake-highscore", String(state.highScore));
      } catch (e) {}
    }

    var finalScoreSpan = qs("#snake-final-score");
    if (finalScoreSpan) finalScoreSpan.textContent = String(state.score);
    
    qs("#snake-overlay-gameover").classList.remove("snake-hidden");
    
    var pauseBtn = qs("#snake-pause-btn");
    if (pauseBtn) {
      pauseBtn.disabled = true;
      pauseBtn.textContent = "Pause";
    }
    updateUI();
  }

  function updateSnake() {
    if (state.paused || state.gameOver) return;

    state.direction = state.nextDirection;
    var head = state.snake[0];
    var nextHead = {
      x: head.x + state.direction.x,
      y: head.y + state.direction.y
    };

    // Collision Detection: Wall
    if (
      nextHead.x < 0 ||
      nextHead.x >= state.gridSize ||
      nextHead.y < 0 ||
      nextHead.y >= state.gridSize
    ) {
      triggerGameOver();
      return;
    }

    // Collision Detection: Self
    for (var i = 0; i < state.snake.length; i++) {
      if (state.snake[i].x === nextHead.x && state.snake[i].y === nextHead.y) {
        triggerGameOver();
        return;
      }
    }

    // Move snake head forward
    state.snake.unshift(nextHead);

    // Collision Detection: Apple
    if (nextHead.x === state.apple.x && nextHead.y === state.apple.y) {
      state.score += 10;
      playEatSound();
      spawnParticles(state.apple.x, state.apple.y);
      spawnApple();
    } else {
      // Remove tail segment if apple was not eaten
      state.snake.pop();
    }
  }

  function tick(timestamp) {
    if (state.gameOver) return;
    
    state.rafId = requestAnimationFrame(tick);
    
    var elapsed = timestamp - lastTime;
    if (state.playing && !state.paused && elapsed >= state.speedMs) {
      lastTime = timestamp - (elapsed % state.speedMs);
      updateSnake();
      updateUI();
    }

    updateParticles();
    drawGame();
  }

  function drawGame() {
    var canvas = qs("#snake-canvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw alternating checkerboard squares (Google-style but retro dark)
    for (var col = 0; col < state.gridSize; col++) {
      for (var row = 0; row < state.gridSize; row++) {
        if ((col + row) % 2 === 0) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
        } else {
          ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
        }
        ctx.fillRect(col * state.cellSize, row * state.cellSize, state.cellSize, state.cellSize);
      }
    }
    
    // Draw background grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (var col = 0; col <= state.gridSize; col++) {
      var x = col * state.cellSize;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (var row = 0; row <= state.gridSize; row++) {
      var y = row * state.cellSize;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw apple
    if (state.playing || state.gameOver) {
      var ax = state.apple.x * state.cellSize + state.cellSize / 2;
      var ay = state.apple.y * state.cellSize + state.cellSize / 2;
      var radius = state.cellSize / 2 - 2;
      
      ctx.beginPath();
      ctx.arc(ax, ay, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#f87171"; // Red-orange neon
      ctx.shadowBlur = 10;
      ctx.shadowColor = "rgba(248, 113, 113, 0.8)";
      ctx.fill();
      ctx.shadowBlur = 0; // reset
    }

    // Draw snake
    for (var i = 0; i < state.snake.length; i++) {
      var segment = state.snake[i];
      var sx = segment.x * state.cellSize;
      var sy = segment.y * state.cellSize;
      var size = state.cellSize;

      ctx.beginPath();
      if (i === 0) {
        // Head: bright green with eyes
        ctx.fillStyle = "#34d399";
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(52, 211, 153, 0.6)";
        ctx.roundRect ? ctx.roundRect(sx + 1, sy + 1, size - 2, size - 2, 4) : ctx.rect(sx + 1, sy + 1, size - 2, size - 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw eyes
        ctx.fillStyle = "#0f172a";
        var eyeSize = 3;
        var offset = 5;
        // Direction-based eye offset
        if (state.direction.x > 0) { // Right
          ctx.fillRect(sx + size - offset - eyeSize, sy + offset, eyeSize, eyeSize);
          ctx.fillRect(sx + size - offset - eyeSize, sy + size - offset - eyeSize, eyeSize, eyeSize);
        } else if (state.direction.x < 0) { // Left
          ctx.fillRect(sx + offset, sy + offset, eyeSize, eyeSize);
          ctx.fillRect(sx + offset, sy + size - offset - eyeSize, eyeSize, eyeSize);
        } else if (state.direction.y > 0) { // Down
          ctx.fillRect(sx + offset, sy + size - offset - eyeSize, eyeSize, eyeSize);
          ctx.fillRect(sx + size - offset - eyeSize, sy + size - offset - eyeSize, eyeSize, eyeSize);
        } else if (state.direction.y < 0) { // Up
          ctx.fillRect(sx + offset, sy + offset, eyeSize, eyeSize);
          ctx.fillRect(sx + size - offset - eyeSize, sy + offset, eyeSize, eyeSize);
        }
      } else {
        // Body segments: smooth green
        ctx.fillStyle = "#059669";
        var r = Math.max(1, 4 - (i / 5)); // trailing taper
        ctx.roundRect ? ctx.roundRect(sx + r, sy + r, size - r * 2, size - r * 2, 3) : ctx.rect(sx + r, sy + r, size - r * 2, size - r * 2);
        ctx.fill();
      }
    }

    // Draw eating particles
    for (var j = 0; j < state.particles.length; j++) {
      var p = state.particles[j];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(248, 113, 113, " + p.alpha + ")";
      ctx.fill();
    }
  }

  function updateUI() {
    var curScoreSpan = qs("#snake-current-score");
    if (curScoreSpan) curScoreSpan.textContent = String(state.score);
    
    var highScoreSpan = qs("#snake-high-score");
    if (highScoreSpan) highScoreSpan.textContent = String(state.highScore);

    var soundBtn = qs("#snake-sound-btn");
    if (soundBtn) {
      var onIcon = soundBtn.querySelector(".snake-sound-on");
      var offIcon = soundBtn.querySelector(".snake-sound-off");
      if (onIcon && offIcon) {
        if (state.soundEnabled) {
          onIcon.classList.remove("snake-hidden");
          offIcon.classList.add("snake-hidden");
        } else {
          onIcon.classList.add("snake-hidden");
          offIcon.classList.remove("snake-hidden");
        }
      }
    }
  }

  function handleKeyDown(event) {
    if (!currentWidget) return;
    
    // Always intercept spacebar for pause/resume if game is running/playing
    if (event.key === " " && state.playing && !state.gameOver) {
      event.preventDefault();
      if (state.paused) resumeGame();
      else pauseGame();
      return;
    }

    if (!state.playing || state.paused || state.gameOver) return;

    var dir = null;
    switch (event.key) {
      case "ArrowUp":
      case "w":
      case "W":
        dir = { x: 0, y: -1 };
        break;
      case "ArrowDown":
      case "s":
      case "S":
        dir = { x: 0, y: 1 };
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        dir = { x: -1, y: 0 };
        break;
      case "ArrowRight":
      case "d":
      case "D":
        dir = { x: 1, y: 0 };
        break;
    }

    if (dir) {
      event.preventDefault();
      setDirection(dir);
    }
  }

  function handleClick(event) {
    var w = event.target.closest("[data-snake-widget]");
    if (!w) return;
    if (w !== currentWidget) initFromWidget(w);

    var startBtn = event.target.closest("#snake-start-btn");
    var restartBtn = event.target.closest("#snake-restart-btn");
    var resumeBtn = event.target.closest("#snake-resume-btn");
    
    if (startBtn || restartBtn) {
      startGame();
      return;
    }

    if (resumeBtn) {
      resumeGame();
      return;
    }

    var pauseBtn = event.target.closest("#snake-pause-btn");
    if (pauseBtn && !pauseBtn.disabled) {
      if (state.paused) resumeGame();
      else pauseGame();
      return;
    }

    var soundBtn = event.target.closest("#snake-sound-btn");
    if (soundBtn) {
      state.soundEnabled = !state.soundEnabled;
      updateUI();
      return;
    }

    // Touch D-Pad Handling
    var dpadUp = event.target.closest("#snake-dpad-up");
    var dpadDown = event.target.closest("#snake-dpad-down");
    var dpadLeft = event.target.closest("#snake-dpad-left");
    var dpadRight = event.target.closest("#snake-dpad-right");

    if (dpadUp) setDirection({ x: 0, y: -1 });
    if (dpadDown) setDirection({ x: 0, y: 1 });
    if (dpadLeft) setDirection({ x: -1, y: 0 });
    if (dpadRight) setDirection({ x: 1, y: 0 });
  }

  function checkWidget() {
    var w = document.querySelector("[data-snake-widget]");
    if (!w) {
      if (currentWidget && !currentWidget.isConnected) {
        if (state.rafId) {
          cancelAnimationFrame(state.rafId);
          state.rafId = 0;
        }
        currentWidget = null;
      }
      return;
    }
    if (w !== currentWidget) {
      initFromWidget(w);
    }
  }

  // Event Listeners
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("click", handleClick);

  var observer = new MutationObserver(checkWidget);
  observer.observe(document.body, { childList: true, subtree: true });
  checkWidget();
})();
