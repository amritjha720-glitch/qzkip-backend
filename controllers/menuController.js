const Menu = require('../models/Menu');
const Vendor = require('../models/Vendor');

exports.updateMenu = async (req, res) => {
  try {
    const { items } = req.body;
    const vendorId = req.vendor.vendorId;

    let menu = await Menu.findOne({ vendor_id: vendorId });

    if (menu) {
      menu.items = items; 
      await menu.save();
    } else {
      menu = new Menu({ vendor_id: vendorId, items });
      await menu.save();
    }

    res.json({ success: true, message: 'Menu updated successfully!', data: menu });
  } catch (error) {
    console.error('Menu Update Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getMenu = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ qr_id: req.params.qr_id });
    if (!vendor) return res.status(404).json({ success: false, message: 'Shop not found' });

    const menu = await Menu.findOne({ vendor_id: vendor._id });
    
    res.json({ 
      success: true, 
      shop_name: vendor.shop_name, 
      is_shop_open: vendor.is_open, 
      menu: menu ? menu.items : [] 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.toggleItem = async (req, res) => {
  try {
    const { item_id } = req.body; 
    const vendorId = req.vendor.vendorId;

    const menu = await Menu.findOne({ vendor_id: vendorId });
    if (!menu) return res.status(404).json({ success: false, message: 'Menu not found' });

    const item = menu.items.id(item_id); 
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    item.is_available = !item.is_available;
    await menu.save();

    res.json({ 
      success: true, 
      message: `${item.name} is now ${item.is_available ? 'Available' : 'Sold Out'}!`,
      is_available: item.is_available 
    });
  } catch (error) {
    console.error('Item Toggle Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};