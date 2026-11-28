const { source } = require('./state.js');

function installAvatar({ portraitDataUrl, anchors, sourceLine }, { createState, meshAt }) {
  const media = window.__vibeconfMedia;
  const image = new Image();
  const state = createState({ now: performance.now(), random: Math.random });
  const surfaces = new Set();
  const portraits = new Map();
  let speakingEvent;
  let lastStepAt = -Infinity;
  let lastPose;
  let pairingCode = null;
  let consecutiveErrors = 0;
  let loggedErrors = 0;
  const avatar = window.__rfAvatar = {
    errors: 0,
    setPairingCode(code) { pairingCode = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(code) ? code : null; },
    clearPairingCode() { pairingCode = null; },
    idle() {
      state.idle();
      lastStepAt = -Infinity;
      speakingEvent = undefined;
      for (const surface of surfaces) draw(surface, { open: 0, nod: 0, blink: false }, performance.now());
    },
  };

  function portrait(size) {
    if (portraits.has(size)) return portraits.get(size);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    canvas.getContext('2d').drawImage(image, 0, 0, size, size);
    portraits.set(size, canvas);
    if (portraits.size > 2) portraits.delete(portraits.keys().next().value);
    return canvas;
  }

  function triangle(ctx, texture, names, base, moved, scale) {
    const s = names.map((name) => base[name].map((v) => v * scale));
    const t = names.map((name) => moved[name].map((v) => v * scale));
    const [[x0, y0], [x1, y1], [x2, y2]] = s;
    const [[u0, v0], [u1, v1], [u2, v2]] = t;
    const den = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
    const cx = (u0 + u1 + u2) / 3;
    const cy = (v0 + v1 + v2) / 3;
    const grown = t.map(([x, y]) => {
      const length = Math.hypot(x - cx, y - cy) || 1;
      return [x + (x - cx) * 0.8 / length, y + (y - cy) * 0.8 / length];
    });
    ctx.save();
    try {
      ctx.beginPath();
      ctx.moveTo(...grown[0]);
      ctx.lineTo(...grown[1]);
      ctx.lineTo(...grown[2]);
      ctx.closePath();
      ctx.clip();
      ctx.transform(
        (u0 * (y1 - y2) + u1 * (y2 - y0) + u2 * (y0 - y1)) / den,
        (v0 * (y1 - y2) + v1 * (y2 - y0) + v2 * (y0 - y1)) / den,
        (u0 * (x2 - x1) + u1 * (x0 - x2) + u2 * (x1 - x0)) / den,
        (v0 * (x2 - x1) + v1 * (x0 - x2) + v2 * (x1 - x0)) / den,
        (u0 * (x1 * y2 - x2 * y1) + u1 * (x2 * y0 - x0 * y2) + u2 * (x0 * y1 - x1 * y0)) / den,
        (v0 * (x1 * y2 - x2 * y1) + v1 * (x2 * y0 - x0 * y2) + v2 * (x0 * y1 - x1 * y0)) / den,
      );
      ctx.drawImage(texture, 0, 0);
    } finally {
      ctx.restore();
    }
  }

  function draw(surface, pose, now) {
    const { canvas, ctx } = surface;
    const width = canvas.width;
    const height = canvas.height;
    const size = Math.round(height * 0.62);
    const scale = size / image.width;
    const sec = now / 1000;
    const swayX = Math.sin(sec * 0.7) * 2;
    const swayY = Math.sin(sec * 0.9) * 1.5;
    const nodX = Math.sin(sec * 2.3) * pose.nod * 3;
    const nodY = Math.sin(sec * 5.1) * pose.nod * 4;
    const angle = (Math.sin(sec * 0.6) * 0.4 + Math.sin(sec * 3.7) * pose.nod * 1.2) * Math.PI / 180;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1d2021';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    try {
      ctx.translate(width / 2 + swayX + nodX, height / 2 - height * 0.03 + swayY + nodY);
      ctx.rotate(angle);
      ctx.translate(-size / 2, -size / 2);
      ctx.strokeStyle = `rgba(254,128,25,${0.3 + 0.7 * pose.nod})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(-6, -6, size + 12, size + 12);
      const texture = portrait(size);
      ctx.drawImage(texture, 0, 0);
      if (pose.open > 0 && !anchors.still) {
        const points = anchors.mesh.points;
        const moved = meshAt(anchors, pose.open * anchors.maxDrop);
        const source = meshAt(anchors, 0);
        const [ulx, uly] = points.UL;
        const [umx, umy] = points.UM;
        const [urx, ury] = points.UR;
        ctx.fillStyle = '#2a0e09';
        ctx.beginPath();
        ctx.moveTo(ulx * scale, uly * scale);
        ctx.quadraticCurveTo(umx * scale, (umy - 0.5) * scale, urx * scale, ury * scale);
        ctx.quadraticCurveTo(moved.LM[0] * scale, (moved.LM[1] + 1) * scale, ulx * scale, uly * scale);
        ctx.fill();
        for (const names of anchors.mesh.triangles) triangle(ctx, texture, names, source, moved, scale);
      }
      if (pose.blink) anchors.eyes.forEach((eye, i) => {
        ctx.fillStyle = skin[i];
        ctx.beginPath();
        ctx.ellipse(eye.x * scale, eye.y * scale, eye.w * scale, 4 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2a1a14';
        ctx.lineWidth = 1.2 * scale;
        ctx.beginPath();
        ctx.moveTo((eye.x - eye.w) * scale, (eye.y + 1) * scale);
        ctx.quadraticCurveTo(eye.x * scale, (eye.y + 3) * scale, (eye.x + eye.w) * scale, (eye.y + 1) * scale);
        ctx.stroke();
      });
    } finally {
      ctx.restore();
    }
    ctx.fillStyle = '#282828';
    ctx.fillRect(0, height - 100, width, 100);
    if (pairingCode) {
      const bannerHeight = Math.round(height * 0.16);
      ctx.save();
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, bannerHeight);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(bannerHeight * 0.68)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Code: ${pairingCode}`, width / 2, bannerHeight / 2, width * 0.62);
      ctx.restore();
    }
    ctx.fillStyle = '#fe8019';
    ctx.fillRect(width - 120, 24, 96, 56);
    ctx.fillStyle = '#1d2021';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('AI', width - 96, 66);
    ctx.fillStyle = '#ebdbb2';
    ctx.font = '32px sans-serif';
    ctx.fillText('Factory (AI)', 32, height - 54);
    ctx.font = '16px sans-serif';
    ctx.fillText(sourceLine, 32, height - 25);
  }

  let skin;
  media.on('bot-speaking', ({ speaking }) => { speakingEvent = speaking; });
  image.src = portraitDataUrl;
  return image.decode().then(() => {
    const sample = document.createElement('canvas');
    sample.width = image.width;
    sample.height = image.height;
    const ctx = sample.getContext('2d');
    ctx.drawImage(image, 0, 0);
    skin = anchors.eyes.map(({ x, y }) => {
      const pixel = ctx.getImageData(x, y - 7, 1, 1).data;
      return `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
    });
    media.setCameraRenderer((surface) => {
      surfaces.add(surface);
      if (surfaces.size > 2) surfaces.delete(surfaces.values().next().value);
      return { render() {
        try {
          const now = performance.now();
          if (now - lastStepAt >= 8) {
            lastPose = state.step(now, { level: media.speechLevel(), speakingEvent });
            lastStepAt = now;
            speakingEvent = undefined;
          }
          draw(surface, lastPose, now);
          consecutiveErrors = 0;
          if (avatar.errors < 30) avatar.errors = 0;
        } catch (error) {
          consecutiveErrors++;
          avatar.errors = Math.max(avatar.errors, consecutiveErrors);
          if (loggedErrors++ < 3) console.error('[avatar] render error', error);
          try {
            surface.canvas.width = surface.canvas.width;
            draw(surface, { open: 0, nod: 0, blink: false }, performance.now());
          } catch {
            try { surface.ctx.setTransform(1, 0, 0, 1, 0, 0); surface.ctx.fillStyle = '#1d2021'; surface.ctx.fillRect(0, 0, surface.canvas.width, surface.canvas.height); } catch {}
          }
        }
      } };
    });
  });
}

function buildRendererSource({ portraitDataUrl, anchors, sourceLine = 'Source: github.com/olafkfreund/RFactory' }) {
  return `(${installAvatar.toString()})(${JSON.stringify({ portraitDataUrl, anchors, sourceLine })}, ${source})`;
}

module.exports = { buildRendererSource };
