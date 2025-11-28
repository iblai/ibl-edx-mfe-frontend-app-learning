import { useCallback, useState, useEffect, useRef } from 'react';
import { useEventListener } from '../generic/hooks';
import { validateMessageOrigin } from '../utils/auth-utils';
import { isTokenExpired, getTimeUntilExpiration } from '../utils/jwt-utils';
import { logInfo, logError } from '@edx/frontend-platform/logging';

/**
 * React hook that listens for JWT tokens sent via postMessage from the parent window.
 * The token is stored in memory (component state) and never persisted to localStorage.
 *
 * Expected message format from parent:
 * {
 *   type: 'auth.jwt.token',
 *   edx_jwt_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 * }
 *
 * @returns {Object} Object containing:
 *   - token: string | null - The JWT token if received, null otherwise
 *   - isLoading: boolean - True while waiting for initial token
 *   - error: string | null - Error message if token reception fails
 */
export function useJWTToken() {
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const expiryCheckIntervalRef = useRef(null);
  const refreshRequestedRef = useRef(false);

  /**
   * Request token refresh from parent window.
   * Sends a postMessage to parent requesting a new token.
   */
  const requestTokenRefresh = useCallback(() => {
    // Prevent multiple simultaneous refresh requests
    if (refreshRequestedRef.current) {
      logInfo('[JWT Auth] Token refresh already requested, skipping', {});
      return;
    }

    try {
      if (window.parent && window.parent !== window) {
        logInfo('[JWT Auth] Requesting token refresh from parent', {});
        refreshRequestedRef.current = true;
        window.parent.postMessage(
          {
            type: 'auth.jwt.token.refresh',
          },
          '*' // In production, should specify target origin
        );
        setIsLoading(true);
        setError(null);

        // Reset refresh request flag after a delay
        setTimeout(() => {
          refreshRequestedRef.current = false;
          logInfo('[JWT Auth] Token refresh cooldown expired', {});
        }, 5000); // 5 second cooldown
      } else {
        logError('[JWT Auth] Cannot request token refresh - not in iframe', {});
      }
    } catch (err) {
      logError('[JWT Auth] Error requesting token refresh', { error: err.message });
      setError('Failed to request token refresh');
      refreshRequestedRef.current = false;
    }
  }, []);

  /**
   * Sets up an interval to check token expiry and request refresh if needed.
   *
   * @param {string} currentToken - The current JWT token
   */
  const setupExpiryCheck = useCallback((currentToken) => {
    // Clear any existing interval
    if (expiryCheckIntervalRef.current) {
      clearInterval(expiryCheckIntervalRef.current);
      expiryCheckIntervalRef.current = null;
    }

    if (!currentToken) {
      return;
    }

    // Get time until expiration
    const timeUntilExpiration = getTimeUntilExpiration(currentToken);

    if (!timeUntilExpiration) {
      // Token is expired or invalid
      requestTokenRefresh();
      return;
    }

    // Check every minute, or when token is about to expire (whichever is sooner)
    const checkInterval = Math.min(60000, timeUntilExpiration / 2); // Check at least every minute, or halfway to expiry

    logInfo('[JWT Auth] Setting up token expiry check', {
      checkIntervalMs: checkInterval,
      checkIntervalMinutes: Math.round(checkInterval / 60000),
      timeUntilExpirationMs: timeUntilExpiration,
    });

    // Set up interval to check token expiry
    expiryCheckIntervalRef.current = setInterval(() => {
      if (isTokenExpired(currentToken)) {
        logInfo('[JWT Auth] Token expired during expiry check - requesting refresh', {});
        // Token expired - request refresh
        requestTokenRefresh();
        // Clear interval
        if (expiryCheckIntervalRef.current) {
          clearInterval(expiryCheckIntervalRef.current);
          expiryCheckIntervalRef.current = null;
        }
      }
    }, checkInterval);
  }, [requestTokenRefresh]);

  /**
   * Handles incoming postMessage events for JWT token.
   * Validates origin and extracts token from message.
   */
  const receiveMessage = useCallback((event) => {
    try {
      logInfo('[JWT Auth] Received postMessage', { origin: event.origin, type: event.data?.type });

      // Validate message origin for security
      if (!validateMessageOrigin(event.origin)) {
        // Silently ignore messages from untrusted origins
        // Don't set error here as this is expected behavior
        logInfo('[JWT Auth] Message rejected - origin not whitelisted', { origin: event.origin });
        return;
      }

      const { data } = event;

      // Check if this is a JWT token message
      if (!data || data.type !== 'auth.jwt.token') {
        logInfo('[JWT Auth] Message ignored - not a JWT token message', { type: data?.type });
        return;
      }

      // Extract token from message
      const jwtToken = data.edx_jwt_token || data.token;

      if (!jwtToken) {
        setError('JWT token not found in message');
        setIsLoading(false);
        return;
      }

      // Validate token format (basic check - should start with typical JWT pattern)
      if (typeof jwtToken !== 'string' || jwtToken.trim().length === 0) {
        setError('Invalid JWT token format');
        setIsLoading(false);
        return;
      }

      // Store token in memory (state)
      const trimmedToken = jwtToken.trim();
      const tokenLength = trimmedToken.length;
      const tokenPreview = trimmedToken.substring(0, 20) + '...';

      logInfo('[JWT Auth] JWT token received', {
        tokenLength,
        tokenPreview,
        hasToken: !!trimmedToken,
      });

      setToken(trimmedToken);
      setError(null);
      setIsLoading(false);
      refreshRequestedRef.current = false; // Reset refresh request flag

      // Check if token is already expired
      if (isTokenExpired(trimmedToken)) {
        logError('[JWT Auth] Token is expired on receipt', { tokenPreview });
        setError('JWT token is expired');
        // Request new token
        requestTokenRefresh();
      } else {
        const timeUntilExpiration = getTimeUntilExpiration(trimmedToken);
        logInfo('[JWT Auth] Token is valid', {
          timeUntilExpirationMs: timeUntilExpiration,
          timeUntilExpirationMinutes: timeUntilExpiration ? Math.round(timeUntilExpiration / 60000) : null,
        });
        // Set up expiry check interval
        setupExpiryCheck(trimmedToken);
      }
    } catch (err) {
      console.error('Error processing JWT token message:', err);
      setError('Failed to process JWT token message');
      setIsLoading(false);
    }
  }, [requestTokenRefresh, setupExpiryCheck]);

  // Listen for postMessage events
  useEventListener('message', receiveMessage);

  // Log hook initialization with both console.log and logInfo
  useEffect(() => {
    const inIframe = window.self !== window.top;
    const logData = { inIframe };

    // Use console.log to ensure visibility even if logInfo doesn't work
    console.log('[JWT Auth] useJWTToken hook initialized - listening for JWT tokens via postMessage', logData);
    logInfo('[JWT Auth] useJWTToken hook initialized - listening for JWT tokens via postMessage', logData);
  }, []);

  /**
   * Clear the stored token.
   * Useful for logout or error recovery.
   */
  const clearToken = useCallback(() => {
    setToken(null);
    setError(null);
    setIsLoading(false);

    // Clear expiry check interval
    if (expiryCheckIntervalRef.current) {
      clearInterval(expiryCheckIntervalRef.current);
      expiryCheckIntervalRef.current = null;
    }

    refreshRequestedRef.current = false;
  }, []);

  // Set initial loading state timeout
  // If no token is received within a reasonable time, stop loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading && !token) {
        // No token received - this might be normal if cookies are available
        // Don't set error, just stop loading
        logInfo('[JWT Auth] No JWT token received within timeout - this is normal if cookies are available', {
          timeoutMs: 5000,
        });
        setIsLoading(false);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [isLoading, token]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (expiryCheckIntervalRef.current) {
        clearInterval(expiryCheckIntervalRef.current);
        expiryCheckIntervalRef.current = null;
      }
    };
  }, []);

  return {
    token,
    isLoading,
    error,
    requestTokenRefresh,
    clearToken,
  };
}

