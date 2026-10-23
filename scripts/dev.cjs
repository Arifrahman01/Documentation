const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('====================================================');
console.log(' Starting Documentation Portal (Unified Single Server)');
console.log(' URL: http://localhost:8088                         ');
console.log(' Features: SvelteKit HMR + Native Backend APIs + AI ');
console.log('====================================================');

const isWin = process.platform === 'win32';
const rootDir = path.join(__dirname, '..');
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');

function freePort(port) {
  try {
    if (isWin) {
      const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      const lines = output.trim().split('\n');
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && pid !== String(process.pid)) {
          pids.add(pid);
        }
      }
      for (const pid of pids) {
        try {
          process.kill(Number(pid));
        } catch (e) {
          try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch (k) {}
        }
      }
    }
  } catch (e) {}
}

// Clean any leftover orphan processes on port 8088
freePort(8088);

let vite;
if (fs.existsSync(viteBin)) {
  vite = spawn(process.execPath, [viteBin, 'dev', '--port', '8088'], {
    cwd: rootDir,
    stdio: 'inherit'
  });
} else {
  const npmCmd = isWin ? 'npm.cmd' : 'npm';
  vite = spawn(npmCmd, ['run', 'vite', '--', 'dev', '--port', '8088'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: isWin
  });
}

function cleanup() {
  console.log('\nShutting down dev server...');
  try { vite.kill(); } catch (e) {}
  freePort(8088);
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
vite.on('exit', () => cleanup());
