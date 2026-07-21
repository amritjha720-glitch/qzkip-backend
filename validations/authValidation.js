const { z } = require('zod');

// 1. Google Auth Check Validation
const googleAuthSchema = z.object({
  googleUID: z.string().min(1, "Google UID is required"),
  email: z.string().email("Please provide a valid email address"),
  name: z.string().optional()
});

// 2. KYC Profile Validation
const vendorProfileSchema = z.object({
  googleUID: z.string().min(1, "Google UID is missing"),
  email: z.string().email("Please provide a valid email address"),
  name: z.string().optional(),
  
  shop_name: z.string().min(3, "Shop name must be at least 3 characters long"),
  phone: z.string().length(10, "Mobile number must be exactly 10 digits").regex(/^[0-9]+$/, "Number must contain only digits"),
  document_type: z.enum(['PAN', 'GSTIN', 'Shop License', 'Other'], { message: "Please select a valid document type" }),
  
  // Transform to UpperCase
  document_number: z.string().toUpperCase(), 
  
  shop_type: z.enum(['clinic', 'barber', 'cyber cafe'], { message: "Shop type must be either clinic, barber, or cyber cafe" })
}).superRefine((data, ctx) => {
  if (data.document_type === 'PAN') {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(data.document_number)) {
      ctx.addIssue({ path: ['document_number'], code: z.ZodIssueCode.custom, message: "Please provide a valid 10-digit PAN number (e.g., ABCDE1234F)" });
    }
  } else if (data.document_type === 'GSTIN') {
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstRegex.test(data.document_number)) {
      ctx.addIssue({ path: ['document_number'], code: z.ZodIssueCode.custom, message: "Please provide a valid 15-digit GSTIN number" });
    }
  } else if (data.document_type === 'Shop License') {
    const shopRegex = /^[a-zA-Z0-9-\/]+$/;
    if (data.document_number.length < 5 || data.document_number.length > 25 || !shopRegex.test(data.document_number)) {
      ctx.addIssue({ path: ['document_number'], code: z.ZodIssueCode.custom, message: "Please provide a valid Shop License number" });
    }
  }
});

// Middlewares
const validateGoogleAuth = (req, res, next) => {
  const result = googleAuthSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ success: false, message: "Validation Failed", errors: result.error.issues.map(err => err.message) });
  next();
};

const validateVendorProfile = (req, res, next) => {
  const result = vendorProfileSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ success: false, message: "Validation Failed", errors: result.error.issues.map(err => err.message) });
  req.body = result.data;
  next();
};

module.exports = { validateGoogleAuth, validateVendorProfile };