// Global setup for tests
// Mock console.log/error to keep test output clean if needed
// global.console = {
//   ...console,
//   // log: jest.fn(),
//   // error: jest.fn(),
// };

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001'; // Use different port for tests
process.env.SESSION_SECRET = 'test-secret';
