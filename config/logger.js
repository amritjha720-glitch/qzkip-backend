const winston = require('winston');
const path = require('path');

// Set up Winston logger
const logger = winston.createLogger({
  level: 'info', // This is the default log level
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Appends timestamp to every log entry
    winston.format.errors({ stack: true }), // Captures the full error stack trace if available
    winston.format.json() // Saves data in JSON format for easier parsing in production
  ),
  transports: [
    // 1. All CRITICAL ERRORS will be routed to this file
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/error.log'), 
      level: 'error' 
    }),
    // 2. All standard logs (info, warn, error) will be routed to this file
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/combined.log') 
    })
  ]
});

// IF THE SERVER IS RUNNING LOCALLY (Development Mode)
// Logs should also be displayed in the terminal with color formatting
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(), // Displays colored output (red, green, yellow) in the terminal
      winston.format.simple() // Simple and readable format
    )
  }));
}

module.exports = logger;