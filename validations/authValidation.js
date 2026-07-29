const { z } = require('zod');

// 1. 🟢 Google Auth Check Validation (Optimized)
const googleAuthSchema = z.object({
  googleUID: z.string().trim().min(1, "Google UID is required"),
  email: z.string().trim().email("Please provide a valid email address"),
  name: z.string().trim().optional()
}).strict(); 

// 2. 🟢 KYC Profile Validation (Bulletproof)
const vendorProfileSchema = z.object({
  googleUID: z.string().trim().min(1, "Google UID is missing"),
  email: z.string().trim().email("Please provide a valid email address"),
  
  name: z.string().trim().max(100, "Name is too long").optional(),
  
  shop_name: z.string().trim().min(3, "Shop name must be at least 3 characters long").max(150, "Shop name is too long"),
  
  // 📍 🟢 NEW: Manual Address Validation added
  shop_address: z.string({
    required_error: "Shop address is required for verification"
  }).trim().min(10, "Please provide a complete shop address (at least 10 characters)").max(500, "Shop address is too long"),
  
  phone: z.string()
    .length(10, "Mobile number must be exactly 10 digits")
    .regex(/^[6-9]\d{9}$/, "Please provide a valid Indian mobile number"),
    
  document_type: z.enum(['PAN', 'GSTIN', 'Shop License', 'Other'], { message: "Please select a valid document type" }),
  
  document_number: z.string().trim().toUpperCase(), 
  
  shop_type: z.enum(['clinic', 'barber', 'cyber cafe'], { message: "Shop type must be either clinic, barber, or cyber cafe" }),

  // 📍 🟢 GPS Coordinates Validation
  lat: z.number({ invalid_type_error: "Latitude must be a number" }).min(-90).max(90).optional(),
  lng: z.number({ invalid_type_error: "Longitude must be a number" }).min(-180).max(180).optional()

}).strict().superRefine((data, ctx) => {
  
  // 📍 🟢 SECURITY FIX: The "Half Coordinate" Blocker
  if ((data.lat !== undefined && data.lng === undefined) || (data.lat === undefined && data.lng !== undefined)) {
    ctx.addIssue({ 
      code: z.ZodIssueCode.custom, 
      message: "Both Latitude and Longitude are required together, or neither." 
    });
  }

  // PAN Logic
  if (data.document_type === 'PAN') {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(data.document_number)) {
      ctx.addIssue({ path: ['document_number'], code: z.ZodIssueCode.custom, message: "Please provide a valid 10-digit PAN number (e.g., ABCDE1234F)" });
    }
  } 
  
  // GSTIN Logic
  else if (data.document_type === 'GSTIN') {
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstRegex.test(data.document_number)) {
      ctx.addIssue({ path: ['document_number'], code: z.ZodIssueCode.custom, message: "Please provide a valid 15-digit GSTIN number" });
    }
  } 
  
  // Shop License Logic
  else if (data.document_type === 'Shop License') {
    const shopRegex = /^[a-zA-Z0-9-\/]+$/;
    if (data.document_number.length < 5 || data.document_number.length > 25 || !shopRegex.test(data.document_number)) {
      ctx.addIssue({ path: ['document_number'], code: z.ZodIssueCode.custom, message: "Please provide a valid Shop License number" });
    }
  } 
  
  // Other Logic
  else if (data.document_type === 'Other') {
    if (data.document_number.length < 3 || data.document_number.length > 30) {
      ctx.addIssue({ path: ['document_number'], code: z.ZodIssueCode.custom, message: "Document number must be between 3 and 30 characters" });
    }
  }
});

// Middlewares
const validateGoogleAuth = (req, res, next) => {
  const result = googleAuthSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ 
      success: false, 
      message: "Validation Failed", 
      errors: result.error.issues.map(err => err.message) 
    });
  }
  req.body = result.data; 
  next();
};

const validateVendorProfile = (req, res, next) => {
  const result = vendorProfileSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ 
      success: false, 
      message: "Validation Failed", 
      errors: result.error.issues.map(err => err.message) 
    });
  }
  req.body = result.data;
  next();
};

module.exports = { validateGoogleAuth, validateVendorProfile };