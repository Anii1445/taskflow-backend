const Comment = require('../models/Comment');
const Task = require('../models/Task');
const { success, error } = require('../utils/apiResponse');
const { logActivity } = require('../utils/activityLogger');

// @desc    Get comments for a task
// @route   GET /api/tasks/:taskId/comments
// @access  Private
const getComments = async (req, res) => {
  const { taskId } = req.params;
  const task = await Task.findById(taskId);
  if (!task) return res.status(404).json(error('Task not found'));

  const comments = await Comment.find({ task: taskId })
    .populate('author', 'name email avatar')
    .sort({ createdAt: 1 });

  return res.json(success('Comments fetched', { comments, count: comments.length }));
};

// @desc    Add comment to task
// @route   POST /api/tasks/:taskId/comments
// @access  Private
const addComment = async (req, res) => {
  const { taskId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json(error('Comment content is required'));
  }

  const task = await Task.findById(taskId);
  if (!task) return res.status(404).json(error('Task not found'));

  const comment = await Comment.create({
    content: content.trim(),
    task: taskId,
    author: req.user._id,
  });

  await comment.populate('author', 'name email avatar');

  await logActivity({
    projectId: task.project,
    taskId,
    userId: req.user._id,
    action: 'added_comment',
    meta: { taskTitle: task.title },
  });

  return res.status(201).json(success('Comment added', { comment }));
};

// @desc    Edit comment
// @route   PATCH /api/tasks/:taskId/comments/:commentId
// @access  Private (author only)
const editComment = async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json(error('Comment content is required'));
  }

  const comment = await Comment.findById(commentId);
  if (!comment) return res.status(404).json(error('Comment not found'));

  if (comment.author.toString() !== req.user._id.toString()) {
    return res.status(403).json(error('You can only edit your own comments'));
  }

  comment.content = content.trim();
  comment.isEdited = true;
  await comment.save();
  await comment.populate('author', 'name email avatar');

  return res.json(success('Comment updated', { comment }));
};

// @desc    Delete comment
// @route   DELETE /api/tasks/:taskId/comments/:commentId
// @access  Private (author or admin)
const deleteComment = async (req, res) => {
  const { commentId } = req.params;

  const comment = await Comment.findById(commentId);
  if (!comment) return res.status(404).json(error('Comment not found'));

  const isAuthor = comment.author.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isAuthor && !isAdmin) {
    return res.status(403).json(error('Not authorized to delete this comment'));
  }

  await Comment.findByIdAndDelete(commentId);

  return res.json(success('Comment deleted'));
};

module.exports = { getComments, addComment, editComment, deleteComment };
