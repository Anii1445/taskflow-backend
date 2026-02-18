const Task = require('../models/Task');
const Project = require('../models/Project');
const Comment = require('../models/Comment');
const cloudinary = require('../config/cloudinary');
const { success, error } = require('../utils/apiResponse');
const { logActivity } = require('../utils/activityLogger');

// Helper: check project membership
const checkProjectAccess = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) return null;
  const isMember =
    project.owner.toString() === userId.toString() ||
    project.members.some((m) => m.toString() === userId.toString());
  return isMember ? project : false;
};

// @desc    Get all tasks for a project
// @route   GET /api/projects/:projectId/tasks
// @access  Private (member)
const getTasks = async (req, res) => {
  const { projectId } = req.params;
  const { status, priority, assignee, search, page = 1, limit = 50, sort = 'order' } = req.query;

  const project = await checkProjectAccess(projectId, req.user._id);
  if (project === null) return res.status(404).json(error('Project not found'));
  if (project === false) return res.status(403).json(error('Access denied'));

  const filter = { project: projectId };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (assignee) filter.assignee = assignee;
  if (search) filter.title = { $regex: search, $options: 'i' };

  const sortMap = {
    order: { order: 1 },
    '-createdAt': { createdAt: -1 },
    createdAt: { createdAt: 1 },
    dueDate: { dueDate: 1 },
    priority: { priority: -1 },
  };

  const skip = (page - 1) * limit;
  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .populate('assignee', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .populate('commentCount')
      .sort(sortMap[sort] || { order: 1 })
      .skip(skip)
      .limit(Number(limit)),
    Task.countDocuments(filter),
  ]);

  return res.json(
    success('Tasks fetched', {
      tasks,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    })
  );
};

// @desc    Create task
// @route   POST /api/projects/:projectId/tasks
// @access  Private (member)
const createTask = async (req, res) => {
  const { projectId } = req.params;

  const project = await checkProjectAccess(projectId, req.user._id);
  if (project === null) return res.status(404).json(error('Project not found'));
  if (project === false) return res.status(403).json(error('Access denied'));

  const { title, description, assignee, priority, dueDate, labels, status } = req.body;
  if (!title) return res.status(400).json(error('Task title is required'));

  // Get max order in this status column
  const maxOrderTask = await Task.findOne({ project: projectId, status: status || 'todo' })
    .sort({ order: -1 })
    .select('order');
  const order = maxOrderTask ? maxOrderTask.order + 1 : 0;

  const task = await Task.create({
    title,
    description,
    project: projectId,
    assignee: assignee || null,
    createdBy: req.user._id,
    priority: priority || 'medium',
    dueDate: dueDate || null,
    labels: labels || [],
    status: status || 'todo',
    order,
  });

  await task.populate('assignee', 'name email avatar');
  await task.populate('createdBy', 'name email avatar');

  await logActivity({
    projectId,
    taskId: task._id,
    userId: req.user._id,
    action: 'created_task',
    meta: { taskTitle: task.title },
  });

  return res.status(201).json(success('Task created', { task }));
};

// @desc    Get single task with comments and activity
// @route   GET /api/projects/:projectId/tasks/:taskId
// @access  Private (member)
const getTask = async (req, res) => {
  const { projectId, taskId } = req.params;

  const project = await checkProjectAccess(projectId, req.user._id);
  if (project === null) return res.status(404).json(error('Project not found'));
  if (project === false) return res.status(403).json(error('Access denied'));

  const task = await Task.findOne({ _id: taskId, project: projectId })
    .populate('assignee', 'name email avatar')
    .populate('createdBy', 'name email avatar')
    .populate('attachments.uploadedBy', 'name');

  if (!task) return res.status(404).json(error('Task not found'));

  const comments = await Comment.find({ task: taskId })
    .populate('author', 'name email avatar')
    .sort({ createdAt: 1 });

  return res.json(success('Task fetched', { task, comments }));
};

// @desc    Update task
// @route   PATCH /api/projects/:projectId/tasks/:taskId
// @access  Private (member)
const updateTask = async (req, res) => {
  const { projectId, taskId } = req.params;

  const project = await checkProjectAccess(projectId, req.user._id);
  if (project === null) return res.status(404).json(error('Project not found'));
  if (project === false) return res.status(403).json(error('Access denied'));

  const task = await Task.findOne({ _id: taskId, project: projectId });
  if (!task) return res.status(404).json(error('Task not found'));

  const { title, description, assignee, priority, dueDate, labels, status, order } = req.body;

  const oldStatus = task.status;

  if (title !== undefined) task.title = title;
  if (description !== undefined) task.description = description;
  if (assignee !== undefined) task.assignee = assignee || null;
  if (priority !== undefined) task.priority = priority;
  if (dueDate !== undefined) task.dueDate = dueDate || null;
  if (labels !== undefined) task.labels = labels;
  if (status !== undefined) task.status = status;
  if (order !== undefined) task.order = order;

  await task.save();
  await task.populate('assignee', 'name email avatar');
  await task.populate('createdBy', 'name email avatar');

  if (status && status !== oldStatus) {
    await logActivity({
      projectId,
      taskId: task._id,
      userId: req.user._id,
      action: 'changed_status',
      meta: { taskTitle: task.title, from: oldStatus, to: status },
    });
  } else {
    await logActivity({
      projectId,
      taskId: task._id,
      userId: req.user._id,
      action: 'updated_task',
      meta: { taskTitle: task.title },
    });
  }

  return res.json(success('Task updated', { task }));
};

