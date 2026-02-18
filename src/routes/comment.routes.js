const express = require('express');
const router = express.Router({ mergeParams: true });
const { getComments, addComment, editComment, deleteComment } = require('../controllers/comment.controller');
const verifyToken = require('../middleware/auth.middleware');

router.use(verifyToken);

router.route('/:taskId/comments').get(getComments).post(addComment);
router.route('/:taskId/comments/:commentId').patch(editComment).delete(deleteComment);

module.exports = router;
