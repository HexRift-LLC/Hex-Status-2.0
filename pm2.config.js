module.exports = {
  apps: [{
    name: "Hex-Status",
    script: "server.js",
    env: {
      NODE_ENV: "production",
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    out_file: "./logs/out.log",
    error_file: "./logs/error.log",
    merge_logs: true
  }]
};