// @desc    Bulk update task orders (for drag and drop)
// @route   PATCH /api/projects/:projectId/tasks/reorder
// @access  Private (member)
const reorderTasks = async (req, res) => {
  const { projectId } = req.params;
  const { tasks } = req.body; // Array of { _id, status, order }

  const project = await checkProjectAccess(projectId, req.user._id);
  if (project === null) return res.status(404).json(error('Project not found'));
  if (project === false) return res.status(403).json(error('Access denied'));

  if (!Array.isArray(tasks)) return res.status(400).json(error('tasks must be an array'));

  const bulkOps = tasks.map(({ _id, status, order }) => ({
    updateOne: {
      filter: { _id, project: projectId },
      update: { $set: { status, order } },
    },
  }));

  await Task.bulkWrite(bulkOps);

  return res.json(success('Tasks reordered'));
};

// @desc    Delete task
// @route   DELETE /api/projects/:projectId/tasks/:taskId
// @access  Admin / Owner / Task Creator
const deleteTask = async (req, res) => {
  const { projectId, taskId } = req.params;

  const project = await checkProjectAccess(projectId, req.user._id);
  if (project === null) return res.status(404).json(error('Project not found'));
  if (project === false) return res.status(403).json(error('Access denied'));

  const task = await Task.findOne({ _id: taskId, project: projectId });
  if (!task) return res.status(404).json(error('Task not found'));

  const canDelete =
    req.user.role === 'admin' ||
    project.owner.toString() === req.user._id.toString() ||
    task.createdBy.toString() === req.user._id.toString();

  if (!canDelete) return res.status(403).json(error('Not authorized to delete this task'));

  // Delete attachments from cloudinary
  for (const attachment of task.attachments) {
    if (attachment.publicId) {
      await cloudinary.uploader.destroy(attachment.publicId);
    }
  }

  await Promise.all([
    Comment.deleteMany({ task: taskId }),
    Task.findByIdAndDelete(taskId),
  ]);

  await logActivity({
    projectId,
    userId: req.user._id,
    action: 'deleted_task',
    meta: { taskTitle: task.title },
  });

  return res.json(success('Task deleted'));
};

// @desc    Upload file to task
// @route   POST /api/projects/:projectId/tasks/:taskId/upload
// @access  Private (member)
const uploadTaskFile = async (req, res) => {
  const { projectId, taskId } = req.params;

  if (!req.file) return res.status(400).json(error('No file uploaded'));

  const project = await checkProjectAccess(projectId, req.user._id);
  if (project === null) return res.status(404).json(error('Project not found'));
  if (project === false) return res.status(403).json(error('Access denied'));

  const task = await Task.findOne({ _id: taskId, project: projectId });
  if (!task) return res.status(404).json(error('Task not found'));

  const attachment = {
    url: req.file.path,
    publicId: req.file.filename,
    name: req.file.originalname,
    size: req.file.size,
    type: req.file.mimetype,
    uploadedBy: req.user._id,
  };

  task.attachments.push(attachment);
  await task.save();

  await logActivity({
    projectId,
    taskId: task._id,
    userId: req.user._id,
    action: 'uploaded_file',
    meta: { taskTitle: task.title, fileName: req.file.originalname },
  });

  return res.json(success('File uploaded', { attachment }));
};

// @desc    Delete file from task
// @route   DELETE /api/projects/:projectId/tasks/:taskId/attachments/:attachmentId
// @access  Private
const deleteTaskFile = async (req, res) => {
  const { projectId, taskId, attachmentId } = req.params;

  const task = await Task.findOne({ _id: taskId, project: projectId });
  if (!task) return res.status(404).json(error('Task not found'));

  const attachment = task.attachments.id(attachmentId);
  if (!attachment) return res.status(404).json(error('Attachment not found'));

  if (attachment.publicId) {
    await cloudinary.uploader.destroy(attachment.publicId);
  }

  task.attachments.pull(attachmentId);
  await task.save();

  return res.json(success('Attachment deleted'));
};

module.exports = { getTasks, createTask, getTask, updateTask, reorderTasks, deleteTask, uploadTaskFile, deleteTaskFile };
