const winston = require('winston');
const path = require('path');

// Set up Winston logger
const logger = winston.createLogger({
  level: 'info', // This is the default log level
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Appends timestamp to every log entry
    winston.format.errors({ stack: true }), // Captures the full error stack trace if available
    winston.format.json() // Saves data in JSON format for files
  ),
  transports: [
    // 1. Files mein save hoga (Paid server par internal backup ke liye accha hai)
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/combined.log') 
    }),
    
    // 2. 🟢 NAYA UPDATE: Console hamesha on rahega!
    // Isse Render ki black screen par 24x7 live logs dikhenge.
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), // Render dashboard aur VS Code par colors dikhayega
        winston.format.simple() // Padhne mein aasan (simple) format
      )
    })
  ]
});

module.exports = logger;