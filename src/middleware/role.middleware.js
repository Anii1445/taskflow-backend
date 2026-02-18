const { error } = require('../utils/apiResponse');

// Require specific roles
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(error('Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json(error(`Access denied. Required role: ${roles.join(' or ')}`));
    }
    next();
  };
};

const requireAdmin = requireRole('admin');

module.exports = { requireRole, requireAdmin };
