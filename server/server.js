/**
 * Main Server Application
 * Express server with database integration
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Import routes
const usersRoutes = require('./routes/users');
const coursesRoutes = require('./routes/courses');
const chatRoutes = require('./routes/chat');
const examsRoutes = require('./routes/exams');
const learningProgressRoutes = require('./routes/learningProgress');
const learningProfileRoutes = require('./routes/learningProfile');
const llmRoutes = require('./routes/llm');
const sessionsRoutes = require('./routes/sessions');

// Mount routes
app.use('/api/users', usersRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/exams', examsRoutes);
app.use('/api/learning-progress', learningProgressRoutes);
app.use('/api/learning-profile', learningProfileRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api', llmRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 API available at http://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;

