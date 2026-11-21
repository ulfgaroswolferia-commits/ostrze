import { spawn } from 'node:child_process';

const host = '127.0.0.1';
const port = '4173';
const origin = `http://${host}:${port}`;
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', host, '--port', port, '--strictPort'],
  { cwd: process.cwd(), stdio: 'inherit', windowsHide: true }
);
const serverClosed = new Promise((resolve) => server.once('exit', resolve));

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited with code ${server.exitCode}`);
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite did not become ready at ${origin}`);
}

try {
  await waitForServer();
  const result = spawn(
    process.execPath,
    ['node_modules/@playwright/test/cli.js', 'test'],
    { cwd: process.cwd(), stdio: 'inherit', windowsHide: true }
  );
  const exitCode = await new Promise((resolve, reject) => {
    result.once('error', reject);
    result.once('exit', (code) => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (server.exitCode === null) {
    server.kill();
    await Promise.race([serverClosed, new Promise((resolve) => setTimeout(resolve, 2_000))]);
  }
}
