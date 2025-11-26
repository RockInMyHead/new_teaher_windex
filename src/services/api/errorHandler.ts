/**
 * API Error Handler
 */

import type { AppError, AppErrorCode } from '@/types';
import { AppError } from '@/types';
import { logger } from '@/utils/logger';
import { getErrorMessage } from '@/utils/constants';

/**
 * Handle API errors and normalize to AppError
 */
export const handleApiError = (error: unknown): AppError => {
  // Already an AppError
  if (error instanceof AppError) {
    return error;
  }

  // Network error
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return new AppError(
      'NETWORK_ERROR',
      0,
      getErrorMessage('NETWORK_ERROR'),
      { originalError: error }
    );
  }

  // Timeout error (AbortError)
  if (error instanceof Error && error.name === 'AbortError') {
    return new AppError(
      'TIMEOUT',
      408,
      getErrorMessage('TIMEOUT_ERROR'),
      { originalError: error }
    );
  }

  // Standard Error
  if (error instanceof Error) {
    const code = inferErrorCode(error.message);
    return new AppError(
      code,
      inferErrorStatus(code),
      error.message,
      { originalError: error }
    );
  }

  // Unknown error
  return new AppError(
    'UNKNOWN_ERROR',
    500,
    getErrorMessage('UNKNOWN_ERROR'),
    { originalError: error }
  );
};

/**
 * Handle Response errors
 */
export const handleResponseError = (response: Response, body?: any): AppError => {
  const status = response.status;
  const code = inferErrorCodeFromStatus(status);

  let message = getErrorMessage('API_ERROR' as any);

  if (body?.error?.message) {
    message = body.error.message;
  } else if (body?.message) {
    message = body.message;
  }

  return new AppError(code, status, message, { status, body });
};

/**
 * Infer error code from error message
 */
const inferErrorCode = (message: string): AppErrorCode => {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('network')) {
    return 'NETWORK_ERROR';
  }
  if (lowerMessage.includes('timeout')) {
    return 'TIMEOUT';
  }
  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('invalid')) {
    return 'AUTH_ERROR';
  }
  if (lowerMessage.includes('not found')) {
    return 'NOT_FOUND';
  }
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
    return 'VALIDATION_ERROR';
  }
  if (lowerMessage.includes('quota') || lowerMessage.includes('insufficient_quota')) {
    return 'QUOTA_EXCEEDED';
  }

  return 'UNKNOWN_ERROR';
};

/**
 * Infer error code from HTTP status
 */
const inferErrorCodeFromStatus = (status: number): AppErrorCode => {
  if (status === 0) return 'NETWORK_ERROR';
  if (status === 408) return 'TIMEOUT';
  if (status === 401 || status === 403) return 'AUTH_ERROR';
  if (status === 404) return 'NOT_FOUND';
  if (status === 400 || status === 422) return 'VALIDATION_ERROR';

  return 'API_ERROR' as AppErrorCode;
};

/**
 * Infer HTTP status from error code
 */
const inferErrorStatus = (code: AppErrorCode): number => {
  const statusMap: Record<AppErrorCode, number> = {
    NETWORK_ERROR: 0,
    API_ERROR: 500,
    VALIDATION_ERROR: 400,
    AUTH_ERROR: 401,
    NOT_FOUND: 404,
    TIMEOUT: 408,
    QUOTA_EXCEEDED: 429,
    UNKNOWN_ERROR: 500,
  };

  return statusMap[code] || 500;
};

/**
 * Check if error is retryable
 */
export const isRetryableError = (error: AppError): boolean => {
  const retryableErrors: AppErrorCode[] = ['NETWORK_ERROR', 'TIMEOUT', 'API_ERROR'];
  return retryableErrors.includes(error.code as AppErrorCode);
};

/**
 * Retry function with exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> => {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        const jitter = delay * 0.1 * Math.random();
        const totalDelay = delay + jitter;

        logger.warn(`Retry attempt ${i + 1}/${maxRetries} after ${Math.round(totalDelay)}ms`, {
          error: lastError.message,
        });

        await new Promise(resolve => setTimeout(resolve, totalDelay));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
};

/**
 * User-friendly error message
 */
export const getUserFriendlyErrorMessage = (error: AppError | unknown): string => {
  if (error instanceof AppError) {
    // Try to get friendly message from constants
    const friendlyMap: Record<string, string> = {
      NETWORK_ERROR: getErrorMessage('NETWORK_ERROR'),
      TIMEOUT: getErrorMessage('TIMEOUT_ERROR'),
      AUTH_ERROR: getErrorMessage('AUTH_ERROR'),
      NOT_FOUND: getErrorMessage('NOT_FOUND'),
      VALIDATION_ERROR: getErrorMessage('VALIDATION_ERROR'),
      QUOTA_EXCEEDED: 'Лимит использования ИИ превышен. Пожалуйста, свяжитесь с администратором для пополнения баланса.',
    };

    return friendlyMap[error.code] || error.message || getErrorMessage('UNKNOWN_ERROR');
  }

  if (error instanceof Error) {
    return error.message || getErrorMessage('UNKNOWN_ERROR');
  }

  return getErrorMessage('UNKNOWN_ERROR');
};

/**
 * Log error with context
 */
export const logError = (
  error: AppError | unknown,
  context?: Record<string, any>
): void => {
  if (error instanceof AppError) {
    logger.error(error.message, error, context);
  } else if (error instanceof Error) {
    logger.error(error.message, error, context);
  } else {
    logger.error(String(error), context);
  }
};

