const jwt = require('jsonwebtoken');
const Vendor = require('../models/Vendor');

// 1. Admin Login API
exports.adminLogin = (req, res) => {
  const { username, password } = req.body;

  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'Qzkip', { expiresIn: '1d' });
    return res.status(200).json({ success: true, message: 'Welcome, Admin!', token });
  }
  return res.status(401).json({ success: false, message: 'Invalid Username or Password!' });
};

// 2. Fetch pending AND rejected vendors (So admin can see who they rejected)
exports.getPendingVendors = async (req, res) => {
  try {
    // 🟢 FIXED: Ab admin ko wo bhi dikhenge jo naye hain (pending) aur jo galti kar chuke hain (rejected)
    const pendingVendors = await Vendor.find({ status: { $in: ['pending', 'rejected'] } }).select('-password');
    res.status(200).json({ success: true, count: pendingVendors.length, data: pendingVendors });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 3. API to approve a vendor
exports.approveVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    // 🟢 FIXED: is_verified ke sath 'status: approved' bhi set kar diya
    const vendor = await Vendor.findByIdAndUpdate(vendorId, { is_verified: true, status: 'approved' }, { new: true });
    
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.status(200).json({ success: true, message: `${vendor.shop_name} has been successfully approved!` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 4. API to REJECT a vendor (Soft Reject - Allows Re-apply)
exports.rejectVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    // 🟢 FIXED: Delete ki jagah ab update karega (Laal page dikhane ke liye)
    const vendor = await Vendor.findByIdAndUpdate(vendorId, { is_verified: false, status: 'rejected' }, { new: true });
    res.status(200).json({ success: true, message: `${vendor.shop_name} has been rejected. They can re-apply.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 5. API to DELETE a spammer (Hard Delete - Brahmastra 🗑️)
exports.deleteVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    await Vendor.findByIdAndDelete(vendorId);
    res.status(200).json({ success: true, message: 'Spammer permanently deleted from database.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};