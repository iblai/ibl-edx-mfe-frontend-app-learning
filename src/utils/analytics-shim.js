/**
 * Analytics shim for minimal render mode
 * Provides mock implementations of analytics functions when analytics module isn't initialized
 * This prevents "Cannot read properties of undefined (reading 'sendTrackEvent')" errors
 *
 * This module replaces @edx/frontend-platform/analytics via webpack alias
 *
 * CRITICAL: This must be loaded BEFORE any paragon components that use analytics
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

const mockSendPageEvent = function() {
  // Silent no-op
  return Promise.resolve();
};

// Create a comprehensive analytics object that handles all access patterns
// This matches the structure that paragon expects
const analyticsObject = {
  sendTrackEvent: mockSendTrackEvent,
  sendTrackingLogEvent: mockSendTrackingLogEvent,
  sendPageEvent: mockSendPageEvent,
};

// Use a Proxy to catch any property access that might fail
// This is critical for paragon components that might access analytics in unexpected ways
const analyticsProxy = new Proxy(analyticsObject, {
  get: function(target, prop) {
    // If property exists, return it
    if (prop in target) {
      return target[prop];
    }
    // For any other property access, return a safe function
    if (typeof prop === 'string' && prop.toLowerCase().includes('track')) {
      return mockSendTrackEvent;
    }
    // For 'default' property, return the proxy itself (for default exports)
    if (prop === 'default') {
      return analyticsProxy;
    }
    // Return undefined for other properties (safer than throwing)
    return undefined;
  },
  has: function(target, prop) {
    // Always return true for common analytics properties
    return prop in target ||
           prop === 'sendTrackEvent' ||
           prop === 'sendTrackingLogEvent' ||
           prop === 'sendPageEvent' ||
           prop === 'default';
  }
});

// Export mocks - match the structure of @edx/frontend-platform/analytics
// Support both named exports and default export
export const sendTrackEvent = mockSendTrackEvent;
export const sendTrackingLogEvent = mockSendTrackingLogEvent;
export const sendPageEvent = mockSendPageEvent;

// Also export as default to match how some modules might import it
// Paragon might import as: import analytics from '@edx/frontend-platform/analytics'
// Then access: analytics.sendTrackEvent
export default analyticsProxy;

  // Also set on window for global access (backup for runtime patching)
  if (typeof window !== 'undefined') {
    window.sendTrackEvent = mockSendTrackEvent;
    window.sendTrackingLogEvent = mockSendTrackingLogEvent;
    window.sendPageEvent = mockSendPageEvent;
    window.__EDX_ANALYTICS__ = analyticsProxy;

    // Also provide a global `analytics` object for libraries that expect Segment-style globals.
    // Some code paths (including Paragon/theme hooks) may call analytics.sendTrackEvent(...)
    // instead of importing from @edx/frontend-platform/analytics directly.
    if (!window.analytics) {
      window.analytics = {};
    }
    if (typeof window.analytics.sendTrackEvent !== 'function') {
      window.analytics.sendTrackEvent = mockSendTrackEvent;
    }
    if (typeof window.analytics.sendPageEvent !== 'function') {
      window.analytics.sendPageEvent = mockSendPageEvent;
    }
    // For safety, also provide a generic `track` method that some analytics clients expect.
    if (typeof window.analytics.track !== 'function') {
      window.analytics.track = function () {
        return Promise.resolve();
      };
    }

    // Log that shim is loaded (only once)
    if (!window.__ANALYTICS_SHIM_LOADED__) {
      console.log('[JWT Auth] Analytics shim loaded - sendTrackEvent, sendTrackingLogEvent, and sendPageEvent available');
      window.__ANALYTICS_SHIM_LOADED__ = true;
    }
  }

