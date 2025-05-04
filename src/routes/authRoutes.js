const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/verify', authController.verifyEmail);
router.get('/me', authController.getMe);
router.get('/users', authMiddleware, authController.getAllUsers);
router.get('/google', authController.googleAuth);
router.get('/callback', authController.handleOAuthCallback);
router.post('/callback', authController.handleToken);
router.post('/reset-password', authController.requestPasswordReset);
router.put('/reset-password', authController.updatePassword);
router.get('/verify-recovery', authController.handlePasswordRecovery);

//-------------------------------Mine--------------------------------------------/

const caeController = require('../controllers/caeController');
router.get('/fetch-scoreboard', caeController.fetchScoreboard);
router.get('/fetch-initiative', caeController.fetchInitiative);
router.post('/add-initiative', caeController.addInitiative);
router.delete('/delete-initiative', caeController.deleteInitiative);
router.post('/edit-initiative', caeController.editInitiative);

//-------------------------------Mine--------------------------------------------/

module.exports = router;
