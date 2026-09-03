const express = require('express');
const { listServices, updatePricing, setPromo } = require('../controllers/serviceController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', listServices);
router.patch('/:id', requireAuth, requireAdmin, updatePricing);
router.post('/:id/promo', requireAuth, requireAdmin, setPromo);

module.exports = router;
