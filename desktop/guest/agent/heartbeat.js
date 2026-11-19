'use strict';

// The call worker's liveness beat: the runner destroys the VM after 30 s without one.
function startHeartbeat(send, intervalMs = 5000) {
  const timer = setInterval(() => { try { send({ type: 'heartbeat' }); } catch { /* host link down; runner times out */ } }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

module.exports = { startHeartbeat };
