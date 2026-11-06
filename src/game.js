(() => {
  'use strict';

  const W = 540, H = 780, FRAME = 1000 / 60;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const boardInner = document.getElementById('boardInner');
  const fileInput = document.getElementById('fileInput');
  const chooseFileButton = document.getElementById('chooseFile');
  const newFileButton = document.getElementById('newFileButton');
  const resultBackdrop = document.getElementById('resultBackdrop');
  const resultTitle = document.getElementById('resultTitle');
  const resultFile = document.getElementById('resultFile');
  const resultIcon = document.getElementById('resultIcon');
  const confettiEl = document.getElementById('confetti');
  const toastEl = document.getElementById('toast');

  // Configure the optional upload API in src/config.js.
  const CONFIG = window.FILE_UPLOAD_CONFIG || {};
  const UPLOAD_ENDPOINT = typeof CONFIG.uploadEndpoint === 'string'
    ? CONFIG.uploadEndpoint.trim()
    : '';
  const configuredMaxFileSize = Number(CONFIG.maxFileSizeBytes);
  const MAX_FILE_SIZE = Number.isFinite(configuredMaxFileSize) && configuredMaxFileSize > 0
    ? configuredMaxFileSize
    : 25 * 1024 * 1024;
  const configuredTimeout = Number(CONFIG.uploadTimeoutMs);
  const UPLOAD_TIMEOUT_MS = Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : 60_000;

  const pitch = { left: 25, right: 515, top: 25, bottom: 755 };
  const goal = { left: 183, right: 357, line: 38 };
  const fileToken = { x: 270, y: 675, vx: 0, vy: 0, r: 22, angle: 0 };
  const keeper = { x: 270, y: 73, vx: 0, r: 20 };
  const defenders = [
    { x: 205, y: 190, vx: 0, r: 20, base: 205, amp: 48, speed: .76, phase: .7 },
    { x: 335, y: 325, vx: 0, r: 20, base: 335, amp: 55, speed: .61, phase: 2.6 },
    { x: 245, y: 465, vx: 0, r: 20, base: 245, amp: 63, speed: .52, phase: 4.2 }
  ];

  let selectedFile = null;
  let fileObjectUrl = null;
  let fileImage = null;
  let gameState = 'empty'; // empty | ready | moving | uploading | success | error
  let pointer = null;
  let lastTime = 0;
  let gameTime = 0;
  let toastTimer = null;
  let goalHandled = false;
  let dragDepth = 0;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }
  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  }
  function extension(name) {
    const part = (name.split('.').pop() || 'FILE').toUpperCase();
    return part.length > 5 ? part.slice(0, 5) : part;
  }
  function resetFileToken() {
    fileToken.x = W / 2;
    fileToken.y = 675;
    fileToken.vx = fileToken.vy = 0;
    fileToken.angle = 0;
    pointer = null;
    goalHandled = false;
    gameState = selectedFile ? 'ready' : 'empty';
  }
  function setFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      showToast(`File size must be ${formatBytes(MAX_FILE_SIZE)} or less.`);
      return;
    }
    selectedFile = file;
    if (fileObjectUrl) URL.revokeObjectURL(fileObjectUrl);
    fileObjectUrl = URL.createObjectURL(file);
    fileImage = null;
    if (file.type && file.type.startsWith('image/')) {
      const img = new Image();
      const imageUrl = fileObjectUrl;
      img.onload = () => {
        if (fileObjectUrl === imageUrl) fileImage = img;
      };
      img.src = imageUrl;
    }
    boardInner.classList.add('has-file');
    resultBackdrop.classList.remove('show');
    resetFileToken();
    canvas.focus({ preventScroll: true });
  }
  function chooseFile() { fileInput.click(); }

  chooseFileButton.addEventListener('click', chooseFile);
  newFileButton.addEventListener('click', () => {
    // Keep the current result visible until a replacement file is actually selected.
    // If the native file picker is cancelled, the previous state remains usable.
    chooseFile();
  });
  fileInput.addEventListener('change', event => {
    const file = event.target.files && event.target.files[0];
    if (file) setFile(file);
    fileInput.value = '';
  });

  // Drop files directly onto the field.
  boardInner.addEventListener('dragenter', event => {
    event.preventDefault();
    dragDepth++;
    boardInner.classList.add('is-dragover');
  });
  boardInner.addEventListener('dragover', event => event.preventDefault());
  boardInner.addEventListener('dragleave', event => {
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) boardInner.classList.remove('is-dragover');
  });
  boardInner.addEventListener('drop', event => {
    event.preventDefault();
    dragDepth = 0;
    boardInner.classList.remove('is-dragover');
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) setFile(file);
  });
  window.addEventListener('dragover', event => {
    if (event.dataTransfer && [...event.dataTransfer.types].includes('Files')) event.preventDefault();
  });

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * W / rect.width,
      y: (event.clientY - rect.top) * H / rect.height
    };
  }
  function onPointerDown(event) {
    if (!selectedFile || !['ready', 'moving'].includes(gameState)) return;
    if (Math.hypot(fileToken.vx, fileToken.vy) > .55) return;
    const p = pointerPosition(event);
    if (Math.hypot(p.x - fileToken.x, p.y - fileToken.y) > 56) return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    pointer = { id: event.pointerId, x: fileToken.x, y: fileToken.y, current: p };
    gameState = 'ready';
  }
  function onPointerMove(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    pointer.current = pointerPosition(event);
  }
  function onPointerUp(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = pointer.x - pointer.current.x;
    const dy = pointer.y - pointer.current.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 8) {
      const power = clamp(distance * .17, 2.8, 18.5);
      fileToken.vx = dx / distance * power;
      fileToken.vy = dy / distance * power;
      gameState = 'moving';
    }
    pointer = null;
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  function roundedRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawPitch() {
    const grass = ctx.createLinearGradient(0, 0, W, H);
    grass.addColorStop(0, '#39934f');
    grass.addColorStop(.52, '#2c8045');
    grass.addColorStop(1, '#246d3c');
    ctx.fillStyle = grass;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(4,49,23,.045)' : 'rgba(235,255,228,.035)';
      ctx.fillRect(pitch.left, pitch.top + i * 61, pitch.right - pitch.left, 61);
    }
    for (let i = 0; i < 190; i++) {
      const x = (i * 97 % 480) + 29;
      const y = (i * 173 % 724) + 28;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(230,255,220,.075)' : 'rgba(4,42,22,.075)';
      ctx.fillRect(x, y, i % 4 === 0 ? 2 : 1, 2);
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(240,255,239,.62)';
    ctx.lineWidth = 2.2;
    roundedRect(ctx, pitch.left, pitch.top, pitch.right - pitch.left, pitch.bottom - pitch.top, 2);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pitch.left, H / 2); ctx.lineTo(pitch.right, H / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 73, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.fill();
    ctx.strokeRect(105, pitch.top, 330, 118);
    ctx.strokeRect(159, pitch.top, 222, 58);
    ctx.strokeRect(105, pitch.bottom - 118, 330, 118);
    ctx.strokeRect(159, pitch.bottom - 58, 222, 58);
    ctx.beginPath(); ctx.arc(W / 2, 143, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W / 2, pitch.bottom - 143, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Goal and recessed net.
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.28)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(4,20,11,.42)';
    ctx.fillRect(goal.left, 4, goal.right - goal.left, 47);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(248,255,246,.95)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(goal.left, 7); ctx.lineTo(goal.left, 45); ctx.lineTo(goal.right, 45); ctx.lineTo(goal.right, 7);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(228,255,231,.24)';
    ctx.lineWidth = 1;
    for (let x = goal.left + 11; x < goal.right; x += 12) {
      ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, 44); ctx.stroke();
    }
    for (let y = 15; y < 45; y += 8) {
      ctx.beginPath(); ctx.moveTo(goal.left + 2, y); ctx.lineTo(goal.right - 2, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawDefender(player) {
    const x = player.x, y = player.y, r = player.r;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(x, y + 7, r * .98, r * .7, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill();
    ctx.shadowColor = 'rgba(80,8,18,.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
    const g = ctx.createRadialGradient(x - 7, y - 9, 2, x, y, r + 2);
    g.addColorStop(0, '#ffb0a9'); g.addColorStop(.48, '#f56a6d'); g.addColorStop(1, '#b93146');
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.88)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r - 6, 0, Math.PI * 2);
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(95,17,31,.34)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,245,238,.92)';
    ctx.beginPath(); ctx.arc(x, y, 4.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // The goalkeeper uses the exact same red-piece design as the defenders.
  function drawKeeper() {
    drawDefender(keeper);
  }

  function drawFileToken() {
    const x = fileToken.x, y = fileToken.y;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(fileToken.angle);
    ctx.shadowColor = 'rgba(0,0,0,.42)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 7;
    roundedRect(ctx, -19, -24, 38, 48, 8);
    ctx.fillStyle = '#f4ffe8'; ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#c7eaa6';
    ctx.beginPath(); ctx.moveTo(7, -24); ctx.lineTo(19, -12); ctx.lineTo(7, -12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(28,64,36,.3)'; ctx.lineWidth = 1.1; ctx.stroke();
    if (fileImage) {
      ctx.save(); roundedRect(ctx, -13, -13, 26, 19, 3); ctx.clip(); ctx.drawImage(fileImage, -13, -13, 26, 19); ctx.restore();
      ctx.fillStyle = '#1d4e2d'; ctx.fillRect(-11, 10, 22, 2); ctx.fillRect(-11, 14, 15, 2);
    } else {
      ctx.fillStyle = '#275b37'; ctx.font = '900 9px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(selectedFile ? extension(selectedFile.name) : 'FILE', 0, -1);
      ctx.fillStyle = '#7fae6c'; ctx.fillRect(-10, 10, 20, 2); ctx.fillRect(-10, 14, 13, 2);
    }
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(x, y + 25, 17, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.19)'; ctx.fill();
  }

  function drawAim() {
    if (!pointer) return;
    const dx = pointer.x - pointer.current.x;
    const dy = pointer.y - pointer.current.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 3) return;
    const ux = dx / distance, uy = dy / distance;
    const length = Math.min(166, distance * 1.2);
    const sx = fileToken.x, sy = fileToken.y;
    const ex = sx + ux * length, ey = sy + uy * length;
    ctx.save();
    ctx.strokeStyle = 'rgba(231,255,184,.92)'; ctx.lineWidth = 2.4;
    ctx.setLineDash([7, 7]); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
    const angle = Math.atan2(ey - sy, ex - sx);
    ctx.translate(ex, ey); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-12, -7); ctx.lineTo(-9, 0); ctx.lineTo(-12, 7); ctx.closePath();
    ctx.fillStyle = 'rgba(231,255,184,.95)'; ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawPitch();
    defenders.forEach(drawDefender);
    drawKeeper();
    if (selectedFile) drawFileToken();
    drawAim();
  }

  function collideCircle(cx, cy, radius, obstacleVx = 0, obstacleVy = 0, restitution = .83) {
    const dx = fileToken.x - cx, dy = fileToken.y - cy;
    const distance = Math.hypot(dx, dy);
    const minDistance = fileToken.r + radius;
    if (distance >= minDistance) return;
    const nx = distance < .001 ? (fileToken.vx - obstacleVx >= 0 ? 1 : -1) : dx / distance;
    const ny = distance < .001 ? 0 : dy / distance;
    fileToken.x = cx + nx * (minDistance + .35);
    fileToken.y = cy + ny * (minDistance + .35);
    const rvx = fileToken.vx - obstacleVx;
    const rvy = fileToken.vy - obstacleVy;
    const normalVelocity = rvx * nx + rvy * ny;
    if (normalVelocity < 0) {
      const impulse = (1 + restitution) * normalVelocity;
      fileToken.vx -= impulse * nx;
      fileToken.vy -= impulse * ny;
      const tangentX = -ny, tangentY = nx;
      const tangentVelocity = rvx * tangentX + rvy * tangentY;
      const grip = clamp(.12 + Math.abs(normalVelocity) * .004, .12, .22);
      fileToken.vx -= tangentVelocity * tangentX * grip;
      fileToken.vy -= tangentVelocity * tangentY * grip;
    }
  }

  function updateKeeper(dtScale) {
    const oldX = keeper.x;
    const patrol = W / 2 + Math.sin(gameTime * .00115) * 60;
    let target = patrol;
    if (selectedFile && fileToken.y < 285 && fileToken.vy < 0) {
      const predicted = fileToken.x + fileToken.vx * 2.2;
      target = lerp(patrol, predicted, .38);
    }
    target = clamp(target, goal.left + keeper.r, goal.right - keeper.r);
    keeper.x += clamp(target - keeper.x, -3.15 * dtScale, 3.15 * dtScale);
    keeper.vx = dtScale > 0 ? (keeper.x - oldX) / dtScale : 0;
  }

  function updateObstacles(dtScale) {
    defenders.forEach(player => {
      const oldX = player.x;
      player.x = player.base + Math.sin(gameTime * .001 * player.speed + player.phase) * player.amp;
      player.vx = dtScale > 0 ? (player.x - oldX) / dtScale : 0;
    });
  }

  function update(dt) {
    const dtScale = dt / FRAME;
    gameTime += dt;
    updateKeeper(dtScale);
    updateObstacles(dtScale);
    if (!selectedFile || !['moving'].includes(gameState)) return;

    const speed = Math.hypot(fileToken.vx, fileToken.vy);
    if (speed < .28) {
      fileToken.vx = fileToken.vy = 0;
      gameState = 'ready';
      return;
    }

    // Small adaptive substeps prevent tunnelling through pieces on fast shots.
    const steps = clamp(Math.ceil(speed * dtScale / 5), 1, 12);
    const stepScale = dtScale / steps;
    for (let step = 0; step < steps; step++) {
      const previousY = fileToken.y;
      fileToken.x += fileToken.vx * stepScale;
      fileToken.y += fileToken.vy * stepScale;
      fileToken.angle += fileToken.vx * .0017 * dt;

      // Side and lower touchlines.
      if (fileToken.x - fileToken.r < pitch.left) {
        fileToken.x = pitch.left + fileToken.r;
        fileToken.vx = Math.abs(fileToken.vx) * .82;
        fileToken.vy *= .985;
      }
      if (fileToken.x + fileToken.r > pitch.right) {
        fileToken.x = pitch.right - fileToken.r;
        fileToken.vx = -Math.abs(fileToken.vx) * .82;
        fileToken.vy *= .985;
      }
      if (fileToken.y + fileToken.r > pitch.bottom) {
        fileToken.y = pitch.bottom - fileToken.r;
        fileToken.vy = -Math.abs(fileToken.vy) * .82;
        fileToken.vx *= .985;
      }

      // The only opening in the upper touchline is the goal.
      if (fileToken.y - fileToken.r < pitch.top) {
        const insideMouth = fileToken.x > goal.left + 5 && fileToken.x < goal.right - 5;
        if (insideMouth && fileToken.y < goal.line) {
          handleGoal();
          return;
        }
        if (!insideMouth) {
          fileToken.y = pitch.top + fileToken.r;
          fileToken.vy = Math.abs(fileToken.vy) * .8;
          fileToken.vx *= .985;
        }
      }

      defenders.forEach(player => collideCircle(player.x, player.y, player.r, player.vx, 0, .86));
      collideCircle(keeper.x, keeper.y, keeper.r, keeper.vx, 0, .9);

      // Rolling resistance is a real deceleration, not a very long exponential glide.
      // This keeps powerful shots satisfying while allowing every move to settle quickly.
      const currentSpeed = Math.hypot(fileToken.vx, fileToken.vy);
      const rollingDeceleration = .185 + currentSpeed * .0038;
      const nextSpeed = Math.max(0, currentSpeed - rollingDeceleration * stepScale);
      if (nextSpeed < .28) {
        fileToken.vx = 0;
        fileToken.vy = 0;
        gameState = 'ready';
        return;
      }
      const speedRatio = nextSpeed / currentSpeed;
      fileToken.vx *= speedRatio;
      fileToken.vy *= speedRatio;

      if (previousY < fileToken.y && fileToken.y > pitch.bottom - fileToken.r) break;
    }
  }

  function burstConfetti() {
    confettiEl.innerHTML = '';
    const colors = ['#caff70', '#ffffff', '#ff8f82', '#ffe7a3'];
    for (let i = 0; i < 38; i++) {
      const bit = document.createElement('i');
      bit.style.left = Math.random() * 100 + '%';
      bit.style.background = colors[i % colors.length];
      bit.style.animationDelay = Math.random() * .38 + 's';
      bit.style.transform = `rotate(${Math.random() * 180}deg)`;
      confettiEl.appendChild(bit);
    }
    setTimeout(() => { confettiEl.innerHTML = ''; }, 2200);
  }

  function showSuccess() {
    resultTitle.textContent = 'File uploaded successfully';
    resultIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 6.8" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    resultIcon.style.background = 'var(--lime)';
    resultIcon.style.color = '#132410';
    resultFile.textContent = selectedFile ? selectedFile.name : '';
    resultBackdrop.classList.add('show');
    burstConfetti();
    gameState = 'success';
  }

  async function handleGoal() {
    if (goalHandled || !selectedFile) return;
    goalHandled = true;
    fileToken.vx = fileToken.vy = 0;
    gameState = 'uploading';

    if (UPLOAD_ENDPOINT) {
      try {
        const form = new FormData();
        form.append('file', selectedFile, selectedFile.name);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
        let response;
        try {
          response = await fetch(UPLOAD_ENDPOINT, {
            method: 'POST',
            body: form,
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }
        if (!response.ok) throw new Error(`Upload failed (${response.status})`);
        showSuccess();
      } catch (error) {
        gameState = 'error';
        resultTitle.textContent = 'Upload failed';
        resultIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 7v6m0 4h.01M4.9 19h14.2c1.3 0 2.1-1.4 1.4-2.5L13.4 4.2c-.6-1.1-2.2-1.1-2.8 0L3.5 16.5c-.7 1.1.1 2.5 1.4 2.5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
        resultIcon.style.background = '#ff8b82';
        resultIcon.style.color = '#3b1218';
        resultFile.textContent = selectedFile.name;
        resultBackdrop.classList.add('show');
      }
    } else {
      // Demo mode: the goal shows a simulated success state.
      // Set uploadEndpoint in src/config.js to enable real server uploads.
      showSuccess();
    }
  }

  function frame(time) {
    const dt = Math.min(34, time - (lastTime || time));
    lastTime = time;
    update(dt || FRAME);
    draw();
    requestAnimationFrame(frame);
  }

  // Keyboard fallback: Enter/Space shoots toward the goal.
  canvas.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && selectedFile && gameState === 'ready') {
      event.preventDefault();
      fileToken.vx = 0;
      fileToken.vy = -12;
      gameState = 'moving';
    }
  });

  window.addEventListener('pagehide', () => {
    if (fileObjectUrl) URL.revokeObjectURL(fileObjectUrl);
    clearTimeout(toastTimer);
  });

  requestAnimationFrame(frame);
})();
