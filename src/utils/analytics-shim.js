/**
 * Analytics shim for minimal render mode
 * Provides mock implementations of analytics functions when analytics module isn't initialized
 * This prevents "Cannot read properties of undefined (reading 'sendTrackEvent')" errors
 */

// Create mock functions
const mockSendTrackEvent = function() {
  // Silent no-op to avoid console spam
  // Components can call this safely even if analytics isn't initialized
};

const mockSendTrackingLogEvent = function() {
  // Silent no-op
};

// Export mocks
export const sendTrackEvent = mockSendTrackEvent;
export const sendTrackingLogEvent = mockSendTrackingLogEvent;

// Also set on window for global access
if (typeof window !== 'undefined') {
  window.sendTrackEvent = mockSendTrackEvent;
  window.sendTrackingLogEvent = mockSendTrackingLogEvent;
}

console.log('[JWT Auth] Analytics shim loaded');

