FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine AS runtime

RUN apk add --no-cache tzdata \
 && npm install -g pm2@5 \
 && npm cache clean --force

ENV NODE_ENV=production \
    PORT=3000 \
    TZ=Asia/Riyadh \
    PM2_HOME=/home/node/.pm2 \
    WEB_CONCURRENCY=2 \
    npm_config_update_notifier=false

WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

RUN <<'EOF' cat > /app/ecosystem.docker.config.cjs
module.exports = {
  apps: [
    {
      name: 'saaei-requests-api',
      script: './server.js',
      cwd: '/app',
      instances: process.env.WEB_CONCURRENCY || 'max',
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '20s',
      restart_delay: 3000,
      max_memory_restart: '512M',
      kill_timeout: 20000,
      listen_timeout: 10000,
      merge_logs: true,
      time: true,
      watch: false,
    },
    {
      name: 'saaei-requests-sync',
      script: './scripts/sync-requests.js',
      cwd: '/app',
      exec_mode: 'fork',
      instances: 1,
      autorestart: false,
      cron_restart: '0 */3 * * *',
      merge_logs: true,
      time: true,
      watch: false,
    },
  ],
};
EOF

RUN chown node:node /app/ecosystem.docker.config.cjs
RUN cp .env.example .env
USER node

#RUN cp .env.example .env

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["pm2-runtime", "start", "ecosystem.docker.config.cjs", "--env", "production"]
