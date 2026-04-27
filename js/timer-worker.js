let intervalId = null;
let endTime = 0;
let remaining = 0;

self.onmessage = function(e) {
  const { type, data } = e.data;
  switch (type) {
    case 'start':
      clearInterval(intervalId);
      remaining = data.seconds * 1000;
      endTime = Date.now() + remaining;
      tick();
      intervalId = setInterval(tick, 250);
      break;
    case 'pause':
      clearInterval(intervalId);
      remaining = Math.max(0, endTime - Date.now());
      break;
    case 'resume':
      endTime = Date.now() + remaining;
      clearInterval(intervalId);
      tick();
      intervalId = setInterval(tick, 250);
      break;
    case 'adjust':
      remaining = Math.max(0, (endTime - Date.now()) + data.delta * 1000);
      endTime = Date.now() + remaining;
      tick();
      break;
    case 'stop':
      clearInterval(intervalId);
      intervalId = null;
      break;
  }
};

function tick() {
  const rem = Math.max(0, endTime - Date.now());
  const secs = Math.ceil(rem / 1000);
  self.postMessage({ type: 'tick', seconds: secs });
  if (rem <= 0) {
    clearInterval(intervalId);
    intervalId = null;
    self.postMessage({ type: 'done' });
  }
}
