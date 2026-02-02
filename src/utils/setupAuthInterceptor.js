import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { logRequestDetails, logResponseDetails, logErrorResponse } from './error-logging';

// Safe wrapper for frontend-platform error logging that may not be initialized yet
function safeLogError(message, data) {
  try {
    const { logError } = require('@edx/frontend-platform/logging');
    if (logError && typeof logError === 'function') {
      logError(message, data);
    }
  } catch (e) {
    // Logging not available yet - this is expected during early initialization
  }
}

/**
 * Global state for JWT authentication.
 * This allows the interceptor to access current auth state without React context.
 */
let globalAuthState = {
  mode: 'cookie',
  jwtToken: null,
};

/**
 * Sets the global authentication state.
 * This is called by the AuthenticatedHttpClientProvider when auth state changes.
 *
 * @param {string} mode - Authentication mode: 'cookie' or 'jwt'
 * @param {string|null} jwtToken - JWT token if in JWT mode
 */
export function setGlobalAuthState(mode, jwtToken) {
  globalAuthState = {
    mode,
    jwtToken,
  };
}

/**
 * Gets the current global authentication state.
 *
 * @returns {Object} Current auth state
 */
export function getGlobalAuthState() {
  return { ...globalAuthState };
}

/**
 * Sets up a global interceptor on the authenticated HTTP client.
 * This interceptor checks the current auth state on each request and adds
 * JWT token header when needed.
 *
 * This allows API functions to continue using getAuthenticatedHttpClient()
 * without modification, while still supporting JWT authentication.
 *
 * @returns {Object} Object with cleanup function to remove interceptors
 */
export function setupAuthInterceptor() {
  try {
    const client = getAuthenticatedHttpClient();

    if (!client) {
      safeLogError('[JWT Auth] getAuthenticatedHttpClient returned null/undefined', {});
      return { remove: () => {} };
    }

    // Request interceptor to add JWT token when needed
    const requestInterceptorId = client.interceptors.request.use(
      (config) => {
        const { mode, jwtToken } = globalAuthState;

        // Ensure headers object exists
        if (!config.headers) {
          config.headers = {};
        }

        // Always suppress the USE-JWT-COOKIE header to avoid CORS preflight failures.
        // The server may not include USE-JWT-COOKIE in Access-Control-Allow-Headers,
        // causing cross-origin requests to fail. In cookie mode, SessionAuthentication
        // handles auth via session cookies. In JWT mode, the Authorization header is used.
        config.skipUseJwtCookieHeader = true;

        if (mode === 'jwt' && jwtToken) {
          // Skip frontend-platform's JWT token refresh interceptor
          config.skipJwtTokenRefresh = true;

          // Set Authorization header directly on config.headers
          // NOTE: Do NOT set config.headers.common or config.headers[method] - these get
          // serialized as actual headers in newer Axios versions, causing CORS errors
          config.headers.Authorization = `JWT ${jwtToken}`;

          // Disable credentials (cookies) for JWT mode
          config.withCredentials = false;
        } else {
          // Cookie-based authentication: ensure credentials are sent
          // The frontend-platform interceptor still runs to refresh the JWT cookie,
          // but won't add the USE-JWT-COOKIE header (suppressed above).
          config.withCredentials = true;
          delete config.headers.Authorization;
        }

        logRequestDetails(config, 'request');
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    const responseInterceptorId = client.interceptors.response.use(
      (response) => {
        logResponseDetails(response, 'success');
        return response;
      },
      (error) => {
        logErrorResponse(error);

        const status = error?.response?.status;
        const { mode, jwtToken } = globalAuthState;

        // Handle 401 in JWT mode - request token refresh
        if (status === 401 && mode === 'jwt' && jwtToken) {
          safeLogError('[JWT Auth] 401 Unauthorized', {
            url: error?.config?.url,
          });

          try {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'auth.jwt.token.refresh' }, '*');
            }
          } catch (err) {
            // Silently fail - parent may not be listening
          }
        }

        return Promise.reject(error);
      }
    );

    return {
      remove: () => {
        client.interceptors.request.eject(requestInterceptorId);
        client.interceptors.response.eject(responseInterceptorId);
      },
    };
  } catch (error) {
    safeLogError('[JWT Auth] Error setting up auth interceptor', { error: error.message });
    return { remove: () => {} };
  }
}

