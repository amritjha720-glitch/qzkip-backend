const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const sanitizeHtml = require('sanitize-html');
const compression = require('compression');
const mongoose = require('mongoose'); 
const logger = require('./config/logger'); 

// 🟢 FIX: Cookie Parser Added
const cookieParser = require('cookie-parser'); 

// Database, Env Validator, and Routes imports
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorMiddleware');
const validateEnv = require('./config/envValidator');
const adminRoutes = require('./routes/adminRoutes'); 

dotenv.config();

// Verify environment variables before startup
validateEnv(); 

const app = express();

// ==========================================
// LAYER 1: Core Security & Parsing
// ==========================================
app.use(helmet()); 

// 🟢 FIX: CORS Updated for Cookies (Credentials: true)
const allowedOrigins = ['http://localhost:3000', 'https://qzkip-frontend.vercel.app'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy error: Origin not allowed'));
    }
  },
  credentials: true, 
}));

app.use(compression());
app.use(express.json());
app.use(cookieParser());

// ==========================================
// LAYER 2: Data Sanitization
// ==========================================
app.use(mongoSanitize());

const cleanXSS = (req, res, next) => {
  if (req.body) {
    for (let key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeHtml(req.body[key]); 
      }
    }
  }
  next();
};
app.use(cleanXSS);

connectDB();

const server = http.createServer(app);

// ==========================================
// LAYER 3: Socket.io Setup (Real-time Engine)
// ==========================================
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'https://qzkip-frontend.vercel.app'], 
    methods: ["GET", "POST", "PATCH"],
    credentials: true 
  }
});

io.on('connection', (socket) => {
  console.log('New device connected! ID:', socket.id);
  socket.emit('me-server', "Hello! Real-time engine connected.");
  socket.on('disconnect', () => console.log('Device disconnected:', socket.id));
});

app.set('socketio', io);


// ==========================================
// LAYER 4: HYBRID RATE LIMITER
// ==========================================
const globalIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 200, 
  message: { 
    success: false, 
    message: 'Network is overloaded. Please try again later.' 
  }
});
app.use('/api/', globalIpLimiter); 


// ==========================================
// LAYER 5: Health Check Endpoint (Heartbeat)
// ==========================================
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Qzkip Server is running healthy!',
    uptime: `${Math.floor(process.uptime() / 60)} minutes`, 
    timestamp: new Date().toISOString()
  });
});


// ==========================================
// LAYER 6: API Routes (🟢 CLEANED UP)
// ==========================================
const authRoutes = require('./routes/authRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const queueRoutes = require('./routes/queueRoutesNew');
const menuRoutes = require('./routes/menuRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/admin', adminRoutes); 

app.use(errorHandler); 


// ==========================================
// LAYER 7: Server Boot & Graceful Shutdown
// ==========================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

const shutdownHandler = () => {
  logger.info('Received SIGTERM or SIGINT signal. Shutting down server gracefully...');

  server.close(() => {
    logger.info('HTTP Server closed. New API requests have been blocked.');

    mongoose.connection.close(false).then(() => {
      logger.info('MongoDB connection closed safely.');
      process.exit(0); 
    });
  });

  setTimeout(() => {
    logger.error('Graceful shutdown took too long. Forcing termination...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdownHandler); 
process.on('SIGINT', shutdownHandler);