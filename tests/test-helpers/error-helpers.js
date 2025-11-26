/**
 * Error Test Helpers
 * Provides utilities for simulating errors and failures in tests
 */

/**
 * Mock database that throws errors
 */
class MockErrorDatabase {
  constructor(errorType = 'generic') {
    this.errorType = errorType;
  }

  prepare(query) {
    return {
      get: (...args) => {
        throw this.createError();
      },
      all: (...args) => {
        throw this.createError();
      },
      run: (...args) => {
        throw this.createError();
      },
    };
  }

  exec(query) {
    throw this.createError();
  }

  pragma(setting) {
    throw this.createError();
  }

  createError() {
    switch (this.errorType) {
      case 'connection':
        const connError = new Error('SQLITE_CANTOPEN: unable to open database file');
        connError.code = 'SQLITE_CANTOPEN';
        return connError;
      case 'locked':
        const lockError = new Error('SQLITE_BUSY: database is locked');
        lockError.code = 'SQLITE_BUSY';
        return lockError;
      case 'corrupt':
        const corruptError = new Error('SQLITE_CORRUPT: database disk image is malformed');
        corruptError.code = 'SQLITE_CORRUPT';
        return corruptError;
      case 'readonly':
        const readonlyError = new Error('SQLITE_READONLY: attempt to write a readonly database');
        readonlyError.code = 'SQLITE_READONLY';
        return readonlyError;
      default:
        return new Error('Database error');
    }
  }
}

/**
 * Mock file system that throws errors
 */
class MockErrorFileSystem {
  constructor(errorType = 'generic') {
    this.errorType = errorType;
    this.files = new Map();
  }

  existsSync(path) {
    if (this.errorType === 'permission') {
      const error = new Error('EACCES: permission denied');
      error.code = 'EACCES';
      throw error;
    }
    return this.files.has(path);
  }

  readFileSync(path, encoding) {
    if (this.errorType === 'permission') {
      const error = new Error('EACCES: permission denied');
      error.code = 'EACCES';
      throw error;
    }
    if (this.errorType === 'notfound') {
      const error = new Error('ENOENT: no such file or directory');
      error.code = 'ENOENT';
      throw error;
    }
    if (!this.files.has(path)) {
      const error = new Error('ENOENT: no such file or directory');
      error.code = 'ENOENT';
      throw error;
    }
    return this.files.get(path);
  }

  writeFileSync(path, data, encoding) {
    if (this.errorType === 'permission') {
      const error = new Error('EACCES: permission denied');
      error.code = 'EACCES';
      throw error;
    }
    if (this.errorType === 'diskfull') {
      const error = new Error('ENOSPC: no space left on device');
      error.code = 'ENOSPC';
      throw error;
    }
    this.files.set(path, data);
  }

  mkdirSync(path, options) {
    if (this.errorType === 'permission') {
      const error = new Error('EACCES: permission denied');
      error.code = 'EACCES';
      throw error;
    }
    if (this.errorType === 'diskfull') {
      const error = new Error('ENOSPC: no space left on device');
      error.code = 'ENOSPC';
      throw error;
    }
    // Simulate directory creation
    if (!this.files.has(path)) {
      this.files.set(path, null); // null indicates directory
    }
  }

  unlinkSync(path) {
    if (this.errorType === 'permission') {
      const error = new Error('EACCES: permission denied');
      error.code = 'EACCES';
      throw error;
    }
    if (!this.files.has(path)) {
      const error = new Error('ENOENT: no such file or directory');
      error.code = 'ENOENT';
      throw error;
    }
    this.files.delete(path);
  }

  readdirSync(path, options) {
    if (this.errorType === 'permission') {
      const error = new Error('EACCES: permission denied');
      error.code = 'EACCES';
      throw error;
    }
    // Return empty array for simplicity
    return [];
  }
}

/**
 * Create a promise that rejects after a delay
 */
function createDelayedRejection(error, delay = 100) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(error);
    }, delay);
  });
}

/**
 * Create a promise that resolves with an error-like value
 */
function createErrorResponse(errorMessage, statusCode = 500) {
  return Promise.resolve({
    error: errorMessage,
    statusCode,
  });
}

/**
 * Mock async function that throws errors
 */
function createAsyncErrorFunction(errorType = 'generic') {
  return async (...args) => {
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async
    throw createError(errorType);
  };
}

/**
 * Create error based on type
 */
function createError(errorType) {
  switch (errorType) {
    case 'connection':
      const connError = new Error('Connection failed');
      connError.code = 'ECONNREFUSED';
      return connError;
    case 'timeout':
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ETIMEDOUT';
      return timeoutError;
    case 'permission':
      const permError = new Error('Permission denied');
      permError.code = 'EACCES';
      return permError;
    case 'notfound':
      const notFoundError = new Error('Not found');
      notFoundError.code = 'ENOENT';
      return notFoundError;
    case 'diskfull':
      const diskError = new Error('No space left on device');
      diskError.code = 'ENOSPC';
      return diskError;
    case 'network':
      const networkError = new Error('Network error');
      networkError.code = 'ENETUNREACH';
      return networkError;
    default:
      return new Error('Generic error');
  }
}

/**
 * Wrap a function to throw errors on specific calls
 */
function createFailingFunction(originalFunction, failureRate = 0.5) {
  let callCount = 0;
  return function(...args) {
    callCount++;
    if (Math.random() < failureRate) {
      throw createError('generic');
    }
    return originalFunction.apply(this, args);
  };
}

/**
 * Create a mock service that fails on specific methods
 */
function createFailingService(service, failingMethods = []) {
  const mockService = { ...service };
  for (const method of failingMethods) {
    if (typeof service[method] === 'function') {
      mockService[method] = async (...args) => {
        throw createError('generic');
      };
    }
  }
  return mockService;
}

/**
 * Simulate database disconnection
 */
function simulateDatabaseDisconnection(db) {
  // Close the database connection
  if (db && typeof db.close === 'function') {
    db.close();
  }
  // Return a mock that throws connection errors
  return new MockErrorDatabase('connection');
}

/**
 * Create invalid input data for testing
 */
const invalidInputs = {
  null: null,
  undefined: undefined,
  emptyString: '',
  emptyArray: [],
  emptyObject: {},
  tooLongString: 'a'.repeat(100000),
  negativeNumber: -1,
  zero: 0,
  veryLargeNumber: Number.MAX_SAFE_INTEGER + 1,
  notANumber: NaN,
  infinity: Infinity,
  specialCharacters: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  unicode: '\u0000\u0001\u0002',
  sqlInjection: "' OR '1'='1",
  xss: '<script>alert("XSS")</script>',
  pathTraversal: '../../../etc/passwd',
  jsonInjection: '{"malicious": true}',
};

module.exports = {
  MockErrorDatabase,
  MockErrorFileSystem,
  createDelayedRejection,
  createErrorResponse,
  createAsyncErrorFunction,
  createError,
  createFailingFunction,
  createFailingService,
  simulateDatabaseDisconnection,
  invalidInputs,
};

