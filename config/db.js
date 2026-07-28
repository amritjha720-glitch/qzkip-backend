const mongoose = require('mongoose');
const logger = require('./logger'); 

const connectDB = async () => {
  try {
    const dbOptions = {
      family: 4,
      autoIndex: process.env.NODE_ENV !== 'production', 
      serverSelectionTimeoutMS: 5000, 
      socketTimeoutMS: 45000, 
      maxPoolSize: 50 // 🟢 FIXED: Maximum 50 active connections allow karega taaki DB crash na ho
    };

    const conn = await mongoose.connect(process.env.MONGO_URI, dbOptions);
    logger.info(`✅ MongoDB Connected Successfully: ${conn.connection.host}`);

  } catch (err) {
    logger.error(`❌ MongoDB Connection Error: ${err.message}`);
    process.exit(1); 
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ MongoDB Disconnected! Connection drop ho gaya hai, hum retry kar rahe hain...');
});

mongoose.connection.on('reconnected', () => {
  logger.info('🔄 MongoDB Reconnected! Network wapas aa gaya, sab safe hai.');
});

mongoose.connection.on('error', (err) => {
  logger.error(`🔥 MongoDB Runtime Error: ${err.message}`);
});

module.exports = connectDB;