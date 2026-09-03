const express = require('express');
const { listItems } = require('../controllers/itemController');

const router = express.Router();

router.get('/', listItems);

module.exports = router;
