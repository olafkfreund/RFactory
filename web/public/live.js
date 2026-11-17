// View-only noVNC page. noVNC is pinned to 1.6.0 and vendored under /vendor/novnc/ (no CDN); see the step 9 note in the plan.
import RFB from '/vendor/novnc/core/rfb.js';

const status = document.getElementById('status');
const id = new URLSearchParams(location.search).get('desktop_id') || '';
if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
  status.textContent = 'Missing or invalid desktop_id.';
} else {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const rfb = new RFB(document.getElementById('screen'), `${proto}://${location.host}/desktop/live/${id}`);
  rfb.viewOnly = true;
  rfb.scaleViewport = true;
  rfb.addEventListener('connect', () => { status.textContent = 'Connected (view only).'; });
  rfb.addEventListener('disconnect', () => { status.textContent = 'Disconnected.'; });
}
