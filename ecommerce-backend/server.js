// Import necessary packages
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const redis = require('redis');
require('dotenv').config();
const { connectRabbitMQ, sendToQueue, consumeFromQueue, getMessagesFromQueue } = require('./rabbitmq.js');

// Initialize the Express application
const app = express();

// Configure PostgreSQL connection
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
});

// Configure Redis client
const redisClient = redis.createClient({
  host: 'redis',
  port: 6379,
});

redisClient.on('error', (err) => {
  console.error('Failed to connect to Redis:', err);
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

// Get products endpoint with Redis caching
app.get('/api/products', async (req, res) => {
    try {
      redisClient.get('products', async (err, cachedProducts) => {
        if (err) throw err;
  
        if (cachedProducts) {
          console.log('Cache hit');
          res.json({
            products: JSON.parse(cachedProducts),
            cacheStatus: 'hit'
          });
        } else {
          console.log('Cache miss');
          const result = await pool.query('SELECT * FROM products');
          const products = result.rows;
  
          // Store result in Redis cache with expiration time of 60 seconds
          redisClient.setex('products', 60, JSON.stringify(products));
  
          res.json({
            products: products,
            cacheStatus: 'miss'
          });
        }
      });
    } catch (err) {
      console.error('Failed to fetch products:', err);
      res.status(500).send('Server error');
    }
  });
  
// Add product and invalidate Redis cache, send to RabbitMQ
app.post('/api/products', async (req, res) => {
  const { name, price } = req.body;

  if (!name || !price) {
    return res.status(400).json({ message: 'Product name and price are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO products (name, price) VALUES ($1, $2) RETURNING *',
      [name, price]
    );

    // Invalidate Redis cache
    redisClient.del('products');

    // Send the new product to RabbitMQ queue
    await sendToQueue('product_queue', JSON.stringify({ action: 'add', product: result.rows[0] }));

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Failed to add product:', err);
    res.status(500).json({ message: 'Failed to add product' });
  }
});

// Update product and invalidate Redis cache, send to RabbitMQ
app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, price } = req.body;

  if (!name || !price) {
    return res.status(400).json({ message: 'Product name and price are required' });
  }

  try {
    const result = await pool.query(
      'UPDATE products SET name = $1, price = $2 WHERE id = $3 RETURNING *',
      [name, price, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Invalidate Redis cache
    redisClient.del('products');

    // Send the updated product to RabbitMQ queue
    await sendToQueue('product_queue', JSON.stringify({ action: 'update', product: result.rows[0] }));

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update product:', err);
    res.status(500).json({ message: 'Failed to update product' });
  }
});

// Delete product and invalidate Redis cache, send to RabbitMQ
app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Invalidate Redis cache
    redisClient.del('products');

    // Send the delete action to RabbitMQ queue
    await sendToQueue('product_queue', JSON.stringify({ action: 'delete', productId: id }));

    res.status(200).json({ message: 'Product deleted', product: result.rows[0] });
  } catch (err) {
    console.error('Failed to delete product:', err);
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

// Clear Redis cache endpoint
app.get('/api/cache/clear', (req, res) => {
  redisClient.del('products', (err, response) => {
    if (err) {
      console.error('Failed to clear Redis cache:', err);
      res.status(500).json({ message: 'Failed to clear Redis cache' });
    } else {
      res.status(200).json({ message: 'Redis cache cleared successfully' });
    }
  });
});

// Connect to RabbitMQ and start consuming messages
connectRabbitMQ().then(() => {
  consumeFromQueue('product_queue', (message) => {
    console.log('Message processed:', message);
  });
});

// Endpoint to send a product to RabbitMQ queue
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

// API endpoint to fetch messages from RabbitMQ queue
app.get('/api/queue/product_queue', (req, res) => {
  try {
    const messages = getMessagesFromQueue(); // Fetch messages from the queue
    res.status(200).json(messages);
  } catch (err) {
    console.error('Failed to fetch messages from queue:', err);
    res.status(500).json({ message: 'Failed to fetch messages from queue' });
  }
});

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
