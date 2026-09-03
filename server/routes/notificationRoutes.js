const express = require('express');
const { listNotifications, markRead } = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listNotifications);
router.patch('/:id/read', requireAuth, markRead);

module.exports = router;
