/**
 * 函数级详细中文注释：PM2 配置文件
 * - 生产环境进程管理
 * - 自动重启
 * - 日志管理
 */

module.exports = {
  apps: [{
    name: 'maker-relay',
    script: './src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }],
};

