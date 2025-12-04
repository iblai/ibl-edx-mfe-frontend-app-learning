import { useMemo } from 'react';
import { getConfig } from '@edx/frontend-platform';
import { logInfo } from '@edx/frontend-platform/logging';
import { isInIframe, hasSessionCookies } from '../utils/auth-utils';
import { useJWTToken } from './useJWTToken';
import { logAuthStateToServer } from '../utils/server-logger';

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

  // Check if JWT auth is enabled via feature flag OR test token is present
  const jwtAuthEnabled = useMemo(() => {
    const config = getConfig();
    // Enable JWT auth if feature flag is on OR if test token is present
    // Get test token from config (merged from env var) or directly from process.env
    const testToken = config?.JWT_TEST_TOKEN || process.env.JWT_TEST_TOKEN;
    const hasTestToken = !!testToken;
    const enabled = config.JWT_AUTH_ENABLED === true || hasTestToken;

    if (hasTestToken) {
      console.log('[JWT Auth] TEST MODE: JWT auth enabled due to test token', {
        tokenLength: testToken.length,
        tokenPreview: testToken.substring(0, 30) + '...',
        fullToken: testToken, // Log full token for testing verification
      });
      logInfo('[JWT Auth] TEST MODE: JWT auth enabled due to test token', {
        tokenLength: testToken.length,
        tokenPreview: testToken.substring(0, 30) + '...',
      });
    }

    return enabled;
  }, []);

  // Determine authentication mode
  const authMode = useMemo(() => {
    // TEST MODE: If test token exists, force JWT mode regardless of iframe/cookies
    const config = getConfig();
    // Get test token from config (merged from env var) or directly from process.env
    const testToken = config?.JWT_TEST_TOKEN || process.env.JWT_TEST_TOKEN;
    const hasTestToken = !!testToken;

    // Log token state for debugging
    console.log('[JWT Auth] Auth mode determination', {
      hasTestToken,
      hasJwtToken: !!jwtToken,
      jwtTokenLength: jwtToken ? jwtToken.length : 0,
      jwtTokenPreview: jwtToken ? jwtToken.substring(0, 30) + '...' : null,
      testTokenLength: testToken ? testToken.length : 0,
      testTokenPreview: testToken ? testToken.substring(0, 30) + '...' : null,
    });

    // TEST MODE: Force JWT if test token exists AND we're in an iframe
    // Direct access (not in iframe) should always use cookie-based auth, even with test token
    if (hasTestToken && inIframe) {
      // Use test token directly if jwtToken from hook is not available yet
      const tokenToUse = jwtToken || testToken;
      const logData = {
        mode: 'jwt',
        jwtAuthEnabled,
        inIframe,
        cookiesAvailable,
        hasJwtToken: !!jwtToken,
        hasTestToken: true,
        usingTestToken: !jwtToken,
        tokenLength: tokenToUse ? tokenToUse.length : 0,
        testMode: true,
      };
      console.log('[JWT Auth] TEST MODE: Forcing JWT authentication mode (in iframe)', logData);
      logInfo('[JWT Auth] Authentication mode determined (TEST MODE)', logData);
      return 'jwt';
    }

    // If test token exists but we're NOT in iframe, use cookie-based auth
    if (hasTestToken && !inIframe) {
      const logData = {
        mode: 'cookie',
        jwtAuthEnabled,
        inIframe: false,
        cookiesAvailable,
        hasJwtToken: !!jwtToken,
        hasTestToken: true,
        reason: 'direct access - test token ignored, using cookie auth',
      };
      console.log('[JWT Auth] TEST MODE: Test token present but direct access - using cookie auth', logData);
      logInfo('[JWT Auth] Authentication mode determined (TEST MODE - direct access)', logData);
      return 'cookie';
    }

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

  // In TEST MODE, use test token directly if jwtToken from hook is not available
  const config = getConfig();
  const testToken = config?.JWT_TEST_TOKEN || process.env.JWT_TEST_TOKEN;
  const tokenToUse = authMode === 'jwt'
    ? (jwtToken || testToken) // Use test token if jwtToken not available yet
    : null;

  const authState = {
    mode: authMode,
    jwtToken: tokenToUse,
    isInIframe: inIframe,
    hasCookies: cookiesAvailable,
    jwtLoading, // Expose loading state for components that need it
  };

  // Log the final token that will be used
  if (authMode === 'jwt' && tokenToUse) {
    console.log('[JWT Auth] Auth state - JWT token to use', {
      tokenLength: tokenToUse.length,
      tokenPreview: tokenToUse.substring(0, 30) + '...',
      isFromTestToken: tokenToUse === testToken,
      isFromHook: tokenToUse === jwtToken,
    });
  }

  // Log auth state changes to server for Docker log visibility
  useMemo(() => {
    logAuthStateToServer(authState);
  }, [authMode, inIframe, cookiesAvailable, jwtToken, jwtLoading]);

  return authState;
}

