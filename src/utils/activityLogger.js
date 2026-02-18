const ActivityLog = require('../models/ActivityLog');
const logger = require('./logger');

const logActivity = async ({ projectId, taskId = null, userId, action, meta = {} }) => {
  try {
    await ActivityLog.create({
      project: projectId,
      task: taskId,
      user: userId,
      action,
      meta,
    });
  } catch (err) {
    // Don't fail request if activity log fails
    logger.error(`Activity log error: ${err.message}`);
  }
};

module.exports = { logActivity };
