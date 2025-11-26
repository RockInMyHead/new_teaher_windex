/**
 * Store middleware
 * Provides logging and DevTools integration
 * NOTE: State persistence is now handled via sessionService and database
 */

import { logger } from '@/utils/logger';

/**
 * Export store state as JSON for debugging
 */
export const exportStoreState = (states: Record<string, any>): string => {
  try {
    return JSON.stringify(states, null, 2);
  } catch (error) {
    logger.error('Failed to export store state', error as Error);
    return '{}';
  }
};

/**
 * Log state changes for debugging
 */
export const logStateChange = (
  storeName: string,
  action: string,
  previousState: any,
  newState: any
): void => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`[${storeName}] ${action}`, {
      previous: previousState,
      new: newState,
    });
  }
};

/**
 * DevTools integration (for future Zustand migration)
 * Can be used with zustand/middleware when Zustand is installed
 */
export const initDevTools = (): void => {
  if (typeof window !== 'undefined' && (window as any).__REDUX_DEVTOOLS_EXTENSION__) {
    logger.info('Redux DevTools detected - ready for integration');
  }
};

export default {
  exportStoreState,
  logStateChange,
  initDevTools,
};
