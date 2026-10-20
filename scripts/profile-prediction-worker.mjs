// Run via docker compose exec -T worker node --input-type=module < this file.
// Samples CPU only. No debugger pause, heap dump, environment dump or DB write.
const port = Number(process.env.PROFILE_INSPECTOR_PORT || 9229);
const pid = Number(process.env.PROFILE_TARGET_PID || 1);
if (!Number.isInteger(port) || port < 1024 || port > 65535 || !Number.isInteger(pid) || pid < 1)
  throw new Error('INVALID_PROFILE_TARGET');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket, opened = false, sequence = 0, stage = 'connect';
const pending = new Map();
const deadline = setTimeout(() => {
  console.log(JSON.stringify({ status: 'failed', stage, code: 'PROFILE_TIMEOUT' }));
  process.exit(1);
}, 35_000);
async function targets() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(1000),
    });
    if (!response.ok) return [];
    return await response.json();
  } catch { return []; }
}
function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('PROFILE_COMMAND_TIMEOUT')); }, 8000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
try {
  let list = await targets();
  if (!list.length) {
    // SIGUSR1 uses Node's default loopback-only inspector. No Docker port is published.
    process.kill(pid, 'SIGUSR1');
    opened = true;
    for (let i = 0; i < 10 && !list.length; i++) { await pause(500); list = await targets(); }
  }
  const target = list.find((item) => item.type === 'node');
  if (!target?.webSocketDebuggerUrl) throw new Error('PROFILE_TARGET_UNAVAILABLE');
  const address = new URL(target.webSocketDebuggerUrl);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(address.hostname))
    throw new Error('PROFILE_TARGET_NOT_LOCAL');
  socket = new WebSocket(address);
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error('PROFILE_COMMAND_FAILED'));
    else request.resolve(message.result);
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('PROFILE_SOCKET_FAILED')), { once: true });
  });
  stage = 'sample';
  await send('Profiler.enable');
  await send('Profiler.start');
  await pause(5000);
  const { profile } = await send('Profiler.stop');
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parent = new Map();
  for (const node of profile.nodes)
    for (const child of node.children || []) parent.set(child, node.id);
  const times = new Map();
  for (let i = 0; i < (profile.samples || []).length; i++) {
    const id = profile.samples[i];
    times.set(id, (times.get(id) || 0) + (profile.timeDeltas?.[i] || 0));
  }
  const total = [...times.values()].reduce((sum, value) => sum + value, 0);
  const top = [...times].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([id, time]) => {
    const frame = nodes.get(id).callFrame;
    const callers = [];
    let current = parent.get(id);
    for (let depth = 0; depth < 5 && current; depth++) {
      callers.push(nodes.get(current).callFrame.functionName || '(anonymous)');
      current = parent.get(current);
    }
    return { function: frame.functionName || '(anonymous)',
      percent: Math.round(time * 1000 / (total || 1)) / 10,
      file: frame.url?.split('?')[0].slice(-120), line: frame.lineNumber + 1,
      column: frame.columnNumber + 1, callers };
  });
  console.log(JSON.stringify({ status: 'success', scope: 'worker CPU sample; no request bodies or environment',
    seconds: (profile.endTime - profile.startTime) / 1e6, top }, null, 2));
} catch (error) {
  console.log(JSON.stringify({ status: 'failed', stage,
    code: /^PROFILE_[A-Z_]+$/.test(error.message) ? error.message : 'PROFILE_UNAVAILABLE' }));
  process.exitCode = 1;
} finally {
  if (opened && socket?.readyState === WebSocket.OPEN) {
    // Close only the loopback inspector started by this diagnostic. Existing
    // debugging sessions are left intact. Evaluation only schedules its cleanup.
    await send('Runtime.evaluate', {
      expression: "setTimeout(() => process.getBuiltinModule('node:inspector').close(), 100); 'cleanup scheduled'",
    }).catch(() => {});
  }
  socket?.close();
  for (const request of pending.values()) clearTimeout(request.timer);
  clearTimeout(deadline);
}
