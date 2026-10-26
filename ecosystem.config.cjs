const path = require('path');
const fs = require('fs');

// Load .env (support dotenv if installed, with native fallback)
const envPath = path.resolve(__dirname, '.env');
try {
  require('dotenv').config({ path: envPath });
} catch {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
}

// Ensure ./logs directory exists for PM2
const logsDir = path.resolve(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = {
  apps: [{
    name: "DocumentationPortal",
    script: "build/index.js",
    instances: 1,
    exec_mode: "fork",
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: 5008,
      HOST: "0.0.0.0",
      ORIGIN: process.env.ORIGIN || "https://demo2.jhonlingroup.id",
      DATABASE_PORT: process.env.DATABASE_PORT || 3306,
      SAP_CLIENT: process.env.SAP_CLIENT || "100"
    },
    error_file: "./logs/error.log",
    out_file: "./logs/access.log",
    log_date_format: "YYYY-MM-DD HH:mm Z",
    autorestart: true,
    max_memory_restart: "4G"
  }]
};
