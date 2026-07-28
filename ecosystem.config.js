module.exports = {
  apps: [{
    name: "Qzkip-backend",          // Name of your application
    script: "./server.js",               // Main entry file to execute
    watch: false,                        // Disable auto-restart on code changes in production
    max_memory_restart: "1G",            // Restart if server exceeds 1GB RAM to prevent hanging
    env_production: {
      NODE_ENV: "production",            // Indicates to PM2 that this is live production mode
      PORT: 5000
    }
  }]
}