const User = require('../models/User');
const { generateAccessToken, generateRefreshToken } = require('../utils/generateTokens');
const { success, error } = require('../utils/apiResponse');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('admin', 'member').default('member'),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  const { error: validationError, value } = registerSchema.validate(req.body);
  if (validationError) {
    return res.status(400).json(error(validationError.details[0].message));
  }

  const { name, email, password, role } = value;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json(error('Email already registered'));
  }

  const user = await User.create({ name, email, password, role });

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return res.status(201).json(
    success('Registration successful', {
      user,
      accessToken,
      refreshToken,
    })
  );
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  const { error: validationError, value } = loginSchema.validate(req.body);
  if (validationError) {
    return res.status(400).json(error(validationError.details[0].message));
  }

  const { email, password } = value;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json(error('Invalid email or password'));
  }

  if (!user.isActive) {
    return res.status(403).json(error('Account has been deactivated'));
  }

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const userObj = user.toJSON();

  return res.json(success('Login successful', { user: userObj, accessToken, refreshToken }));
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json(error('Refresh token required'));
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(403).json(error('Invalid or expired refresh token'));
  }

  const user = await User.findById(decoded.userId).select('+refreshToken');
  if (!user || user.refreshToken !== refreshToken) {
    return res.status(403).json(error('Refresh token mismatch'));
  }

  const newAccessToken = generateAccessToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);

  user.refreshToken = newRefreshToken;
  await user.save({ validateBeforeSave: false });

  return res.json(success('Tokens refreshed', { accessToken: newAccessToken, refreshToken: newRefreshToken }));
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user) {
    user.refreshToken = null;
    await user.save({ validateBeforeSave: false });
  }
  return res.json(success('Logged out successfully'));
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  const user = await User.findById(req.user._id);
  return res.json(success('User fetched', { user }));
};

module.exports = { register, login, refresh, logout, getMe };
