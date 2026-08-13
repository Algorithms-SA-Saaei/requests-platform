// إعداد PM2 (§36، §37) — إعادة تشغيل تلقائية، عدة عمّال، إطفاء رشيق، وإدارة سجلّات
// التشغيل: pm2 start ecosystem.config.cjs --env production && pm2 save && pm2 startup
// المسارات افتراضها الإنتاج، وتُبدَّل بمتغيّرات بيئة للاختبار المحلي:
//   APP_DIR=$(pwd) LOG_DIR=./logs npx pm2 start ecosystem.config.cjs
const APP_DIR = process.env.APP_DIR || '/var/www/saaei-requests';
const LOG_DIR = process.env.LOG_DIR || '/var/log/saaei-requests';

module.exports = {
  apps: [
    {
      name: 'saaei-requests-api',
      script: './server.js',
      cwd: APP_DIR,

      // عامل لكل نواة (§37). التطبيق عديم الحالة فلا مشكلة في تعدّد العمّال:
      // الجلسات JWT، والحالة الوحيدة في الذاكرة هي كاش البيانات المرجعية (لكل عامل كاشه — مقبول،
      // ويُنقل إلى Redis عند التوسّع لعدة خوادم §54).
      instances: 'max',
      exec_mode: 'cluster',

      env_production: { NODE_ENV: 'production' },

      // إعادة التشغيل: تلقائية عند الانهيار، مع كبح التكرار السريع
      autorestart: true,
      max_restarts: 10,
      min_uptime: '20s',
      restart_delay: 3000,
      max_memory_restart: '512M', // حارس تسرّب الذاكرة (§62)

      // إطفاء رشيق: PM2 يرسل SIGINT وينتظر إنهاء الطلبات الجارية (§52)
      kill_timeout: 20000,
      listen_timeout: 10000,
      wait_ready: false,

      // السجلّات — التدوير عبر pm2-logrotate (انظر setup-vps.sh)
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: `${LOG_DIR}/error.log`,
      out_file: `${LOG_DIR}/out.log`,
      merge_logs: true,

      watch: false, // ممنوع في الإنتاج
    },
  ],
};
