'use strict';

const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Preview a video script without saving
router.post('/preview', videoController.generateVideoScriptPreview);

// Generate and attach a video to an existing post
router.post('/posts/:id/generate', videoController.generateVideoForPost);

module.exports = router;
