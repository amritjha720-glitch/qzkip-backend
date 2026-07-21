const logger = require('../config/logger'); // NEW: Imported the Winston logger utility

const errorHandler = (err, req, res, next) => {
  // If no statusCode is set in the error, default to 500 (Internal Server Error)
  const statusCode = err.statusCode || 500;
  const message = err.message || 'An internal server error occurred!';

  // CORE LOGIC: Instead of console.log, Winston will now save the complete error details to the log file
  logger.error({
    message: message,
    stack: err.stack,
    url: req.originalUrl || req.url, // The API endpoint where the error occurred
    method: req.method,              // The HTTP method (GET, POST, etc.)
    ip: req.ip                       // The IP address of the user who made the request
  });

  res.status(statusCode).json({
    success: false,
    message: message,
    // CRITICAL PRODUCTION STEP:
    // Show error details (stack trace) only if the environment is 'development', 
    // keep it NULL in production to prevent security leaks!
    stack: process.env.NODE_ENV === 'development' ? err.stack : null
  });
};

module.exports = errorHandler;