import { useMemo } from 'react';
import { getConfig } from '@edx/frontend-platform';
import { logInfo } from '@edx/frontend-platform/logging';
import { isInIframe, hasSessionCookies } from '../utils/auth-utils';
import { useJWTToken } from './useJWTToken';

/**
 * React hook that determines the authentication mode to use.
 *
 * Decision logic:
 * - If in iframe AND no cookies available AND JWT token available → use JWT
 * - Otherwise → use cookie-based authentication
 *
 * @returns {Object} Object containing:
 *   - mode: 'cookie' | 'jwt' - The authentication mode to use
 *   - jwtToken: string | null - The JWT token if in JWT mode, null otherwise
 *   - isInIframe: boolean - Whether running in iframe context
 *   - hasCookies: boolean - Whether session cookies are available
 */
export function useAuthMode() {
  const { token: jwtToken, isLoading: jwtLoading } = useJWTToken();

  // Determine if we're in an iframe
  const inIframe = useMemo(() => isInIframe(), []);

  // Check if session cookies are available
  const cookiesAvailable = useMemo(() => hasSessionCookies(), []);

  // Check if JWT auth is enabled via feature flag
  const jwtAuthEnabled = useMemo(() => {
    const config = getConfig();
    return config.JWT_AUTH_ENABLED === true;
  }, []);

  // Determine authentication mode
  const authMode = useMemo(() => {
    // Only use JWT if feature is enabled
    if (jwtAuthEnabled && inIframe && !cookiesAvailable && jwtToken) {
      const logData = {
        mode: 'jwt',
        jwtAuthEnabled,
        inIframe,
        cookiesAvailable,
        hasJwtToken: !!jwtToken,
      };
      console.log('[JWT Auth] Authentication mode determined', logData);
      logInfo('[JWT Auth] Authentication mode determined', logData);
      return 'jwt';
    }

    // Default to cookie-based authentication
    // This covers:
    // - JWT auth feature is disabled
    // - Not in iframe (direct access)
    // - In iframe but cookies are available (same-origin or SameSite allows)
    // - In iframe but no JWT token received yet
    const logData = {
      mode: 'cookie',
      jwtAuthEnabled,
      inIframe,
      cookiesAvailable,
      hasJwtToken: !!jwtToken,
      reason: !jwtAuthEnabled ? 'feature disabled' :
              !inIframe ? 'not in iframe' :
              cookiesAvailable ? 'cookies available' :
              !jwtToken ? 'no JWT token' : 'unknown',
    };
    console.log('[JWT Auth] Authentication mode determined', logData);
    logInfo('[JWT Auth] Authentication mode determined', logData);
    return 'cookie';
  }, [jwtAuthEnabled, inIframe, cookiesAvailable, jwtToken]);

  return {
    mode: authMode,
    jwtToken: authMode === 'jwt' ? jwtToken : null,
    isInIframe: inIframe,
    hasCookies: cookiesAvailable,
    jwtLoading, // Expose loading state for components that need it
  };
}

