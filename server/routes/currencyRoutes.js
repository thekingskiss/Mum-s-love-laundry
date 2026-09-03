const express = require('express');
const { listCurrencies } = require('../controllers/currencyController');

const router = express.Router();

router.get('/', listCurrencies);

module.exports = router;
