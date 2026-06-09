module.exports = {
  apps: [
    {
      name: 'werewolf-server',
      script: 'packages/server/dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '512M',
      error_file: './logs/werewolf-error.log',
      out_file: './logs/werewolf-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
