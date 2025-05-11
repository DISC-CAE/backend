const express = require('express');
const router = express.Router();
const caeController = require('../controllers/caeController');
const multer = require('multer');
const programPasswordController = require('../controllers/programPasswordController');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
    }
  },
});

//-------------------------------Mine--------------------------------------------/

router.get('/fetch-scoreboard', caeController.fetchScoreboard);
router.get('/fetch-initiative', caeController.fetchInitiative);
router.post(
  '/add-initiative',
  upload.single('image'),
  caeController.addInitiative
);
router.delete('/delete-initiative', caeController.deleteInitiative);
router.post(
  '/edit-initiative',
  upload.single('image'),
  caeController.editInitiative
);

//-------------------------------Mine--------------------------------------------/

router.post(
  '/set-program-password',
  programPasswordController.setProgramPassword
);
router.post('/program-login', programPasswordController.programLogin);

module.exports = router;
