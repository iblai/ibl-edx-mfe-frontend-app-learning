import React from 'react';
import { useAuthMode } from './useAuthMode';

/**
 * Debug component to test JWT authentication hooks.
 * Silent in production - only initializes hooks.
 */
export function JWTAuthDebugger() {
  // Initialize auth mode hook - no logging in production
  useAuthMode();

  // This component doesn't render anything visible
  return null;
}

