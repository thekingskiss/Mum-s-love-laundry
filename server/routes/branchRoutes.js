const express = require('express');
const { listBranches } = require('../controllers/branchController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Any authenticated user — the booking form and the staff branch switcher
// both need the list; admin CRUD lives under /api/admin/branches instead
// (mirrors zoneRoutes.js: public-ish list here, admin management there).
router.get('/', requireAuth, listBranches);

module.exports = router;
