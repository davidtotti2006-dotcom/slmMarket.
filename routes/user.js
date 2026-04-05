/**
 * SLM MARKET - Auth / User Routes
 * Placeholder — full implementation is in app.js (monolithic).
 * Refactor to use this file by extracting controllers from app.js.
 */

const express = require('express');
const router = express.Router();

// These routes are currently handled directly in app.js:
//   POST /api/v1/auth/register
//   POST /api/v1/auth/login
//   POST /api/v1/auth/logout
//   POST /api/v1/auth/refresh

// Future split-file structure:
/*
const AuthController = require('../controllers/auth.controller');
const { verifyToken }     = require('../middleware/auth');
const { validateRegister } = require('../middleware/validators');
const { authLimiter }     = require('../middleware/rateLimiter');

router.post('/register', authLimiter, validateRegister, AuthController.register);
router.post('/login',    authLimiter, AuthController.login);
router.post('/logout',   verifyToken, AuthController.logout);
router.post('/refresh',  AuthController.refreshToken);
router.get('/me',        verifyToken, AuthController.getProfile);
router.put('/me',        verifyToken, AuthController.updateProfile);
*/

module.exports = router;