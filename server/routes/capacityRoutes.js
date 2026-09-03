const express = require('express');
const { checkCapacity } = require('../controllers/capacityController');

const router = express.Router();

router.get('/check', checkCapacity);

module.exports = router;
