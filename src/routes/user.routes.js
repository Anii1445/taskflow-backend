const express = require('express');
const router = express.Router();
const { getAllUsers, getUser, updateProfile, uploadAvatar, changePassword } = require('../controllers/user.controller');
const verifyToken = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/role.middleware');
const { uploadAvatar: uploadAvatarMiddleware } = require('../middleware/upload.middleware');

router.use(verifyToken);

router.get('/', requireAdmin, getAllUsers);
router.get('/:id', getUser);
router.put('/profile', updateProfile);
router.post('/avatar', uploadAvatarMiddleware, uploadAvatar);
router.put('/password', changePassword);

module.exports = router;
