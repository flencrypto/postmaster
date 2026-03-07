'use strict';

const express = require('express');
const router = express.Router();
const grokController = require('../controllers/grokController');
const authMiddleware = require('../middleware/auth');

router.post('/generate', authMiddleware, grokController.generateContent);

module.exports = router;
