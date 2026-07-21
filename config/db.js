const mongoose = require('mongoose');
const logger = require('./logger'); // 🟢 NAYA: Apni Winston ki tijori import ki

const connectDB = async () => {
  try {
    // 🛡️ PRODUCTION DATABASE OPTIONS
    const dbOptions = {

      family: 4,
      // Development mein true (taaki naye rules apply hon), Production mein false (taaki DB freeze na ho)
      autoIndex: process.env.NODE_ENV !== 'production', 
      
      // Agar DB server na mile, toh 5 second (5000ms) baad fail ho jaye aur retry kare
      serverSelectionTimeoutMS: 5000, 
      
      // Agar connection inactive hai, toh 45 second baad socket band kare
      socketTimeoutMS: 45000, 
    };

    // Yahan 'await' lagana zaroori hai taaki jab tak connect na ho, aage na badhe
    const conn = await mongoose.connect(process.env.MONGO_URI, dbOptions);
    
    // console.log ki jagah ab logger use kar rahe hain
    logger.info(`✅ MongoDB Connected Successfully: ${conn.connection.host}`);

  } catch (err) {
    // 🔴 Wapas apne professional Winston logger ko duty par laga diya
    logger.error(`❌ MongoDB Connection Error: ${err.message}`);
    process.exit(1); 
  }
};

// ==========================================
// 🔄 FAIL-SAFE RECONNECTION LOGIC
// ==========================================

// Agar chalti app mein database ka connection achanak toot jaye
mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ MongoDB Disconnected! Connection drop ho gaya hai, hum retry kar rahe hain...');
});

// Agar connection achanak wapas aa jaye
mongoose.connection.on('reconnected', () => {
  logger.info('🔄 MongoDB Reconnected! Network wapas aa gaya, sab safe hai.');
});

// Agar database server se hi koi background error aa jaye
mongoose.connection.on('error', (err) => {
  logger.error(`🔥 MongoDB Runtime Error: ${err.message}`);
});

module.exports = connectDB;