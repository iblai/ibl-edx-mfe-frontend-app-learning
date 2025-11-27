import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { logError } from '@edx/frontend-platform/logging';

/**
 * Creates an authenticated HTTP client with JWT token support.
 *
 * This function wraps the base authenticated HTTP client and adds:
 * - JWT token authentication via Authorization header when in JWT mode
 * - Proper error handling for authentication failures
 * - Automatic fallback to cookie-based authentication
 *
 * @param {string} authMode - Authentication mode: 'cookie' or 'jwt'
 * @param {string|null} jwtToken - JWT token to use when authMode is 'jwt'
 * @returns {Object} Configured axios instance
 */
export function createAuthenticatedHttpClient(authMode, jwtToken) {
  // Get the base authenticated HTTP client from frontend-platform
  const client = getAuthenticatedHttpClient();

  // Add request interceptor to inject JWT token when needed
  const requestInterceptor = client.interceptors.request.use(
    (config) => {
      // If we're in JWT mode and have a token, add Authorization header
      if (authMode === 'jwt' && jwtToken) {
        // Add JWT token to Authorization header
        // Format: Authorization: JWT <token>
        config.headers.Authorization = `JWT ${jwtToken}`;

        // For cross-origin requests, disable credentials (cookies)
        // This ensures we're using JWT instead of cookies
        config.withCredentials = false;
      } else {
        // Cookie-based authentication: ensure credentials are sent
        // This is the default behavior, but we make it explicit
        config.withCredentials = true;
      }

      return config;
    },
    (error) => {
      // Request error - pass through
      return Promise.reject(error);
    }
  );

  // Add response interceptor for error handling
  const responseInterceptor = client.interceptors.response.use(
    (response) => {
      // Success response - pass through
      return response;
    },
    (error) => {
      // Handle authentication errors
      const status = error?.response?.status;

      if (status === 401) {
        // Unauthorized - token may be invalid or expired
        if (authMode === 'jwt') {
          logError('JWT authentication failed: 401 Unauthorized', {
            error: error.message,
            authMode,
          });
          // The error will be thrown, and the calling code can handle it
          // (e.g., request token refresh)
        }
      } else if (status === 403) {
        // Forbidden - insufficient permissions
        if (authMode === 'jwt') {
          logError('JWT authentication failed: 403 Forbidden', {
            error: error.message,
            authMode,
          });
        }
      }

      // Re-throw the error so calling code can handle it
      return Promise.reject(error);
    }
  );

  // Store interceptor IDs for potential cleanup
  // Note: We don't remove these interceptors as they should persist
  // for the lifetime of the client instance
  client._jwtAuthInterceptors = {
    request: requestInterceptor,
    response: responseInterceptor,
  };

  return client;
}

/**
 * Removes the JWT authentication interceptors from a client.
 * Useful for cleanup or when switching authentication modes.
 *
 * @param {Object} client - The axios client instance
 */
export function removeAuthInterceptors(client) {
  if (client?._jwtAuthInterceptors) {
    const { request, response } = client._jwtAuthInterceptors;
    client.interceptors.request.eject(request);
    client.interceptors.response.eject(response);
    delete client._jwtAuthInterceptors;
  }
}

