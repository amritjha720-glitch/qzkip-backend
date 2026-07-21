const { z } = require('zod');
const logger = require('./logger'); // Utilizing the Winston logger here as well

// Defined the Zod schema (validation rules)
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  
  // The following keys are strictly required
  MONGO_URI: z.string({
    required_error: "MONGO_URI is missing! Database connection will fail.",
  }).min(1),
  
  JWT_SECRET: z.string({
    required_error: "JWT_SECRET is missing! Token generation will fail.",
  }).min(10, "JWT_SECRET must be at least 10 characters long!"),
});

const validateEnv = () => {
  // Validate process.env using the Zod schema
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    logger.error('FATAL ERROR: Environment variables are missing or invalid!');
    
    // Log each missing or invalid key error
    parsed.error.issues.forEach(issue => {
      logger.error(`${issue.path[0]}: ${issue.message}`);
    });

    // Immediately terminate the server process
    process.exit(1); 
  }

  logger.info('Environment variables successfully validated!');
};

module.exports = validateEnv;