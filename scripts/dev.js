const { spawn } = require('child_process');
const path = require('path');

console.log('====================================================');
console.log(' Starting Documentation Portal Development Mode...  ');
console.log(' - Backend API & AI Engine: http://localhost:8088  ');
console.log(' - Frontend SvelteKit HMR:  http://localhost:5173  ');
console.log('====================================================');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const nodeCmd = isWin ? 'node.exe' : 'node';

const server = spawn(nodeCmd, ['server.js'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: '8088' }
});

const vite = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, '..', 'frontend'),
  stdio: 'inherit'
});

function cleanup() {
  console.log('\nShutting down servers...');
  try { server.kill(); } catch (e) {}
  try { vite.kill(); } catch (e) {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
server.on('exit', () => cleanup());
vite.on('exit', () => cleanup());
