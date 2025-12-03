import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { logRequestDetails, logResponseDetails, logErrorResponse } from './error-logging';

// Safe wrappers for frontend-platform logging that may not be initialized yet
function safeLogInfo(message, data) {
  try {
    // Try to import dynamically - may fail if not initialized
    const { logInfo } = require('@edx/frontend-platform/logging');
    if (logInfo && typeof logInfo === 'function') {
      logInfo(message, data);
    }
  } catch (e) {
    // Logging not available yet - this is expected during early initialization
    // console.log is already called, which is sufficient
  }
}

function safeLogError(message, data) {
  try {
    // Try to import dynamically - may fail if not initialized
    const { logError } = require('@edx/frontend-platform/logging');
    if (logError && typeof logError === 'function') {
      logError(message, data);
    }
  } catch (e) {
    // Logging not available yet - this is expected during early initialization
    // console.error is already called, which is sufficient
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
  const previousMode = globalAuthState.mode;
  const previousHasToken = !!globalAuthState.jwtToken;
  const newHasToken = !!jwtToken;

  globalAuthState = {
    mode,
    jwtToken,
  };

  // Log state changes
  if (previousMode !== mode || previousHasToken !== newHasToken) {
    console.log('[JWT Auth] Global auth state updated', {
      previousMode,
      newMode: mode,
      previousHasToken,
      newHasToken,
      tokenLength: jwtToken ? jwtToken.length : 0,
    });
    safeLogInfo('[JWT Auth] Global auth state updated', {
      previousMode,
      newMode: mode,
      previousHasToken,
      newHasToken,
      tokenLength: jwtToken ? jwtToken.length : 0,
    });
  }
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
      return { remove: () => {} }; // Return no-op cleanup function
    }

    console.log('[JWT Auth] Setting up global auth interceptor');
    safeLogInfo('[JWT Auth] Setting up global auth interceptor', {});

    // Request interceptor to add JWT token when needed
    const requestInterceptorId = client.interceptors.request.use(
      (config) => {
        const { mode, jwtToken } = globalAuthState;
        const url = config.url || config.baseURL || 'unknown';

        // Log detailed request information including ALL headers
        logRequestDetails(config, 'request');

        // Log interceptor state for debugging
        console.log('[JWT Auth] Request interceptor called', {
          mode,
          hasToken: !!jwtToken,
          tokenLength: jwtToken ? jwtToken.length : 0,
          tokenPreview: jwtToken ? jwtToken.substring(0, 30) + '...' : null,
          url,
          method: config.method,
        });

        // If we're in JWT mode and have a token, add Authorization header
        if (mode === 'jwt' && jwtToken) {
          // Add JWT token to Authorization header
          // Format: Authorization: JWT <token>
          config.headers.Authorization = `JWT ${jwtToken}`;

          // For cross-origin requests, disable credentials (cookies)
          // This ensures we're using JWT instead of cookies
          config.withCredentials = false;

          // Log detailed JWT usage for verification
          const authHeader = config.headers.Authorization || 'NOT SET';
          const hasAuthHeader = authHeader.startsWith('JWT ');
          const usingCookies = config.withCredentials === true;

          console.log('[JWT Auth] ✅ REQUEST USING JWT TOKEN', {
            url,
            method: config.method,
            authMode: 'JWT',
            hasJwtToken: true,
            tokenLength: jwtToken ? jwtToken.length : 0,
            tokenPreview: jwtToken ? jwtToken.substring(0, 50) + '...' : null,
            authorizationHeader: hasAuthHeader ? `${authHeader.substring(0, 50)}...` : 'MISSING',
            withCredentials: config.withCredentials,
            usingCookies: usingCookies,
            confirmation: hasAuthHeader && !usingCookies ? '✅ JWT AUTH CONFIRMED' : '❌ JWT AUTH NOT WORKING',
          });
          safeLogInfo('[JWT Auth] Request interceptor - JWT mode', {
            url,
            method: config.method,
            hasToken: !!jwtToken,
            tokenLength: jwtToken ? jwtToken.length : 0,
          });
        } else {
          // Cookie-based authentication: ensure credentials are sent
          // This is the default behavior, but we make it explicit
          config.withCredentials = true;

          // Remove Authorization header if it exists (from previous JWT mode)
          delete config.headers.Authorization;

          // Log cookie-based auth usage for verification
          const hasAuthHeader = config.headers.Authorization && config.headers.Authorization.startsWith('JWT ');
          const usingCookies = config.withCredentials === true;

          console.log('[JWT Auth] 🍪 REQUEST USING COOKIES', {
            url,
            method: config.method,
            authMode: 'COOKIE',
            hasJwtToken: !!jwtToken,
            authorizationHeader: hasAuthHeader ? 'PRESENT (should not be)' : 'NOT SET (correct)',
            withCredentials: config.withCredentials,
            usingCookies: usingCookies,
            confirmation: !hasAuthHeader && usingCookies ? '✅ COOKIE AUTH CONFIRMED' : '⚠️ AUTH MODE UNCLEAR',
          });
        }

        return config;
      },
      (error) => {
        // Request error - pass through
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    const responseInterceptorId = client.interceptors.response.use(
      (response) => {
        // Log successful response details
        logResponseDetails(response, 'success');
        // Success response - pass through
        return response;
      },
      (error) => {
        // Log error response details with full headers
        logErrorResponse(error);

        // Handle authentication errors
        const status = error?.response?.status;
        const { mode, jwtToken } = globalAuthState;

        if (status === 401) {
          // Unauthorized - token may be invalid or expired
          if (mode === 'jwt' && jwtToken) {
            console.error('[JWT Auth] Authentication failed: 401 Unauthorized', {
              error: error.message,
              authMode: mode,
              url: error?.config?.url,
              method: error?.config?.method,
              hasToken: !!jwtToken,
            });
            safeLogError('[JWT Auth] Authentication failed: 401 Unauthorized', {
              error: error.message,
              authMode: mode,
              url: error?.config?.url,
              method: error?.config?.method,
              hasToken: !!jwtToken,
            });

            // Request token refresh from parent window
            try {
              if (window.parent && window.parent !== window) {
                safeLogInfo('[JWT Auth] Requesting token refresh due to 401 error', {
                  url: error?.config?.url,
                });
                window.parent.postMessage(
                  {
                    type: 'auth.jwt.token.refresh',
                  },
                  '*' // In production, should specify target origin
                );
              } else {
                safeLogError('[JWT Auth] Cannot request token refresh - not in iframe', {
                  url: error?.config?.url,
                });
              }
            } catch (err) {
              safeLogError('[JWT Auth] Failed to request token refresh on 401 error', {
                error: err.message,
                url: error?.config?.url,
              });
            }
          } else {
            safeLogInfo('[JWT Auth] 401 error (not JWT mode)', {
              mode,
              hasJwtToken: !!jwtToken,
              url: error?.config?.url,
            });
          }
        } else if (status === 403) {
          // Forbidden - insufficient permissions
          if (mode === 'jwt') {
            safeLogError('[JWT Auth] Authentication failed: 403 Forbidden', {
              error: error.message,
              authMode: mode,
              url: error?.config?.url,
              method: error?.config?.method,
            });
          } else {
            safeLogInfo('[JWT Auth] 403 error (not JWT mode)', {
              mode,
              url: error?.config?.url,
            });
          }
        } else {
          // Other errors
          safeLogInfo('[JWT Auth] Response error', {
            status,
            mode,
            url: error?.config?.url,
            method: error?.config?.method,
          });
        }

        // Re-throw the error so calling code can handle it
        return Promise.reject(error);
      }
    );

    // Return cleanup function
    return {
      remove: () => {
        safeLogInfo('[JWT Auth] Removing auth interceptors', {});
        client.interceptors.request.eject(requestInterceptorId);
        client.interceptors.response.eject(responseInterceptorId);
      },
    };
  } catch (error) {
    safeLogError('[JWT Auth] Error setting up auth interceptor', { error: error.message });
    // Return no-op cleanup function on error
    return { remove: () => {} };
  }
}

