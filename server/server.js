const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve Static Files (The Frontend)
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
const routes = require('./routes');
app.use('/api', routes);

// Fallback to index.html for Single Page App feel
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
    console.log(`NOVA Server running on http://localhost:${PORT}`);
});