const express = require('express');
const router = express.Router();
const {
  getProjects, createProject, getProject,
  updateProject, deleteProject, addMember, removeMember, getActivity,
} = require('../controllers/project.controller');
const verifyToken = require('../middleware/auth.middleware');

router.use(verifyToken);

router.route('/').get(getProjects).post(createProject);
router.route('/:id').get(getProject).put(updateProject).delete(deleteProject);
router.post('/:id/members', addMember);
router.delete('/:id/members/:memberId', removeMember);
router.get('/:id/activity', getActivity);

module.exports = router;
