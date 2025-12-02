/**
 * Analytics shim for minimal render mode
 * Provides mock implementations of analytics functions when analytics module isn't initialized
 * This prevents "Cannot read properties of undefined (reading 'sendTrackEvent')" errors
 *
 * This module replaces @edx/frontend-platform/analytics via webpack alias
 */

// Create mock functions that are safe to call
const mockSendTrackEvent = function() {
  // Silent no-op to avoid console spam
  // Components can call this safely even if analytics isn't initialized
  return Promise.resolve();
};

const mockSendTrackingLogEvent = function() {
  // Silent no-op
  return Promise.resolve();
};

// Export mocks - match the structure of @edx/frontend-platform/analytics
export const sendTrackEvent = mockSendTrackEvent;
export const sendTrackingLogEvent = mockSendTrackingLogEvent;

// Also export as default for cases where module is imported as default
const analyticsModule = {
  sendTrackEvent: mockSendTrackEvent,
  sendTrackingLogEvent: mockSendTrackingLogEvent,
};

// Default export for: import analytics from '@edx/frontend-platform/analytics'
export default analyticsModule;

// Also set on window for global access (backup)
if (typeof window !== 'undefined') {
  window.sendTrackEvent = mockSendTrackEvent;
  window.sendTrackingLogEvent = mockSendTrackingLogEvent;
  window.__EDX_ANALYTICS__ = analyticsModule;
}

console.log('[JWT Auth] Analytics shim loaded - sendTrackEvent and sendTrackingLogEvent available');

