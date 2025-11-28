import React from 'react';
import { useAuthMode } from './useAuthMode';
import { logInfo } from '@edx/frontend-platform/logging';

/**
 * Debug component to test JWT authentication hooks.
 * This component initializes the hooks so they start logging.
 * Can be removed or hidden in production.
 */
export function JWTAuthDebugger() {
  const authMode = useAuthMode();

  // Log auth mode changes
  React.useEffect(() => {
    logInfo('[JWT Auth] JWTAuthDebugger component mounted', {
      mode: authMode.mode,
      isInIframe: authMode.isInIframe,
      hasCookies: authMode.hasCookies,
      jwtLoading: authMode.jwtLoading,
      hasJwtToken: !!authMode.jwtToken,
    });
  }, [authMode.mode, authMode.isInIframe, authMode.hasCookies, authMode.jwtLoading, authMode.jwtToken]);

  // This component doesn't render anything visible
  return null;
}

