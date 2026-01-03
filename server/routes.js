const express = require('express');
const router = express.Router();

// Mock Endpoint: In a real app, this would hide your API Key and fetch from Polygon/Bloomberg
router.get('/market-status', (req, res) => {
    res.json({
        status: 'OPEN',
        exchange: 'NASDAQ',
        timestamp: Date.now()
    });
});

module.exports = router;