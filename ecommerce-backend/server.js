const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();
const { connectRabbitMQ, sendToQueue, consumeFromQueue } = require('./rabbitmq.js');

const app = express();

// Configure PostgreSQL connection
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
});

// Enable CORS
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware to parse JSON bodies
app.use(express.json());

// Root route handler
app.get('/api', (req, res) => {
  res.send('Welcome to the backend server. Please use the /products endpoint to retrieve data.');
});

// Get products endpoint
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Connect to RabbitMQ and start consuming messages
connectRabbitMQ().then(() => {
  consumeFromQueue('product_queue', (message) => {
    // Handle the message
    console.log('Message processed:', message);
    // You can add additional logic here to handle the message
  });
});

app.post('/api/product_queue', async (req, res) => {
    const { product } = req.body;
    if (product) {
      try {
        await sendToQueue('product_queue', JSON.stringify(product));
        res.status(200).json({ message: 'Message sent to queue' });
      } catch (err) {
        console.error('Failed to send message to queue:', err);
        res.status(500).json({ message: 'Failed to send message' });
      }
    } else {
      res.status(400).json({ message: 'Product data is required' });
    }
  });
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
