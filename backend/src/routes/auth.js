'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

router.get('/threads', authController.initiateOAuth);
router.get('/threads/callback', authController.handleCallback);
router.post('/refresh', authMiddleware, authController.refreshToken);
router.get('/profile', authMiddleware, authController.getProfile);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
