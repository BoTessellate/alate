/**
 * Timeout Middleware
 *
 * Re-exports timeout utilities from SDK and adds handler-specific wrappers.
 */

import { createModuleLogger } from '../../sdk/shared/logger';

// Re-export core utilities from SDK
export {
  withTimeout,
  TimeoutError,
  isTimeoutError,
  TIMEOUT_CONFIGS
} from '../../sdk/shared/timeout';

import { withTimeout, isTimeoutError } from '../../sdk/shared/timeout';

const log = createModuleLogger('timeout-middleware');

/**
 * Wraps an Express/Vercel handler with timeout handling
 * Returns appropriate HTTP error response on timeout
 *
 * @example
 * ```typescript
 * export default withHandlerTimeout(async (req, res) => {
 *   const result = await longRunningOperation();
 *   return res.json(result);
 * }, 45000, 'API Handler');
 * ```
 */
export function withHandlerTimeout<Req, Res>(
  handler: (req: Req, res: Res) => Promise<void | Res>,
  timeoutMs: number = 30000,
  handlerName: string = 'API Handler'
) {
  return async (req: Req, res: Res): Promise<void | Res> => {
    try {
      return await withTimeout(
        () => handler(req, res),
        timeoutMs,
        handlerName
      );
    } catch (error) {
      if (isTimeoutError(error)) {
        log.error({
          handlerName,
          timeoutMs,
          error: (error as Error).message
        }, 'Handler timed out');

        // Return 504 Gateway Timeout with helpful message
        return (res as any).status(504).json({
          error: 'Request timeout',
          message: (error as Error).message,
          hint: 'Try reducing the scope of your request or try again later',
          code: 'TIMEOUT'
        });
      }

      // Re-throw non-timeout errors to be handled by error middleware
      throw error;
    }
  };
}
