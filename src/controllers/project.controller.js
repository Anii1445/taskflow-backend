const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { success, error } = require('../utils/apiResponse');
const { logActivity } = require('../utils/activityLogger');

// @desc    Get all projects for current user
// @route   GET /api/projects
// @access  Private
const getProjects = async (req, res) => {
  const { status } = req.query;

  const filter = {
    $or: [{ owner: req.user._id }, { members: req.user._id }],
  };
  if (status) filter.status = status;

  const projects = await Project.find(filter)
    .populate('owner', 'name email avatar')
    .populate('members', 'name email avatar')
    .populate('taskCount')
    .sort({ updatedAt: -1 });

  return res.json(success('Projects fetched', { projects, count: projects.length }));
};

// @desc    Create project
// @route   POST /api/projects
// @access  Admin
const createProject = async (req, res) => {
  const { name, description, color } = req.body;

  if (!name) return res.status(400).json(error('Project name is required'));

  const project = await Project.create({
    name,
    description,
    color,
    owner: req.user._id,
    members: [req.user._id],
  });

  await project.populate('owner', 'name email avatar');
  await project.populate('members', 'name email avatar');

  await logActivity({
    projectId: project._id,
    userId: req.user._id,
    action: 'created_project',
    meta: { projectName: project.name },
  });

  return res.status(201).json(success('Project created', { project }));
};

// @desc    Get single project
// @route   GET /api/projects/:id
// @access  Private (member)
const getProject = async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate('owner', 'name email avatar')
    .populate('members', 'name email avatar')
    .populate('taskCount');

  if (!project) return res.status(404).json(error('Project not found'));

  const isMember =
    project.owner._id.toString() === req.user._id.toString() ||
    project.members.some((m) => m._id.toString() === req.user._id.toString());

  if (!isMember) return res.status(403).json(error('Access denied'));

  return res.json(success('Project fetched', { project }));
};

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Admin / Owner
const updateProject = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json(error('Project not found'));

  if (
    project.owner.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    return res.status(403).json(error('Only project owner or admin can update'));
  }

  const { name, description, color, status } = req.body;
  if (name) project.name = name;
  if (description !== undefined) project.description = description;
  if (color) project.color = color;
  if (status) project.status = status;

  await project.save();
  await project.populate('owner', 'name email avatar');
  await project.populate('members', 'name email avatar');

  await logActivity({
    projectId: project._id,
    userId: req.user._id,
    action: 'updated_project',
    meta: { projectName: project.name },
  });

  return res.json(success('Project updated', { project }));
};

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Admin / Owner
const deleteProject = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json(error('Project not found'));

  if (
    project.owner.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    return res.status(403).json(error('Only project owner or admin can delete'));
  }

  // Delete all tasks and activity logs
  await Promise.all([
    Task.deleteMany({ project: project._id }),
    ActivityLog.deleteMany({ project: project._id }),
    Project.findByIdAndDelete(project._id),
  ]);

  return res.json(success('Project deleted successfully'));
};

// @desc    Add member to project
// @route   POST /api/projects/:id/members
// @access  Admin / Owner
const addMember = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json(error('Member email is required'));

  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json(error('Project not found'));

  if (project.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json(error('Only project owner or admin can add members'));
  }

  const userToAdd = await User.findOne({ email: email.toLowerCase() });
  if (!userToAdd) return res.status(404).json(error('User with this email not found'));

  if (project.members.includes(userToAdd._id)) {
    return res.status(409).json(error('User is already a member'));
  }

  project.members.push(userToAdd._id);
  await project.save();
  await project.populate('members', 'name email avatar');

  await logActivity({
    projectId: project._id,
    userId: req.user._id,
    action: 'added_member',
    meta: { memberName: userToAdd.name, memberEmail: userToAdd.email },
  });

  return res.json(success('Member added successfully', { project }));
};

// @desc    Remove member from project
// @route   DELETE /api/projects/:id/members/:memberId
// @access  Admin / Owner
const removeMember = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json(error('Project not found'));

  if (project.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json(error('Only project owner or admin can remove members'));
  }

  if (project.owner.toString() === req.params.memberId) {
    return res.status(400).json(error('Cannot remove project owner'));
  }

  project.members = project.members.filter(
    (m) => m.toString() !== req.params.memberId
  );
  await project.save();
  await project.populate('members', 'name email avatar');

  await logActivity({
    projectId: project._id,
    userId: req.user._id,
    action: 'removed_member',
    meta: { removedUserId: req.params.memberId },
  });

  return res.json(success('Member removed', { project }));
};

// @desc    Get project activity log
// @route   GET /api/projects/:id/activity
// @access  Private (member)
const getActivity = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json(error('Project not found'));

  const [logs, total] = await Promise.all([
    ActivityLog.find({ project: req.params.id })
      .populate('user', 'name avatar')
      .populate('task', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    ActivityLog.countDocuments({ project: req.params.id }),
  ]);

  return res.json(
    success('Activity fetched', {
      logs,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    })
  );
};

module.exports = { getProjects, createProject, getProject, updateProject, deleteProject, addMember, removeMember, getActivity };
