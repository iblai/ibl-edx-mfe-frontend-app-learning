/**
 * Comprehensive error logging utilities.
 * These run BEFORE React mounts to catch early initialization errors.
 */

import { logToServer } from './server-logger';

// Import logging functions - these may be null/undefined if frontend-platform hasn't initialized
// We import them but wrap all calls in try-catch and null checks
// Note: The import itself should work, but the functions may be null if logging isn't initialized yet
import * as loggingModule from '@edx/frontend-platform/logging';

// Extract functions - they may be null if frontend-platform hasn't initialized logging yet
const logError = loggingModule?.logError;
const logInfo = loggingModule?.logInfo;

/**
 * Safe wrapper for logError - checks if it exists before calling
 */
function safeLogError(message, data) {
  if (logError && typeof logError === 'function') {
    try {
      logError(message, data);
    } catch (e) {
      // If logError fails, just use console
      console.error('[JWT Auth] logError failed:', e);
    }
  }
}

/**
 * Safe wrapper for logInfo - checks if it exists before calling
 */
function safeLogInfo(message, data) {
  if (logInfo && typeof logInfo === 'function') {
    try {
      logInfo(message, data);
    } catch (e) {
      // If logInfo fails, just use console
      console.warn('[JWT Auth] logInfo failed:', e);
    }
  }
}

/**
 * Logs detailed information about an error, including stack trace and context.
 */
function logErrorDetails(error, context = {}) {
  const errorInfo = {
    message: error?.message || String(error),
    name: error?.name || 'UnknownError',
    stack: error?.stack || 'No stack trace available',
    url: window.location.href,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    inIframe: window.self !== window.top,
    ...context,
  };

  // Console logging (always visible)
  console.error('[JWT Auth] Error:', errorInfo);
  console.error('[JWT Auth] Error Stack trace:', error?.stack);

  // Frontend-platform logging (safe - checks if available)
  safeLogError('[JWT Auth] Error', errorInfo);

  // Server logging (for Docker logs)
  logToServer('error_occurred', {
    message: errorInfo.message,
    name: errorInfo.name,
    url: errorInfo.url,
    inIframe: errorInfo.inIframe,
    ...context,
  });

  return errorInfo;
}

/**
 * Sets up global error handlers that catch errors BEFORE React mounts.
 * This is critical for debugging initialization failures.
 */
export function setupGlobalErrorHandlers() {
  // Log that we're setting up error handlers
  console.log('[JWT Auth] Setting up global error handlers');
  safeLogInfo('[JWT Auth] Setting up global error handlers', {
    url: window.location.href,
    referrer: document.referrer,
    inIframe: window.self !== window.top,
  });

  // Catch synchronous JavaScript errors
  window.onerror = (message, source, lineno, colno, error) => {
    logErrorDetails(error || new Error(message), {
      source,
      lineno,
      colno,
      errorType: 'window.onerror',
      originalMessage: message,
    });
    return false; // Don't prevent default error handling
  };

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));

    logErrorDetails(error, {
      errorType: 'unhandledrejection',
      promiseRejection: true,
      reason: event.reason,
    });
  });

  // Catch resource loading errors (images, scripts, etc.)
  window.addEventListener('error', (event) => {
    // Only log resource errors (not JavaScript errors, which are handled by onerror)
    if (event.target !== window && event.target !== document) {
      logErrorDetails(new Error(`Resource load error: ${event.target.tagName} ${event.target.src || event.target.href}`), {
        errorType: 'resource_error',
        tagName: event.target.tagName,
        src: event.target.src || event.target.href,
        type: event.target.type,
      });
    }
  }, true); // Use capture phase

  console.log('[JWT Auth] Global error handlers installed');
}

/**
 * Logs initialization milestones to track the app startup sequence.
 */
export function logInitializationMilestone(milestone, data = {}) {
  const logData = {
    milestone,
    url: window.location.href,
    referrer: document.referrer,
    inIframe: window.self !== window.top,
    timestamp: new Date().toISOString(),
    ...data,
  };

  console.log(`[JWT Auth] Init: ${milestone}`, logData);
  safeLogInfo(`[JWT Auth] Init: ${milestone}`, logData);
  logToServer('init_milestone', { milestone, ...data });
}

/**
 * Logs detailed request information including all headers.
 */
export function logRequestDetails(config, phase = 'request') {
  const logData = {
    phase,
    url: config.url || config.baseURL || 'unknown',
    method: config.method || 'GET',
    headers: { ...config.headers },
    withCredentials: config.withCredentials,
    timeout: config.timeout,
    timestamp: new Date().toISOString(),
  };

  // Log Authorization header separately (but truncated for security)
  if (logData.headers.Authorization) {
    const authHeader = logData.headers.Authorization;
    logData.headers.Authorization = authHeader.length > 50
      ? `${authHeader.substring(0, 50)}...`
      : authHeader;
  }

  console.log(`[JWT Auth] Request (${phase}):`, logData);
  safeLogInfo(`[JWT Auth] Request (${phase})`, logData);
  logToServer(`request_${phase}`, {
    url: logData.url,
    method: logData.method,
    hasAuthHeader: !!config.headers.Authorization,
    withCredentials: logData.withCredentials,
  });
}

/**
 * Logs detailed response information including status and headers.
 */
export function logResponseDetails(response, phase = 'response') {
  const logData = {
    phase,
    url: response.config?.url || 'unknown',
    method: response.config?.method || 'GET',
    status: response.status,
    statusText: response.statusText,
    headers: response.headers ? { ...response.headers } : {},
    dataSize: response.data ? JSON.stringify(response.data).length : 0,
    timestamp: new Date().toISOString(),
  };

  console.log(`[JWT Auth] Response (${phase}):`, logData);
  safeLogInfo(`[JWT Auth] Response (${phase})`, logData);
  logToServer(`response_${phase}`, {
    url: logData.url,
    method: logData.method,
    status: logData.status,
  });
}

/**
 * Logs error response details.
 */
export function logErrorResponse(error) {
  const logData = {
    message: error?.message || 'Unknown error',
    status: error?.response?.status,
    statusText: error?.response?.statusText,
    url: error?.config?.url || error?.request?.responseURL || 'unknown',
    method: error?.config?.method || 'GET',
    headers: error?.response?.headers ? { ...error.response.headers } : {},
    requestHeaders: error?.config?.headers ? { ...error.config.headers } : {},
    timestamp: new Date().toISOString(),
  };

  // Truncate Authorization header if present
  if (logData.requestHeaders.Authorization) {
    const authHeader = logData.requestHeaders.Authorization;
    logData.requestHeaders.Authorization = authHeader.length > 50
      ? `${authHeader.substring(0, 50)}...`
      : authHeader;
  }

  console.error('[JWT Auth] Response Error:', logData);
  safeLogError('[JWT Auth] Response Error', logData);
  logToServer('response_error', {
    url: logData.url,
    method: logData.method,
    status: logData.status,
    message: logData.message,
  });
}

