const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const { success, error } = require('../utils/apiResponse');

// @desc    Get all users (admin only)
// @route   GET /api/users
// @access  Admin
const getAllUsers = async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const skip = (page - 1) * limit;

  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
    User.countDocuments(filter),
  ]);

  return res.json(
    success('Users fetched', {
      users,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    })
  );
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private
const getUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json(error('User not found'));
  return res.json(success('User fetched', { user }));
};

// @desc    Update current user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  const { name } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) return res.status(404).json(error('User not found'));

  if (name) user.name = name;

  await user.save();
  return res.json(success('Profile updated', { user }));
};

// @desc    Upload avatar
// @route   POST /api/users/avatar
// @access  Private
const uploadAvatar = async (req, res) => {
  if (!req.file) return res.status(400).json(error('No file uploaded'));

  const user = await User.findById(req.user._id);

  // Delete old avatar from cloudinary
  if (user.avatarPublicId) {
    await cloudinary.uploader.destroy(user.avatarPublicId);
  }

  user.avatar = req.file.path;
  user.avatarPublicId = req.file.filename;
  await user.save();

  return res.json(success('Avatar uploaded', { user }));
};

// @desc    Change password
// @route   PUT /api/users/password
// @access  Private
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json(error('Both current and new password required'));
  }
  if (newPassword.length < 6) {
    return res.status(400).json(error('New password must be at least 6 characters'));
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    return res.status(401).json(error('Current password is incorrect'));
  }

  user.password = newPassword;
  await user.save();

  return res.json(success('Password changed successfully'));
};

module.exports = { getAllUsers, getUser, updateProfile, uploadAvatar, changePassword };
