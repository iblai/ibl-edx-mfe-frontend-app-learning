import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { logInfo, logError } from '@edx/frontend-platform/logging';

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
    logInfo('[JWT Auth] Global auth state updated', {
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
  const client = getAuthenticatedHttpClient();

  logInfo('[JWT Auth] Setting up global auth interceptor', {});

  // Request interceptor to add JWT token when needed
  const requestInterceptorId = client.interceptors.request.use(
    (config) => {
      const { mode, jwtToken } = globalAuthState;
      const url = config.url || config.baseURL || 'unknown';

      // If we're in JWT mode and have a token, add Authorization header
      if (mode === 'jwt' && jwtToken) {
        // Add JWT token to Authorization header
        // Format: Authorization: JWT <token>
        config.headers.Authorization = `JWT ${jwtToken}`;

        // For cross-origin requests, disable credentials (cookies)
        // This ensures we're using JWT instead of cookies
        config.withCredentials = false;

        logInfo('[JWT Auth] Request interceptor - JWT mode', {
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

        logInfo('[JWT Auth] Request interceptor - Cookie mode', {
          url,
          method: config.method,
          mode,
          hasJwtToken: !!jwtToken,
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
      // Success response - pass through
      return response;
    },
    (error) => {
      // Handle authentication errors
      const status = error?.response?.status;
      const { mode, jwtToken } = globalAuthState;

      if (status === 401) {
        // Unauthorized - token may be invalid or expired
        if (mode === 'jwt' && jwtToken) {
          logError('[JWT Auth] Authentication failed: 401 Unauthorized', {
            error: error.message,
            authMode: mode,
            url: error?.config?.url,
            method: error?.config?.method,
            hasToken: !!jwtToken,
          });

          // Request token refresh from parent window
          try {
            if (window.parent && window.parent !== window) {
              logInfo('[JWT Auth] Requesting token refresh due to 401 error', {
                url: error?.config?.url,
              });
              window.parent.postMessage(
                {
                  type: 'auth.jwt.token.refresh',
                },
                '*' // In production, should specify target origin
              );
            } else {
              logError('[JWT Auth] Cannot request token refresh - not in iframe', {
                url: error?.config?.url,
              });
            }
          } catch (err) {
            logError('[JWT Auth] Failed to request token refresh on 401 error', {
              error: err.message,
              url: error?.config?.url,
            });
          }
        } else {
          logInfo('[JWT Auth] 401 error (not JWT mode)', {
            mode,
            hasJwtToken: !!jwtToken,
            url: error?.config?.url,
          });
        }
      } else if (status === 403) {
        // Forbidden - insufficient permissions
        if (mode === 'jwt') {
          logError('[JWT Auth] Authentication failed: 403 Forbidden', {
            error: error.message,
            authMode: mode,
            url: error?.config?.url,
            method: error?.config?.method,
          });
        } else {
          logInfo('[JWT Auth] 403 error (not JWT mode)', {
            mode,
            url: error?.config?.url,
          });
        }
      } else {
        // Other errors
        logInfo('[JWT Auth] Response error', {
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
      logInfo('[JWT Auth] Removing auth interceptors', {});
      client.interceptors.request.eject(requestInterceptorId);
      client.interceptors.response.eject(responseInterceptorId);
    },
  };
}

