const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  getTasks, createTask, getTask, updateTask,
  reorderTasks, deleteTask, uploadTaskFile, deleteTaskFile,
} = require('../controllers/task.controller');
const verifyToken = require('../middleware/auth.middleware');
const { uploadTaskFile: uploadTaskFileMiddleware } = require('../middleware/upload.middleware');

router.use(verifyToken);

router.route('/:projectId/tasks')
  .get(getTasks)
  .post(createTask);

router.patch('/:projectId/tasks/reorder', reorderTasks);

router.route('/:projectId/tasks/:taskId')
  .get(getTask)
  .patch(updateTask)
  .delete(deleteTask);

router.post('/:projectId/tasks/:taskId/upload', uploadTaskFileMiddleware, uploadTaskFile);
router.delete('/:projectId/tasks/:taskId/attachments/:attachmentId', deleteTaskFile);

module.exports = router;
