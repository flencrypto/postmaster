'use strict';

const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/', postController.createPost);
router.post('/generate', postController.generateAndSchedule);
router.get('/', postController.listPosts);
router.get('/:id', postController.getPost);
router.put('/:id/approve', postController.approvePost);
router.post('/:id/publish', postController.publishNow);

module.exports = router;
