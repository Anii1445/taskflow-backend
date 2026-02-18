const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'created_project',
        'updated_project',
        'created_task',
        'updated_task',
        'deleted_task',
        'changed_status',
        'assigned_task',
        'added_comment',
        'uploaded_file',
        'added_member',
        'removed_member',
      ],
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

activityLogSchema.index({ project: 1, createdAt: -1 });
activityLogSchema.index({ task: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
