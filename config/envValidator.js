const { z } = require('zod');
const logger = require('./logger'); 

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  
  MONGO_URI: z.string({
    required_error: "MONGO_URI is missing! Database connection will fail.",
  }).min(1),
  
  JWT_SECRET: z.string({
    required_error: "JWT_SECRET is missing! Token generation will fail.",
  }).min(10, "JWT_SECRET must be at least 10 characters long!"),

  // 🟢 FIXED: Admin credentials ko startup par hi validate kar liya
  ADMIN_USERNAME: z.string({
    required_error: "ADMIN_USERNAME is missing! Admin cannot log in.",
  }).min(1),

  ADMIN_PASSWORD: z.string({
    required_error: "ADMIN_PASSWORD is missing! Admin cannot log in.",
  }).min(1),
});

const validateEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    logger.error('FATAL ERROR: Environment variables are missing or invalid!');
    
    parsed.error.issues.forEach(issue => {
      logger.error(`${issue.path[0]}: ${issue.message}`);
    });

    process.exit(1); 
  }

  logger.info('✅ Environment variables successfully validated!');
};

module.exports = validateEnv;