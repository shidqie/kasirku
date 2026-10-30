// ============================================================================
// VERCEL SERVERLESS FUNCTION HANDLER
// ============================================================================
// Endpoint entry point untuk deployment Vercel Serverless.
// Menggunakan Express app tanpa memerlukan server background yang berjalan terus-menerus.

const app = require('../src/app');

module.exports = app;
