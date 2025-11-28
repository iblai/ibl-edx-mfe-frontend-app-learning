import React from 'react';
import { useAuthMode } from './useAuthMode';
import { logInfo } from '@edx/frontend-platform/logging';

/**
 * Debug component to test JWT authentication hooks.
 * This component initializes the hooks so they start logging.
 * Can be removed or hidden in production.
 */
export function JWTAuthDebugger() {
  // Add explicit console.log that will definitely show
  React.useEffect(() => {
    // Use multiple console methods to ensure visibility
    console.log('[JWT Auth] JWTAuthDebugger component is mounting...');
    console.info('[JWT Auth] JWTAuthDebugger component is mounting...');
    console.warn('[JWT Auth] JWTAuthDebugger component is mounting...'); // Warning level is harder to filter
  }, []);

  const authMode = useAuthMode();

  // Log auth mode changes with both logInfo and console.log
  React.useEffect(() => {
    const logData = {
      mode: authMode.mode,
      isInIframe: authMode.isInIframe,
      hasCookies: authMode.hasCookies,
      jwtLoading: authMode.jwtLoading,
      hasJwtToken: !!authMode.jwtToken,
    };

    // Use both logging methods to ensure visibility
    console.log('[JWT Auth] JWTAuthDebugger component mounted', logData);
    logInfo('[JWT Auth] JWTAuthDebugger component mounted', logData);
  }, [authMode.mode, authMode.isInIframe, authMode.hasCookies, authMode.jwtLoading, authMode.jwtToken]);

  // This component doesn't render anything visible
  return null;
}

