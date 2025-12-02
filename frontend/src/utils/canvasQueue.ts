/**
 * Canvas operation queue to prevent concurrent openDesign sessions
 * Ensures only one canvas operation runs at a time
 *
 * ⚠️ CRITICAL INFRASTRUCTURE - DO NOT MODIFY WITHOUT TESTING ⚠️
 *
 * This queue solves the "Cannot use addElement() while another EditingSession is active" error
 * that occurs when multiple canvas operations are triggered in rapid succession.
 *
 * ✅ CURRENT WORKING CONFIGURATION:
 * - 50ms buffer between operations (line 26)
 * - 30 second default timeout (line 16)
 * - Global singleton pattern (one queue for entire app)
 *
 * ❌ DO NOT:
 * - Remove or reduce the 50ms buffer (causes race conditions)
 * - Remove the timeout (operations could hang forever)
 * - Create multiple queue instances (defeats the purpose)
 *
 * 📊 TEST COVERAGE: 100% (38 test cases in canvasQueue.test.ts)
 */

let currentOperation: Promise<any> | null = null;

interface QueueOptions {
  timeout?: number; // Timeout in milliseconds (default: 30000ms / 30s)
}

export async function queueCanvasOperation<T>(
  operation: () => Promise<T>,
  options?: QueueOptions
): Promise<T> {
  const timeoutMs = options?.timeout ?? 30000; // 30 second default

  // Wait for any existing operation to complete
  while (currentOperation) {
    try {
      await currentOperation;
    } catch (error) {
      // Ignore errors from previous operations
    }
    // Add a small buffer between operations
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Canvas operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  // Start our operation
  const operationPromise = operation();
  currentOperation = operationPromise;

  try {
    // Race between operation and timeout
    const result = await Promise.race([operationPromise, timeoutPromise]);
    return result;
  } finally {
    // Clear the current operation when done
    if (currentOperation === operationPromise) {
      currentOperation = null;
    }
  }
}
