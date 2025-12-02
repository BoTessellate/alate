import { queueCanvasOperation } from './canvasQueue';

describe('canvasQueue', () => {
  beforeEach(() => {
    // Reset the queue state between tests
    jest.clearAllMocks();
  });

  describe('Sequential Execution', () => {
    it('should execute operations sequentially', async () => {
      const executionOrder: number[] = [];

      const operation1 = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        executionOrder.push(1);
        return 'result1';
      });

      const operation2 = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        executionOrder.push(2);
        return 'result2';
      });

      const operation3 = jest.fn(async () => {
        executionOrder.push(3);
        return 'result3';
      });

      // Start all operations concurrently
      const promises = [
        queueCanvasOperation(operation1),
        queueCanvasOperation(operation2),
        queueCanvasOperation(operation3),
      ];

      const results = await Promise.all(promises);

      // Verify all operations completed
      expect(results).toEqual(['result1', 'result2', 'result3']);

      // Verify operations executed in order (not concurrently)
      expect(executionOrder).toEqual([1, 2, 3]);

      // Verify each operation was called exactly once
      expect(operation1).toHaveBeenCalledTimes(1);
      expect(operation2).toHaveBeenCalledTimes(1);
      expect(operation3).toHaveBeenCalledTimes(1);
    });

    it('should wait for previous operation to complete before starting next', async () => {
      let operation1Running = false;
      let operation2Running = false;

      const operation1 = async () => {
        operation1Running = true;
        await new Promise(resolve => setTimeout(resolve, 100));
        operation1Running = false;
        return 'op1';
      };

      const operation2 = async () => {
        // Operation 1 should not be running when operation 2 starts
        expect(operation1Running).toBe(false);
        operation2Running = true;
        await new Promise(resolve => setTimeout(resolve, 50));
        operation2Running = false;
        return 'op2';
      };

      const promise1 = queueCanvasOperation(operation1);
      const promise2 = queueCanvasOperation(operation2);

      await Promise.all([promise1, promise2]);

      expect(operation1Running).toBe(false);
      expect(operation2Running).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should not block queue when operation throws error', async () => {
      const operation1 = jest.fn(async () => {
        throw new Error('Operation 1 failed');
      });

      const operation2 = jest.fn(async () => {
        return 'success';
      });

      // First operation should fail
      await expect(queueCanvasOperation(operation1)).rejects.toThrow('Operation 1 failed');

      // Second operation should still execute
      const result = await queueCanvasOperation(operation2);
      expect(result).toBe('success');
      expect(operation2).toHaveBeenCalled();
    });

    it('should handle multiple errors gracefully', async () => {
      const errors: Error[] = [];

      const failingOp = async () => {
        throw new Error('Failed');
      };

      const successOp = async () => {
        return 'success';
      };

      // Queue: fail, fail, success, fail, success
      const promises = [
        queueCanvasOperation(failingOp).catch(e => errors.push(e)),
        queueCanvasOperation(failingOp).catch(e => errors.push(e)),
        queueCanvasOperation(successOp),
        queueCanvasOperation(failingOp).catch(e => errors.push(e)),
        queueCanvasOperation(successOp),
      ];

      const results = await Promise.all(promises);

      // Should have 3 errors
      expect(errors).toHaveLength(3);
      errors.forEach(err => expect(err.message).toBe('Failed'));

      // Should have 2 successes
      const successes = results.filter(r => r === 'success');
      expect(successes).toHaveLength(2);
    });

    it('should propagate errors to caller', async () => {
      const customError = new Error('Custom error');

      const failingOperation = async () => {
        throw customError;
      };

      await expect(queueCanvasOperation(failingOperation)).rejects.toThrow(customError);
    });
  });

  describe('Concurrency Prevention', () => {
    it('should ensure only one operation runs at a time', async () => {
      let concurrentOps = 0;
      let maxConcurrentOps = 0;

      const createOperation = (id: number) => async () => {
        concurrentOps++;
        maxConcurrentOps = Math.max(maxConcurrentOps, concurrentOps);

        await new Promise(resolve => setTimeout(resolve, 50));

        concurrentOps--;
        return id;
      };

      // Start 5 operations simultaneously
      const promises = [
        queueCanvasOperation(createOperation(1)),
        queueCanvasOperation(createOperation(2)),
        queueCanvasOperation(createOperation(3)),
        queueCanvasOperation(createOperation(4)),
        queueCanvasOperation(createOperation(5)),
      ];

      await Promise.all(promises);

      // Should never have more than 1 operation running concurrently
      expect(maxConcurrentOps).toBe(1);
    });
  });

  describe('Return Values', () => {
    it('should return correct values from operations', async () => {
      const operation1 = async () => ({ data: 'value1' });
      const operation2 = async () => 42;
      const operation3 = async () => ['a', 'b', 'c'];

      const result1 = await queueCanvasOperation(operation1);
      const result2 = await queueCanvasOperation(operation2);
      const result3 = await queueCanvasOperation(operation3);

      expect(result1).toEqual({ data: 'value1' });
      expect(result2).toBe(42);
      expect(result3).toEqual(['a', 'b', 'c']);
    });

    it('should handle void operations', async () => {
      const operation = async () => {
        // No return value
      };

      const result = await queueCanvasOperation(operation);
      expect(result).toBeUndefined();
    });
  });

  describe('Buffer Between Operations', () => {
    it('should add 50ms buffer between operations', async () => {
      const startTimes: number[] = [];

      const operation = async () => {
        startTimes.push(Date.now());
        // Add small delay to ensure operation doesn't finish instantly
        await new Promise(resolve => setTimeout(resolve, 10));
      };

      // Start operations and wait for all to complete
      const promises = [
        queueCanvasOperation(operation),
        queueCanvasOperation(operation),
        queueCanvasOperation(operation),
      ];

      await Promise.all(promises);

      // Check that operations were started sequentially with buffer
      // First operation starts immediately, subsequent ones should wait
      for (let i = 1; i < startTimes.length; i++) {
        const timeDiff = startTimes[i] - startTimes[i - 1];
        // Each should wait at least for previous operation (10ms) + buffer (50ms)
        expect(timeDiff).toBeGreaterThanOrEqual(50);
      }
    });
  });

  describe('Rapid Fire Scenarios', () => {
    it('should handle rapid consecutive calls', async () => {
      const results: number[] = [];

      const createOp = (value: number) => async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push(value);
        return value;
      };

      // Simulate rapid button clicks
      const promises = Array.from({ length: 10 }, (_, i) =>
        queueCanvasOperation(createOp(i))
      );

      await Promise.all(promises);

      // All operations should complete
      expect(results).toHaveLength(10);

      // Operations should execute in order
      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty operation', async () => {
      const operation = async () => {};

      await expect(queueCanvasOperation(operation)).resolves.toBeUndefined();
    });

    it('should handle operation that returns null', async () => {
      const operation = async () => null;

      const result = await queueCanvasOperation(operation);
      expect(result).toBeNull();
    });

    it('should handle operation that returns Promise.resolve', async () => {
      const operation = async () => Promise.resolve('resolved');

      const result = await queueCanvasOperation(operation);
      expect(result).toBe('resolved');
    });

    it('should handle synchronous operations wrapped in async', async () => {
      const operation = async () => {
        return 'immediate';
      };

      const result = await queueCanvasOperation(operation);
      expect(result).toBe('immediate');
    });
  });
});
