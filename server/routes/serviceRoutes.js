const express = require('express');
const { listServices, updatePricing, setPromo } = require('../controllers/serviceController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const requireSuperAdmin = requireRole('super_admin');

router.get('/', listServices);
router.patch('/:id', requireAuth, requireSuperAdmin, updatePricing);
router.post('/:id/promo', requireAuth, requireSuperAdmin, setPromo);

module.exports = router;
