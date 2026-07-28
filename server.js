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
const cookieParser = require('cookie-parser'); 

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorMiddleware');
const validateEnv = require('./config/envValidator');

dotenv.config();

// Verify environment variables before startup
validateEnv(); 

const app = express();

// ==========================================
// LAYER 1: Core Security & Parsing
// ==========================================
// 🟢 CRITICAL DEPLOYMENT FIX: Allow Express to read real user IPs behind Render/AWS Proxies
app.set('trust proxy', 1);

app.use(helmet()); 

// 🟢 FIXED: Explicitly defined methods to prevent PATCH/DELETE blocks in strict browsers
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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));

app.use(compression());

// 🟢 SECURITY FIX: Limit payload size to 50kb to prevent DoS attacks
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' })); 
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
// 🟢 OPTIMIZED: Mobile network drops handle karne ke liye ping settings update ki
const io = new Server(server, {
  cors: {
    origin: allowedOrigins, 
    methods: ["GET", "POST", "PATCH"],
    credentials: true 
  },
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000 // 25 seconds
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
// LAYER 6: API Routes
// ==========================================
const authRoutes = require('./routes/authRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const queueRoutes = require('./routes/queueRoutesNew');
const menuRoutes = require('./routes/menuRoutes');
const adminRoutes = require('./routes/adminRoutes'); 

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

  server.close(async () => {
    logger.info('HTTP Server closed. New API requests have been blocked.');
    try {
      await mongoose.connection.close(false); // 🟢 FIXED: properly awaited the promise
      logger.info('MongoDB connection closed safely.');
      process.exit(0); 
    } catch (err) {
      logger.error('Error during MongoDB disconnect:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Graceful shutdown took too long. Forcing termination...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdownHandler); 
process.on('SIGINT', shutdownHandler);