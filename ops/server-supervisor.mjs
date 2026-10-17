import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['server.js'], { stdio: 'inherit' });
let stopping = false;
let failures = 0;

function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  child.kill(signal);
  const forced = setTimeout(() => child.kill('SIGKILL'), 10_000);
  forced.unref();
}

for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => stop(signal));

const monitor = setInterval(async () => {
  if (stopping) return;
  try {
    const response = await fetch('http://127.0.0.1:3000/healthz.txt', {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    failures = response.ok ? 0 : failures + 1;
  } catch {
    failures++;
  }
  if (failures >= 4) {
    console.error(
      JSON.stringify({
        event: 'PUBLIC_SERVER_UNRESPONSIVE',
        at: new Date().toISOString(),
        consecutiveFailures: failures,
      }),
    );
    stop('SIGTERM');
  }
}, 30_000);
monitor.unref();

child.on('exit', (code, signal) => {
  clearInterval(monitor);
  process.exitCode = stopping && signal ? (signal === 'SIGTERM' ? 0 : 1) : (code ?? 1);
});

child.on('error', (error) => {
  console.error(
    JSON.stringify({ event: 'PUBLIC_SERVER_START_FAILED', at: new Date().toISOString(), code: error.code }),
  );
  process.exit(1);
});
