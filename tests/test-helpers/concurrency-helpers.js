/**
 * Concurrency Test Helpers
 * Provides utilities for testing concurrent operations and race conditions
 */

/**
 * Execute multiple requests concurrently
 */
async function executeConcurrentRequests(requestFn, count = 10, options = {}) {
  const { delay = 0, errorHandler } = options;
  const promises = [];

  for (let i = 0; i < count; i++) {
    const promise = (async () => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * delay));
      }
      try {
        return await requestFn(i);
      } catch (error) {
        if (errorHandler) {
          errorHandler(error, i);
        }
        throw error;
      }
    })();
    promises.push(promise);
  }

  return Promise.allSettled(promises);
}

/**
 * Execute requests with specific timing to create race conditions
 */
async function executeRaceCondition(requestFn1, requestFn2, delay = 10) {
  const promise1 = requestFn1();
  await new Promise(resolve => setTimeout(resolve, delay));
  const promise2 = requestFn2();
  
  return Promise.allSettled([promise1, promise2]);
}

/**
 * Create a barrier for synchronizing concurrent operations
 */
class Barrier {
  constructor(count) {
    this.count = count;
    this.waiting = [];
    this.current = 0;
  }

  async wait() {
    this.current++;
    if (this.current >= this.count) {
      // Release all waiting promises
      const waiting = this.waiting;
      this.waiting = [];
      this.current = 0;
      waiting.forEach(resolve => resolve());
      return;
    }
    // Wait for other threads
    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }

  reset() {
    this.current = 0;
    this.waiting = [];
  }
}

/**
 * Create a semaphore for limiting concurrent operations
 */
class Semaphore {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.current = 0;
    this.queue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (this.current < this.maxConcurrent) {
        this.current++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    this.current--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.current++;
      next();
    }
  }

  async execute(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

/**
 * Create a lock for mutual exclusion
 */
class Lock {
  constructor() {
    this.locked = false;
    this.queue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    } else {
      this.locked = false;
    }
  }

  async execute(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

/**
 * Test for data consistency after concurrent operations
 */
async function testDataConsistency(operations, verificationFn, options = {}) {
  const { iterations = 10, concurrency = 5 } = options;
  const results = [];

  for (let i = 0; i < iterations; i++) {
    const concurrentOps = executeConcurrentRequests(
      async (index) => {
        const op = operations[index % operations.length];
        return await op();
      },
      concurrency
    );

    const settled = await concurrentOps;
    const verification = await verificationFn();
    results.push({
      iteration: i,
      operations: settled,
      verification,
      consistent: verification.consistent !== false,
    });
  }

  return results;
}

/**
 * Create a test scenario with concurrent reads and writes
 */
async function testReadWriteConcurrency(readFn, writeFn, options = {}) {
  const { readCount = 10, writeCount = 5, delay = 0 } = options;
  
  const readPromises = executeConcurrentRequests(readFn, readCount, { delay });
  const writePromises = executeConcurrentRequests(writeFn, writeCount, { delay });

  const [readResults, writeResults] = await Promise.all([
    readPromises,
    writePromises,
  ]);

  return {
    reads: readResults,
    writes: writeResults,
    total: readCount + writeCount,
  };
}

/**
 * Test for lost updates (race condition where updates are overwritten)
 */
async function testLostUpdates(updateFn, initialValue, updateCount = 10) {
  let currentValue = initialValue;
  const updates = [];

  const updatePromises = executeConcurrentRequests(
    async (index) => {
      const oldValue = currentValue;
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      const result = await updateFn(oldValue, index);
      updates.push({ index, oldValue, result });
      return result;
    },
    updateCount
  );

  const results = await updatePromises;
  return {
    results,
    updates,
    finalValue: currentValue,
  };
}

/**
 * Create a stress test scenario
 */
async function stressTest(operationFn, options = {}) {
  const {
    duration = 5000, // 5 seconds
    concurrency = 20,
    rampUp = 1000, // 1 second
  } = options;

  const startTime = Date.now();
  const results = [];
  let active = 0;

  const runOperation = async () => {
    active++;
    const opStart = Date.now();
    try {
      const result = await operationFn();
      const duration = Date.now() - opStart;
      results.push({ success: true, duration, result });
    } catch (error) {
      const duration = Date.now() - opStart;
      results.push({ success: false, duration, error: error.message });
    } finally {
      active--;
    }
  };

  // Ramp up phase
  const rampUpInterval = rampUp / concurrency;
  const rampUpPromises = [];
  for (let i = 0; i < concurrency; i++) {
    const promise = new Promise(resolve => {
      setTimeout(async () => {
        while (Date.now() - startTime < duration) {
          await runOperation();
          // Small delay between operations
          await new Promise(r => setTimeout(r, 10));
        }
        resolve();
      }, i * rampUpInterval);
    });
    rampUpPromises.push(promise);
  }

  await Promise.all(rampUpPromises);

  return {
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
    results,
  };
}

/**
 * Monitor resource usage during concurrent operations
 */
class ResourceMonitor {
  constructor() {
    this.metrics = {
      memory: [],
      cpu: [],
      time: [],
    };
    this.startTime = Date.now();
  }

  start() {
    this.startTime = Date.now();
    this.monitoring = true;
    this.monitor();
  }

  stop() {
    this.monitoring = false;
  }

  monitor() {
    if (!this.monitoring) return;

    const memUsage = process.memoryUsage();
    this.metrics.memory.push({
      time: Date.now() - this.startTime,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
    });

    setTimeout(() => this.monitor(), 100);
  }

  getStats() {
    return {
      duration: Date.now() - this.startTime,
      memory: {
        peak: Math.max(...this.metrics.memory.map(m => m.heapUsed)),
        average: this.metrics.memory.reduce((sum, m) => sum + m.heapUsed, 0) / this.metrics.memory.length,
      },
      metrics: this.metrics,
    };
  }
}

module.exports = {
  executeConcurrentRequests,
  executeRaceCondition,
  Barrier,
  Semaphore,
  Lock,
  testDataConsistency,
  testReadWriteConcurrency,
  testLostUpdates,
  stressTest,
  ResourceMonitor,
};

