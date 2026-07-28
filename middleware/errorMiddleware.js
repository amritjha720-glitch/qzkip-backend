const logger = require('../config/logger'); 

const errorHandler = (err, req, res, next) => {
  // 1. 🟢 CRITICAL SAFETY: Agar headers pehle hi send ho chuke hain, toh default Express handler ko pass kar do
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || 'An internal server error occurred!';

  // 2. 🟢 SMART MONGOOSE ERROR HANDLING

  // A. Bad/Invalid Mongoose ObjectId (CastError)
  if (err.name === 'CastError') {
    message = `Resource not found. Invalid: ${err.path}`;
    statusCode = 404; // Not Found
  }

  // B. Mongoose Duplicate Key (Error 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate field value entered for '${field}'. Please use another value.`;
    statusCode = 400; // Bad Request
  }

  // C. Mongoose Validation Error (Missing fields, wrong data type)
  if (err.name === 'ValidationError') {
    message = Object.values(err.errors).map(val => val.message).join(', ');
    statusCode = 400; // Bad Request
  }

  // D. JWT Errors (Agar token middleware ke bahar throw hue)
  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid session token. Please log in again.';
    statusCode = 401; // Unauthorized
  }
  if (err.name === 'TokenExpiredError') {
    message = 'Your session has expired. Please log in again.';
    statusCode = 401; // Unauthorized
  }

  // 3. 🟢 STRUCTURED WINSTON LOGGING
  // Server error (500) aane par hi stack trace log karenge taaki log file kachra na bane
  if (statusCode >= 500) {
    logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, {
      stack: err.stack
    });
  } else {
    logger.warn(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  }

  // 4. Send Response to Frontend
  res.status(statusCode).json({
    success: false,
    message: message,
    // Production mein stack trace hide rahega
    stack: process.env.NODE_ENV === 'development' ? err.stack : null
  });
};

module.exports = errorHandler;