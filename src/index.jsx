import {
  APP_INIT_ERROR, APP_READY, subscribe, initialize,
  mergeConfig,
  getConfig,
} from '@edx/frontend-platform';
import { AppProvider, ErrorPage, PageWrap } from '@edx/frontend-platform/react';
import { IntlProvider } from '@edx/frontend-platform/i18n';
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Routes, Route } from 'react-router-dom';

// PHASE 3, STEP 6: Mock analytics module at import level and runtime
// This ensures sendTrackEvent is available when components import it
// Components import: import { sendTrackEvent } from '@edx/frontend-platform/analytics'

// Create mock functions
const mockSendTrackEvent = function() {
  // Silent no-op to avoid console spam
  return Promise.resolve();
};

const mockSendTrackingLogEvent = function() {
  // Silent no-op
  return Promise.resolve();
};

// Create a proxy-based analytics object that always returns mocks
// This intercepts ALL property access, even if the module is undefined
const createAnalyticsProxy = () => {
  return new Proxy({}, {
    get: function(target, prop) {
      if (prop === 'sendTrackEvent') {
        return mockSendTrackEvent;
      }
      if (prop === 'sendTrackingLogEvent') {
        return mockSendTrackingLogEvent;
      }
      if (prop === 'default') {
        // Return proxy for default export
        return createAnalyticsProxy();
      }
      // For any other property, return undefined (or another proxy)
      return undefined;
    },
    has: function(target, prop) {
      return prop === 'sendTrackEvent' || prop === 'sendTrackingLogEvent' || prop === 'default';
    }
  });
};

// CRITICAL: Patch analytics BEFORE any imports that might use it
// This must happen at the very top of the file, before React or any components load
// Paragon components (like useTrackColorSchemeChoice) may import analytics during module initialization

// Global patch function that can be called multiple times
const patchAnalyticsGlobally = () => {
  try {
    // Strategy 1: Patch require.cache if available (most reliable for CommonJS)
    if (typeof require !== 'undefined' && require.cache) {
      Object.keys(require.cache).forEach((key) => {
        if (key.includes('frontend-platform') && key.includes('analytics')) {
          try {
            const cachedModule = require.cache[key];
            if (cachedModule && cachedModule.exports) {
              // Patch named exports
              if (!cachedModule.exports.sendTrackEvent || typeof cachedModule.exports.sendTrackEvent !== 'function') {
                cachedModule.exports.sendTrackEvent = mockSendTrackEvent;
              }
              if (!cachedModule.exports.sendTrackingLogEvent || typeof cachedModule.exports.sendTrackingLogEvent !== 'function') {
                cachedModule.exports.sendTrackingLogEvent = mockSendTrackingLogEvent;
              }
              // Patch default export
              if (cachedModule.exports.default) {
                if (!cachedModule.exports.default.sendTrackEvent || typeof cachedModule.exports.default.sendTrackEvent !== 'function') {
                  cachedModule.exports.default.sendTrackEvent = mockSendTrackEvent;
                }
                if (!cachedModule.exports.default.sendTrackingLogEvent || typeof cachedModule.exports.default.sendTrackingLogEvent !== 'function') {
                  cachedModule.exports.default.sendTrackingLogEvent = mockSendTrackingLogEvent;
                }
              } else {
                // If no default export, create one
                cachedModule.exports.default = {
                  sendTrackEvent: mockSendTrackEvent,
                  sendTrackingLogEvent: mockSendTrackingLogEvent,
                };
              }
            }
          } catch (e) {
            // Ignore errors for individual modules
          }
        }
      });
    }
  } catch (e) {
    // Ignore if require.cache is not available
  }

  // Strategy 2: Try to require and patch directly
  try {
    const analyticsModule = require('@edx/frontend-platform/analytics');
    if (analyticsModule) {
      if (!analyticsModule.sendTrackEvent || typeof analyticsModule.sendTrackEvent !== 'function') {
        analyticsModule.sendTrackEvent = mockSendTrackEvent;
      }
      if (!analyticsModule.sendTrackingLogEvent || typeof analyticsModule.sendTrackingLogEvent !== 'function') {
        analyticsModule.sendTrackingLogEvent = mockSendTrackingLogEvent;
      }
      if (analyticsModule.default) {
        if (!analyticsModule.default.sendTrackEvent || typeof analyticsModule.default.sendTrackEvent !== 'function') {
          analyticsModule.default.sendTrackEvent = mockSendTrackEvent;
        }
        if (!analyticsModule.default.sendTrackingLogEvent || typeof analyticsModule.default.sendTrackingLogEvent !== 'function') {
          analyticsModule.default.sendTrackingLogEvent = mockSendTrackingLogEvent;
        }
      }
    }
  } catch (e) {
    // Module might not be available yet - that's okay
  }

  // Strategy 3: Set global window properties as backup
  if (typeof window !== 'undefined') {
    window.sendTrackEvent = mockSendTrackEvent;
    window.sendTrackingLogEvent = mockSendTrackingLogEvent;
  }
};

// Patch immediately at import time
patchAnalyticsGlobally();

// Try to mock the analytics module at import time
try {
  const analyticsModule = require('@edx/frontend-platform/analytics');
  if (analyticsModule) {
    // If module exists but sendTrackEvent is undefined, add mock
    if (!analyticsModule.sendTrackEvent || typeof analyticsModule.sendTrackEvent !== 'function') {
      analyticsModule.sendTrackEvent = mockSendTrackEvent;
      console.log('[JWT Auth] Mocked sendTrackEvent in analytics module (import time)');
    }
    if (!analyticsModule.sendTrackingLogEvent || typeof analyticsModule.sendTrackingLogEvent !== 'function') {
      analyticsModule.sendTrackingLogEvent = mockSendTrackingLogEvent;
      console.log('[JWT Auth] Mocked sendTrackingLogEvent in analytics module (import time)');
    }
  } else {
    // Module is undefined - replace it with proxy
    console.warn('[JWT Auth] Analytics module is undefined at import time - will use proxy');
  }
} catch (e) {
  // Module might not be available yet - that's okay, we'll patch at runtime
  console.warn('[JWT Auth] Could not mock analytics module at import time:', e.message);
}

  // Also patch at runtime after modules load (for cases where webpack alias doesn't work)
  // Use multiple strategies to ensure analytics is mocked
  if (typeof window !== 'undefined') {
    // Use the global patch function
    // Patch immediately
    patchAnalyticsGlobally();

    // Strategy 2: Patch after a short delay (for modules that load asynchronously)
    setTimeout(patchAnalyticsGlobally, 0);
    setTimeout(patchAnalyticsGlobally, 100);
    setTimeout(patchAnalyticsGlobally, 500);
    setTimeout(patchAnalyticsGlobally, 1000);

  // Strategy 3: Intercept require.cache if available (CommonJS)
  if (typeof require !== 'undefined' && require.cache) {
    const originalRequire = require;
    const analyticsPath = '@edx/frontend-platform/analytics';

    // Try to find and patch the cached module
    Object.keys(require.cache).forEach((key) => {
      if (key.includes('frontend-platform') && key.includes('analytics')) {
        try {
          const cachedModule = require.cache[key];
          if (cachedModule && cachedModule.exports) {
            if (!cachedModule.exports.sendTrackEvent || typeof cachedModule.exports.sendTrackEvent !== 'function') {
              cachedModule.exports.sendTrackEvent = mockSendTrackEvent;
              console.log('[JWT Auth] Patched sendTrackEvent in require.cache:', key);
            }
            if (!cachedModule.exports.sendTrackingLogEvent || typeof cachedModule.exports.sendTrackingLogEvent !== 'function') {
              cachedModule.exports.sendTrackingLogEvent = mockSendTrackingLogEvent;
              console.log('[JWT Auth] Patched sendTrackingLogEvent in require.cache:', key);
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }
    });
  }
}

import { Helmet } from 'react-helmet';
import { fetchDiscussionTab, fetchLiveTab } from './course-home/data/thunks';
import DiscussionTab from './course-home/discussion-tab/DiscussionTab';

import messages from './i18n';
import { UserMessagesProvider } from './generic/user-messages';

import './index.scss';
import OutlineTab from './course-home/outline-tab';
import { CourseExit } from './courseware/course/course-exit';
import CoursewareContainer from './courseware';
import CoursewareRedirectLandingPage from './courseware/CoursewareRedirectLandingPage';
import DatesTab from './course-home/dates-tab';
import GoalUnsubscribe from './course-home/goal-unsubscribe';
import ProgressTab from './course-home/progress-tab/ProgressTab';
import ProgressTabMinimal from './course-home/progress-tab/ProgressTabMinimal';
// ProgressTabMinimal fetches data and stores in Redux, then renders ProgressTab
import { TabContainer } from './tab-page';

import { fetchDatesTab, fetchOutlineTab, fetchProgressTab } from './course-home/data';
import { fetchCourse } from './courseware/data';
import { store } from './store';
import NoticesProvider from './generic/notices';
import PathFixesProvider from './generic/path-fixes';
import LiveTab from './course-home/live-tab/LiveTab';
import CourseAccessErrorPage from './generic/CourseAccessErrorPage';
import DecodePageRoute from './decode-page-route';
import { DECODE_ROUTES, ROUTES } from './constants';
import PreferencesUnsubscribe from './preferences-unsubscribe';
import PageNotFound from './generic/PageNotFound';
import { JWTAuthDebugger } from './hooks/JWTAuthDebugger';
import { AuthenticatedHttpClientProvider } from './contexts/AuthenticatedHttpClientContext';
import { setupAuthInterceptor, setGlobalAuthState } from './utils/setupAuthInterceptor';
import { logInfo } from '@edx/frontend-platform/logging';
import { setupGlobalErrorHandlers, logInitializationMilestone } from './utils/error-logging';
import { ErrorBoundary } from './components/ErrorBoundary';

// Safe wrapper for getAuthenticatedUser that handles module initialization issues
// The @edx/frontend-platform/auth module may not be initialized immediately after initialize() returns
// We use dynamic import to safely access the module without causing initialization errors
let authModulePromise = null;
let authModuleCache = null;

// Try to get authenticated user safely, handling module initialization issues
async function getAuthenticatedUserSafely() {
  try {
    // Try dynamic import if we haven't cached the module yet
    if (!authModuleCache) {
      if (!authModulePromise) {
        authModulePromise = import('@edx/frontend-platform/auth').catch((error) => {
          console.error('[JWT Auth] Failed to import auth module:', error);
          return null;
        });
      }

      const authModule = await authModulePromise;
      if (!authModule) {
        return { error: 'Auth module import failed', available: false };
      }

      if (!authModule.getAuthenticatedUser || typeof authModule.getAuthenticatedUser !== 'function') {
        return { error: 'getAuthenticatedUser function not found in auth module', available: false };
      }

      authModuleCache = authModule;
    }

    // Now try to call getAuthenticatedUser
    const user = authModuleCache.getAuthenticatedUser();
    return { user, available: true, error: null };
  } catch (error) {
    return { error: error.message, available: false, errorStack: error.stack };
  }
}

// Synchronous version that returns a promise-like result immediately
// This is used in places where we can't use async/await
function getAuthenticatedUserSafelySync() {
  try {
    // Try to access the module synchronously (may fail if not initialized)
    // eslint-disable-next-line import/no-unresolved
    let authModule;
    try {
      authModule = require('@edx/frontend-platform/auth');
    } catch (requireError) {
      return {
        error: `Failed to require auth module: ${requireError.message}`,
        available: false,
        errorStack: requireError.stack,
      };
    }

    // Check if module exists
    if (!authModule) {
      return { error: 'Auth module is undefined after require', available: false };
    }

    // Log module structure for debugging
    const moduleKeys = Object.keys(authModule);
    const hasGetAuthenticatedUser = 'getAuthenticatedUser' in authModule;
    const getAuthenticatedUserType = typeof authModule.getAuthenticatedUser;

    // Check if getAuthenticatedUser exists and is a function
    if (!hasGetAuthenticatedUser) {
      return {
        error: `getAuthenticatedUser not found in auth module. Available keys: ${moduleKeys.join(', ')}`,
        available: false,
        moduleKeys,
      };
    }

    if (getAuthenticatedUserType !== 'function') {
      return {
        error: `getAuthenticatedUser exists but is not a function (type: ${getAuthenticatedUserType})`,
        available: false,
        moduleKeys,
        getAuthenticatedUserType,
      };
    }

    // Now try to call it - wrap in try-catch in case it throws
    try {
      const user = authModule.getAuthenticatedUser();
      return { user, available: true, error: null, moduleKeys };
    } catch (callError) {
      return {
        error: `getAuthenticatedUser() threw error: ${callError.message}`,
        available: false,
        errorStack: callError.stack,
        moduleKeys,
      };
    }
  } catch (error) {
    return {
      error: `Unexpected error in getAuthenticatedUserSafelySync: ${error.message}`,
      available: false,
      errorStack: error.stack,
    };
  }
}

// Safe helper to get global auth state without causing ReferenceError
// Wraps require() in try-catch to handle module initialization issues
function getGlobalAuthStateSafely() {
  try {
    const { getGlobalAuthState } = require('./utils/setupAuthInterceptor');
    return getGlobalAuthState();
  } catch (error) {
    // Module not initialized yet or circular dependency issue
    // Return default state
    return {
      mode: 'cookie',
      jwtToken: null,
    };
  }
}

// Set up global error handlers IMMEDIATELY - before anything else runs
// This catches errors that occur before React mounts
try {
  setupGlobalErrorHandlers();
  logInitializationMilestone('index.jsx loaded - global error handlers installed', {
    documentReadyState: document.readyState,
    hasRootElement: !!document.getElementById('root'),
    url: window.location.href,
    referrer: document.referrer,
    inIframe: window.self !== window.top,
  });
} catch (error) {
  // Even if error logging setup fails, try to log it
  console.error('[CRITICAL] Failed to setup error logging:', error);
  try {
    setupGlobalErrorHandlers();
  } catch (e) {
    console.error('[CRITICAL] Failed to setup error handlers:', e);
  }
}

// Set up global auth interceptor before app initializes
// This allows API functions to use getAuthenticatedHttpClient() without modification
let interceptorCleanup = null;

// MINIMAL RENDER MODE: Bypass all providers and complex code to render static page
// This is a temporary simplified version to get the iframe working first
const MINIMAL_RENDER_MODE = process.env.MINIMAL_RENDER_MODE !== 'false'; // Default to true

// Override/mock functions that might be called but aren't available
// This prevents errors from breaking the minimal render
if (MINIMAL_RENDER_MODE) {
  if (typeof window !== 'undefined') {
    // Mock tracking functions that might be called
    window.sendTrackEvent = window.sendTrackEvent || function() {
      console.log('[JWT Auth] Mock sendTrackEvent called (no-op)', arguments);
    };

    // Analytics module is mocked in index.html before modules load
    // This ensures sendTrackEvent is available when components import it
    // The mock is set up in public/index.html as window.__EDX_ANALYTICS_MOCK__

    // Mock any logging functions that might fail
    if (!window.__EDX_LOGGING__) {
      window.__EDX_LOGGING__ = {};
    }
    window.__EDX_LOGGING__.logErrorDetails = window.__EDX_LOGGING__.logErrorDetails || function() {
      console.log('[JWT Auth] Mock logErrorDetails called (no-op)', arguments);
    };

    // Mock getConfig if it's not available yet
    try {
      if (!getConfig || typeof getConfig !== 'function') {
        window.__MOCK_GET_CONFIG__ = function() {
          return {
            FAVICON_URL: '/favicon.ico',
            // Add other config values as needed
          };
        };
      }
    } catch (e) {
      // getConfig might not be available yet, that's okay
    }
  }

  console.log('[JWT Auth] MINIMAL_RENDER_MODE enabled - bypassing all providers and complex code');
}

// Simple ErrorBoundary that doesn't depend on frontend-platform
// Prevents infinite loops by only logging errors once
class SimpleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0 };
    this.errorLogged = false;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }

  componentDidCatch(error, errorInfo) {
    // Only log error once to prevent console spam
    if (!this.errorLogged) {
      console.error('[JWT Auth] SimpleErrorBoundary caught error:', error, errorInfo);
      this.errorLogged = true;
    }

    // Prevent infinite loops - reset error state after a delay
    if (this.state.errorCount < 3) {
      setTimeout(() => {
        this.setState({ hasError: false, error: null, errorCount: this.state.errorCount + 1 });
        this.errorLogged = false;
      }, 100);
    }
  }

  render() {
    // If we've had too many errors, show fallback instead of rendering children
    if (this.state.errorCount >= 3) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', color: '#dc3545' }}>
            Error: Component failed to render after multiple attempts
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
            Check console for details
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      // Log warning only once
      if (!this.errorLogged) {
        console.warn('[JWT Auth] ErrorBoundary caught error but rendering anyway:', this.state.error);
      }
      // Return null to break the loop, or show a fallback
      return null;
    }
    return this.props.children;
  }
}

// Shared function to render React app - called from both APP_READY and APP_INIT_ERROR (when allowing continue)
let reactRoot = null;
function renderReactApp() {
  // Prevent double rendering
  if (reactRoot) {
    console.warn('[JWT Auth] React app already rendered, skipping duplicate render');
    return;
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('[JWT Auth] Cannot render React app - root element not found');
    return;
  }

  logInitializationMilestone('About to render React app');

  // MINIMAL RENDER MODE: Just render ProgressTab directly, no providers, no routing
  if (MINIMAL_RENDER_MODE) {
    console.log('[JWT Auth] Using MINIMAL_RENDER_MODE - rendering ProgressTabMinimal with JWT data fetching');
    console.log('[JWT Auth] Root element:', rootElement);

    // CRITICAL: Patch analytics module RIGHT BEFORE React renders
    // This ensures sendTrackEvent is available when components try to use it
    // Use the global patch function for consistency
    console.log('[JWT Auth] Pre-render: Patching analytics globally');
    patchAnalyticsGlobally();
    console.log('[JWT Auth] Pre-render: Analytics patching complete');

    // Ensure auth interceptor is set up for JWT token support
    if (!interceptorCleanup) {
      try {
        console.log('[JWT Auth] Setting up auth interceptor for minimal mode');
        interceptorCleanup = setupAuthInterceptor();
        console.log('[JWT Auth] Auth interceptor set up successfully');
      } catch (interceptorError) {
        console.error('[JWT Auth] Failed to setup auth interceptor in minimal mode:', interceptorError);
        // Continue anyway - ProgressTabMinimal will handle errors
      }
    }

    try {
      reactRoot = createRoot(rootElement);

      // PHASE 1, STEP 1: Add Redux Store Provider
      // PHASE 3, STEP 7: Add IntlProvider for i18n (useIntl hook)
      // This enables useModel() hook and useIntl() hook that ProgressTab needs
      reactRoot.render(
        <SimpleErrorBoundary>
          <IntlProvider locale="en" messages={messages}>
            <AppProvider store={store}>
              <div style={{ minHeight: '100vh', padding: '20px', backgroundColor: '#f5f5f5' }}>
                <ProgressTabMinimal />
              </div>
            </AppProvider>
          </IntlProvider>
        </SimpleErrorBoundary>
      );

      console.log('[JWT Auth] React app rendered successfully (minimal mode with Redux store)');
      logInitializationMilestone('React app rendered (minimal mode - Phase 1, Step 1: Redux store added)');
    } catch (renderError) {
      console.error('[JWT Auth] Error rendering React app (minimal mode):', renderError);
      // Fallback: try to render directly to DOM
      try {
        rootElement.innerHTML = '<div style="padding: 20px; text-align: center; font-size: 24px; color: green;">Progress page iframed successfully (fallback render)</div>';
        console.log('[JWT Auth] Used fallback DOM render');
      } catch (fallbackError) {
        console.error('[JWT Auth] Fallback render also failed:', fallbackError);
      }
    }
    return;
  }

  // FULL RENDER MODE: Original complex render with all providers
  reactRoot = createRoot(rootElement);

  reactRoot.render(
    <StrictMode>
      <ErrorBoundary>
      <AppProvider store={store}>
        <Helmet>
          <link rel="shortcut icon" href={getConfig().FAVICON_URL} type="image/x-icon" />
        </Helmet>
        <PathFixesProvider>
          <NoticesProvider>
              <AuthenticatedHttpClientProvider>
            <UserMessagesProvider>
                  <JWTAuthDebugger />
              <div className="app-container">
                <Routes>
                  <Route path="*" element={<PageWrap><PageNotFound /></PageWrap>} />
                  <Route path={ROUTES.UNSUBSCRIBE} element={<PageWrap><GoalUnsubscribe /></PageWrap>} />
                  <Route path={ROUTES.REDIRECT} element={<PageWrap><CoursewareRedirectLandingPage /></PageWrap>} />
                  <Route
                    path={ROUTES.PREFERENCES_UNSUBSCRIBE}
                    element={
                      <PageWrap><PreferencesUnsubscribe /></PageWrap>
                    }
                  />
                  <Route
                    path={DECODE_ROUTES.ACCESS_DENIED}
                    element={<DecodePageRoute><CourseAccessErrorPage /></DecodePageRoute>}
                  />
                  <Route
                    path={DECODE_ROUTES.HOME}
                    element={(
                      <DecodePageRoute>
                        <TabContainer tab="outline" fetch={fetchOutlineTab} slice="courseHome">
                          <OutlineTab />
                        </TabContainer>
                      </DecodePageRoute>
                    )}
                  />
                  <Route
                    path={DECODE_ROUTES.LIVE}
                    element={(
                      <DecodePageRoute>
                        <TabContainer tab="lti_live" fetch={fetchLiveTab} slice="courseHome">
                          <LiveTab />
                        </TabContainer>
                      </DecodePageRoute>
                    )}
                  />
                  <Route
                    path={DECODE_ROUTES.DATES}
                    element={(
                      <DecodePageRoute>
                        <TabContainer tab="dates" fetch={fetchDatesTab} slice="courseHome">
                          <DatesTab />
                        </TabContainer>
                      </DecodePageRoute>
                    )}
                  />
                  <Route
                    path={DECODE_ROUTES.DISCUSSION}
                    element={(
                      <DecodePageRoute>
                        <TabContainer tab="discussion" fetch={fetchDiscussionTab} slice="courseHome">
                          <DiscussionTab />
                        </TabContainer>
                      </DecodePageRoute>
                    )}
                  />
                  {DECODE_ROUTES.PROGRESS.map((route) => (
                    <Route
                      key={route}
                      path={route}
                      element={(
                        <DecodePageRoute>
                            <ProgressTab />
                        </DecodePageRoute>
                      )}
                    />
                  ))}
                  <Route
                    path={DECODE_ROUTES.COURSE_END}
                    element={(
                      <DecodePageRoute>
                        <TabContainer tab="courseware" fetch={fetchCourse} slice="courseware">
                          <CourseExit />
                        </TabContainer>
                      </DecodePageRoute>
                    )}
                  />
                  {DECODE_ROUTES.COURSEWARE.map((route) => (
                    <Route
                      key={route}
                      path={route}
                      element={(
                        <DecodePageRoute>
                          <CoursewareContainer />
                        </DecodePageRoute>
                      )}
                    />
                  ))}
                </Routes>
              </div>
            </UserMessagesProvider>
            </AuthenticatedHttpClientProvider>
          </NoticesProvider>
        </PathFixesProvider>
      </AppProvider>
      </ErrorBoundary>
    </StrictMode>,
  );

  logInitializationMilestone('React app rendered');
}

// APP_READY handler - renders React app when frontend-platform is ready
subscribe(APP_READY, () => {
  window.__APP_READY_FIRED__ = true;
  logInitializationMilestone('APP_READY event fired');

  // Initialize global auth interceptor
  // This sets up interceptors on getAuthenticatedHttpClient() to handle JWT tokens
  // Use setTimeout to ensure frontend-platform is fully initialized
  if (!interceptorCleanup) {
    try {
      // Get config to check for test token
      const config = getConfig();
      const testToken = config?.JWT_TEST_TOKEN || process.env.JWT_TEST_TOKEN;
      const isInIframe = window.self !== window.top;
      const jwtAuthEnabled = config?.JWT_AUTH_ENABLED === 'true' || !!testToken;

      // Check current global auth state (safely)
      const currentAuthState = getGlobalAuthStateSafely();

      console.log('[JWT Auth] Initializing global auth interceptor on APP_READY', {
        jwtAuthEnabled,
        isInIframe,
        hasTestToken: !!testToken,
        testTokenLength: testToken ? testToken.length : 0,
        testTokenPreview: testToken ? testToken.substring(0, 30) + '...' : null,
        originWhitelist: config?.JWT_AUTH_ORIGIN_WHITELIST,
        currentAuthState: {
          mode: currentAuthState.mode,
          hasToken: !!currentAuthState.jwtToken,
          tokenLength: currentAuthState.jwtToken ? currentAuthState.jwtToken.length : 0,
        },
      });
      logInfo('[JWT Auth] Initializing global auth interceptor on APP_READY', {
        jwtAuthEnabled,
        isInIframe,
        hasTestToken: !!testToken,
        testTokenLength: testToken ? testToken.length : 0,
        originWhitelist: config?.JWT_AUTH_ORIGIN_WHITELIST,
        currentAuthState: {
          mode: currentAuthState.mode,
          hasToken: !!currentAuthState.jwtToken,
        },
      });

      // If in JWT iframe mode and we have a token, ensure global state is set
      if (isInIframe && jwtAuthEnabled) {
        if (testToken) {
          console.log('[JWT Auth] Setting global auth state to JWT mode with test token on APP_READY');
          setGlobalAuthState('jwt', testToken);
        } else if (window.__JWT_TOKEN__) {
          console.log('[JWT Auth] Setting global auth state to JWT mode with window token on APP_READY');
          setGlobalAuthState('jwt', window.__JWT_TOKEN__);
        } else if (currentAuthState.mode !== 'jwt') {
          console.log('[JWT Auth] JWT iframe mode but no token yet - will be set by AuthenticatedHttpClientProvider when token arrives');
        }
      }

      interceptorCleanup = setupAuthInterceptor();
    } catch (error) {
      // If interceptor setup fails, log but don't block app initialization
      console.error('[JWT Auth] Failed to setup auth interceptor:', error);
    }
  }

  // Render React app
  renderReactApp();
});

subscribe(APP_INIT_ERROR, (error) => {
  // Log immediately when handler is called - this happens first
  console.error('[JWT Auth] APP_INIT_ERROR handler called - FIRST LOG', {
    error,
    errorType: typeof error,
    errorConstructor: error?.constructor?.name,
    errorKeys: error && typeof error === 'object' ? Object.keys(error) : [],
    errorString: String(error),
    timestamp: new Date().toISOString(),
  });

  // Store the error immediately for later reference
  window.__FRONTEND_PLATFORM_INIT_ERROR__ = error;
  // Note: frontend-platform may pass the event name string instead of an Error object
  // The actual error might be in a different format or stored elsewhere
  const isEventNameString = typeof error === 'string' && error === 'APP.INIT_ERROR';

  // EARLY CHECK: If we're in JWT iframe mode with a token, allow app to continue
  // This prevents error page from showing when we have working JWT authentication
  // Check for token WITHOUT requiring any modules to avoid ReferenceError during initialization
  const isInIframe = window.self !== window.top;
  const jwtAuthEnabled = process.env.JWT_AUTH_ENABLED === 'true' || !!process.env.JWT_TEST_TOKEN;
  const isJWTIframeMode = isInIframe && jwtAuthEnabled;

  if (isJWTIframeMode) {
    // Check for JWT token in multiple ways without requiring modules
    // This avoids ReferenceError if modules aren't initialized yet
    let hasJwtToken = false;
    let tokenSource = 'none';

    // Check test token first (safest - no module dependencies)
    const testToken = process.env.JWT_TEST_TOKEN || window.__JWT_TOKEN__;
    if (testToken) {
      hasJwtToken = true;
      tokenSource = 'test/env';
    }

    // Try to check global auth state (may fail if module not initialized)
    try {
      const globalAuthState = getGlobalAuthStateSafely();
      if (globalAuthState.mode === 'jwt' && globalAuthState.jwtToken) {
        hasJwtToken = true;
        tokenSource = 'globalState';
      }
    } catch (e) {
      // Module not initialized yet - that's okay, we'll use test token if available
      console.warn('[JWT Auth] APP_INIT_ERROR - Could not check global auth state (module not initialized):', e.message);
    }

    // Also check window.__LAST_ERROR__ to see if it's a ReferenceError (expected during init)
    const lastError = window.__LAST_ERROR__;
    const isReferenceError = lastError?.name === 'ReferenceError' ||
                             lastError?.message?.includes('before initialization') ||
                             String(error).includes('ReferenceError') ||
                             String(error).includes('before initialization');

    if (hasJwtToken || isReferenceError) {
      console.warn('[JWT Auth] APP_INIT_ERROR - Allowing app to continue in JWT iframe mode', {
        hasJwtToken,
        tokenSource,
        isReferenceError,
        errorString: String(error),
        lastErrorName: lastError?.name,
        lastErrorMessage: lastError?.message,
      });
      // Don't render error page - force render React app now
      // APP_READY might not fire after APP_INIT_ERROR, so we render directly
      setTimeout(() => {
        if (!window.__APP_READY_FIRED__) {
          console.warn('[JWT Auth] APP_READY did not fire after APP_INIT_ERROR - forcing React render');
          renderReactApp();
        }
      }, 100);
      return;
    }
  }

  // Capture all possible error information
  const errorDetails = {
    // Standard Error properties
    message: error?.message,
    name: error?.name,
    stack: error?.stack,
    // String representation
    errorString: String(error),
    errorType: typeof error,
    isEventNameString,
    // If error is an object, try to capture all properties
    errorKeys: error && typeof error === 'object' ? Object.keys(error) : [],
    errorJSON: null,
    // Check for common error storage locations
    windowError: window.__INIT_ERROR__ || null,
    lastError: window.lastError || null,
    frontendPlatformError: window.__FRONTEND_PLATFORM_INIT_ERROR__ || null,
  };

  // Try to stringify the error (may fail for circular references)
  try {
    errorDetails.errorJSON = JSON.stringify(error, Object.getOwnPropertyNames(error));
  } catch (e) {
    errorDetails.errorJSON = `[Could not stringify error: ${e.message}]`;
  }

  // Log detailed error information
  console.error('[JWT Auth] APP_INIT_ERROR - Detailed error information:', errorDetails);
  logInitializationMilestone('APP_INIT_ERROR event fired', errorDetails);

  // Also log the raw error object
  console.error('[JWT Auth] APP_INIT_ERROR - Raw error object:', error);
  console.error('[JWT Auth] APP_INIT_ERROR - Error constructor:', error?.constructor?.name);

  // If error is just the event name string, check for actual error elsewhere
  if (isEventNameString) {
    console.error('[JWT Auth] APP_INIT_ERROR - Error is event name string, checking for actual error...');
    console.error('[JWT Auth] APP_INIT_ERROR - window.onerror last error:', window.__LAST_ERROR__);
    console.error('[JWT Auth] APP_INIT_ERROR - window.__INIT_ERROR__:', window.__INIT_ERROR__);
    console.error('[JWT Auth] APP_INIT_ERROR - document.referrer:', document.referrer);
    console.error('[JWT Auth] APP_INIT_ERROR - window.location.origin:', window.location.origin);
    // Safely get parent origin - accessing window.parent.location throws SecurityError in cross-origin iframes
    let parentOrigin = 'unknown';
    let hasSecurityError = false;
    try {
      if (window.parent !== window) {
        try {
          parentOrigin = window.parent.location.origin;
        } catch (e) {
          // SecurityError: Cannot access parent.location in cross-origin iframe
          // This is expected in cross-origin iframes and not a real error
          parentOrigin = 'cross-origin (blocked by browser security)';
          if (e.name === 'SecurityError') {
            hasSecurityError = true;
            console.warn('[JWT Auth] APP_INIT_ERROR - SecurityError accessing parent.location (expected in cross-origin iframe)');
          }
        }
      } else {
        parentOrigin = 'same-origin';
      }
    } catch (e) {
      parentOrigin = `error: ${e.message}`;
    }
    console.error('[JWT Auth] APP_INIT_ERROR - parent origin:', parentOrigin);

    // Check if we're in JWT iframe mode and have a token
    // If so, allow app to continue even with initialization errors
    // SecurityError and ReferenceError can occur during initialization but shouldn't block rendering
    if (isJWTIframeMode) {
      // Check if we have a JWT token (which means auth is working)
      // Use safe helper to avoid ReferenceError if module isn't initialized yet
      const globalAuthState = getGlobalAuthStateSafely();
      const hasJwtToken = globalAuthState.mode === 'jwt' && globalAuthState.jwtToken;

      // Fallback: check if we have test token or window token
      const testToken = process.env.JWT_TEST_TOKEN || window.__JWT_TOKEN__;
      const hasToken = hasJwtToken || !!testToken;

      if (hasToken) {
        // Check what type of error we have
        const lastError = window.__LAST_ERROR__?.error;
        const errorName = lastError?.name;
        const errorMessage = lastError?.message || '';

        // Allow app to continue if:
        // 1. Only SecurityError (expected in cross-origin iframe)
        // 2. ReferenceError during initialization (module loading issue, but we have JWT token)
        // 3. No actual error object (just the event name string)
        const isExpectedError = hasSecurityError ||
                               errorName === 'ReferenceError' ||
                               errorName === 'SecurityError' ||
                               (!lastError && isEventNameString);

        if (isExpectedError) {
          console.warn('[JWT Auth] APP_INIT_ERROR - Expected error in JWT iframe mode. JWT token available. Attempting to continue...', {
            errorName,
            hasSecurityError,
            hasJwtToken,
            hasTestToken: !!testToken,
            isEventNameString,
          });
          // Don't render error page - let the app continue
          // The APP_READY handler will render the app
          return;
        }
      }
    }

    // Check if there's an error stored globally
    if (window.__FRONTEND_PLATFORM_ERROR__) {
      console.error('[JWT Auth] APP_INIT_ERROR - Found stored error:', window.__FRONTEND_PLATFORM_ERROR__);
    }

    if (window.__FRONTEND_PLATFORM_INIT_ERROR__) {
      console.error('[JWT Auth] APP_INIT_ERROR - Found intercepted error:', window.__FRONTEND_PLATFORM_INIT_ERROR__);
      errorDetails.interceptedError = window.__FRONTEND_PLATFORM_INIT_ERROR__;
    }

    // Check for network errors
    if (window.__LAST_FETCH_ERROR__) {
      console.error('[JWT Auth] APP_INIT_ERROR - Last fetch error:', window.__LAST_FETCH_ERROR__);
      errorDetails.lastFetchError = window.__LAST_FETCH_ERROR__;
    }

    if (window.__LAST_XHR_ERROR__) {
      console.error('[JWT Auth] APP_INIT_ERROR - Last XHR error:', window.__LAST_XHR_ERROR__);
      errorDetails.lastXHRError = window.__LAST_XHR_ERROR__;
    }

    // Check for any stored errors
    if (window.__INIT_ERROR__) {
      console.error('[JWT Auth] APP_INIT_ERROR - Stored init error:', window.__INIT_ERROR__);
      errorDetails.storedInitError = {
        message: window.__INIT_ERROR__?.message,
        name: window.__INIT_ERROR__?.name,
        stack: window.__INIT_ERROR__?.stack,
      };
    }

    if (window.__LAST_ERROR__) {
      console.error('[JWT Auth] APP_INIT_ERROR - Last error:', window.__LAST_ERROR__);
      errorDetails.lastError = window.__LAST_ERROR__;
    }

    // Check for promise rejections
    if (window.__LAST_PROMISE_REJECTION__) {
      console.error('[JWT Auth] APP_INIT_ERROR - Last promise rejection:', window.__LAST_PROMISE_REJECTION__);
      errorDetails.lastPromiseRejection = window.__LAST_PROMISE_REJECTION__;
    }

    // Check for initialization-specific errors
    if (window.__INIT_SETUP_ERROR__) {
      console.error('[JWT Auth] APP_INIT_ERROR - Init setup error:', window.__INIT_SETUP_ERROR__);
      errorDetails.initSetupError = window.__INIT_SETUP_ERROR__;
    }

    if (window.__INIT_SYNC_ERROR__) {
      console.error('[JWT Auth] APP_INIT_ERROR - Init sync error:', window.__INIT_SYNC_ERROR__);
      errorDetails.initSyncError = window.__INIT_SYNC_ERROR__;
    }

    if (window.__INIT_ASYNC_ERROR__) {
      console.error('[JWT Auth] APP_INIT_ERROR - Init async error:', window.__INIT_ASYNC_ERROR__);
      errorDetails.initAsyncError = window.__INIT_ASYNC_ERROR__;
    }

    if (window.__CONFIG_HANDLER_ERROR__) {
      console.error('[JWT Auth] APP_INIT_ERROR - Config handler error:', window.__CONFIG_HANDLER_ERROR__);
      errorDetails.configHandlerError = window.__CONFIG_HANDLER_ERROR__;
    }

    // Check for ALL network requests during initialization
    if (window.__ALL_NETWORK_REQUESTS__) {
      console.error('[JWT Auth] APP_INIT_ERROR - All network requests during init:', {
        totalRequests: window.__ALL_NETWORK_REQUESTS__.length,
        requests: window.__ALL_NETWORK_REQUESTS__,
      });
      errorDetails.allNetworkRequests = window.__ALL_NETWORK_REQUESTS__;
    }

    // Check for failed network requests
    if (window.__FAILED_NETWORK_REQUESTS__ && window.__FAILED_NETWORK_REQUESTS__.length > 0) {
      console.error('[JWT Auth] APP_INIT_ERROR - FAILED network requests:', {
        failedCount: window.__FAILED_NETWORK_REQUESTS__.length,
        failedRequests: window.__FAILED_NETWORK_REQUESTS__,
      });
      errorDetails.failedNetworkRequests = window.__FAILED_NETWORK_REQUESTS__;
    }

    // Check for login_refresh response (critical for authentication)
    if (window.__LOGIN_REFRESH_RESPONSE__) {
      console.error('[JWT Auth] APP_INIT_ERROR - Login refresh response:', window.__LOGIN_REFRESH_RESPONSE__);
      errorDetails.loginRefreshResponse = window.__LOGIN_REFRESH_RESPONSE__;

      // Try to parse and validate the login_refresh response
      try {
        const responseBody = window.__LOGIN_REFRESH_RESPONSE__.responseBody;
        if (responseBody) {
          const parsed = JSON.parse(responseBody);
          console.error('[JWT Auth] APP_INIT_ERROR - Parsed login_refresh response:', {
            hasSuccess: 'success' in parsed,
            success: parsed.success,
            hasUserId: 'user_id' in parsed,
            userId: parsed.user_id,
            hasExpires: 'expires_epoch_seconds' in parsed,
            expiresEpochSeconds: parsed.expires_epoch_seconds,
            allKeys: Object.keys(parsed),
            timestamp: new Date().toISOString(),
          });
          errorDetails.parsedLoginRefreshResponse = parsed;
        }
      } catch (parseError) {
        console.error('[JWT Auth] APP_INIT_ERROR - Failed to parse login_refresh response:', {
          error: parseError.message,
          responseBody: window.__LOGIN_REFRESH_RESPONSE__.responseBody,
        });
        errorDetails.loginRefreshParseError = parseError.message;
      }
    }

    // Check authentication state (but in JWT iframe mode, this is expected to be false)
    const isInIframe = window.self !== window.top;
    const jwtAuthEnabled = process.env.JWT_AUTH_ENABLED === 'true' || !!process.env.JWT_TEST_TOKEN;
    const isJWTIframeMode = isInIframe && jwtAuthEnabled;

    // Try to access authenticated user state at error time (safely, synchronously)
    const authStateResult = getAuthenticatedUserSafelySync();
    if (authStateResult.error) {
      console.error('[JWT Auth] APP_INIT_ERROR - Could not access authenticated user:', {
        error: authStateResult.error,
        errorStack: authStateResult.errorStack,
        moduleAvailable: authStateResult.available,
        isJWTIframeMode,
        note: isJWTIframeMode
          ? 'In JWT iframe mode, cookie-based auth is not required - this may be expected'
          : 'Cookie-based auth is required - this is an error',
      });
      errorDetails.authenticatedUserError = authStateResult.error;
      errorDetails.authModuleAvailable = authStateResult.available;
      errorDetails.isJWTIframeMode = isJWTIframeMode;
    } else {
      const authenticatedUser = authStateResult.user;
      console.error('[JWT Auth] APP_INIT_ERROR - Authenticated user state:', {
        hasAuthenticatedUser: !!authenticatedUser,
        authenticatedUserKeys: authenticatedUser ? Object.keys(authenticatedUser) : [],
        moduleAvailable: authStateResult.available,
        isJWTIframeMode,
        note: isJWTIframeMode && !authenticatedUser
          ? 'In JWT iframe mode, hasAuthenticatedUser: false is expected (using JWT tokens instead)'
          : 'Standard cookie-based auth mode',
      });
      errorDetails.authenticatedUserAtError = authenticatedUser;
      errorDetails.isJWTIframeMode = isJWTIframeMode;
    }
  }

  const root = createRoot(document.getElementById('root'));

  root.render(
    <StrictMode>
      <ErrorBoundary>
        <ErrorPage
          message={
            isEventNameString
              ? 'An unexpected error occurred during initialization. Check console for details.'
              : (error?.message || 'An unexpected error occurred during initialization')
          }
        />
      </ErrorBoundary>
    </StrictMode>,
  );
});

logInitializationMilestone('About to initialize frontend-platform');

// Store initialization start time and network request count
const initStartTime = Date.now();
const initialNetworkRequestCount = (window.__NETWORK_REQUEST_COUNT__ || 0);
console.log('[JWT Auth] Starting frontend-platform initialize()', {
  timestamp: new Date().toISOString(),
  url: window.location.href,
  referrer: document.referrer,
  inIframe: window.self !== window.top,
  initialNetworkRequestCount,
});

// Determine if we should require authenticated user
// In JWT mode for iframes, we don't need cookie-based authentication
const isInIframe = window.self !== window.top;
const jwtAuthEnabled = process.env.JWT_AUTH_ENABLED === 'true' || !!process.env.JWT_TEST_TOKEN;
const shouldRequireAuth = !(isInIframe && jwtAuthEnabled);
const isJWTIframeMode = isInIframe && jwtAuthEnabled;

console.log('[JWT Auth] Authentication requirements:', {
  isInIframe,
  jwtAuthEnabled,
  shouldRequireAuth,
  isJWTIframeMode,
  reason: isJWTIframeMode
    ? 'JWT mode in iframe - skipping cookie-based auth requirement'
    : 'Standard cookie-based auth required',
});

// If in JWT iframe mode, set up early JWT token detection and global auth state
// This ensures API calls made during initialization use JWT tokens
if (isJWTIframeMode) {
  console.log('[JWT Auth] JWT iframe mode detected - setting up early token detection');

  // Check for test token first
  const testToken = process.env.JWT_TEST_TOKEN;
  if (testToken) {
    console.log('[JWT Auth] Test token found - setting global auth state to JWT mode', {
      tokenLength: testToken.length,
      tokenPreview: testToken.substring(0, 30) + '...',
    });
    setGlobalAuthState('jwt', testToken);
  } else {
    // Listen for JWT token from parent window via postMessage
    // This needs to happen before React renders so API calls can use JWT
    const jwtMessageHandler = (event) => {
      // Only accept messages from parent window
      if (event.source !== window.parent) {
        return;
      }

      // Check for JWT token in message
      if (event.data && event.data.type === 'auth.jwt.token' && event.data.token) {
        const token = event.data.token.trim();
        console.log('[JWT Auth] JWT token received via postMessage (early)', {
          tokenLength: token.length,
          tokenPreview: token.substring(0, 30) + '...',
        });

        // Set global auth state immediately
        setGlobalAuthState('jwt', token);

        // Remove listener after first token received
        window.removeEventListener('message', jwtMessageHandler);
      }
    };

    window.addEventListener('message', jwtMessageHandler);
    console.log('[JWT Auth] Listening for JWT token from parent window (early)');

    // Also check if token is already in window (set by inline script or other means)
    if (window.__JWT_TOKEN__) {
      console.log('[JWT Auth] JWT token found in window.__JWT_TOKEN__', {
        tokenLength: window.__JWT_TOKEN__.length,
        tokenPreview: window.__JWT_TOKEN__.substring(0, 30) + '...',
      });
      setGlobalAuthState('jwt', window.__JWT_TOKEN__);
    }
  }
}

// Wrap initialize in try-catch to catch any synchronous errors
try {
initialize({
    requireAuthenticatedUser: shouldRequireAuth,
  handlers: {
    config: () => {
        logInitializationMilestone('Config handler called');
        try {
      mergeConfig({
        CONTACT_URL: process.env.CONTACT_URL || null,
        CREDENTIALS_BASE_URL: process.env.CREDENTIALS_BASE_URL || null,
        CREDIT_HELP_LINK_URL: process.env.CREDIT_HELP_LINK_URL || null,
        DISCUSSIONS_MFE_BASE_URL: process.env.DISCUSSIONS_MFE_BASE_URL || null,
        ENTERPRISE_LEARNER_PORTAL_HOSTNAME: process.env.ENTERPRISE_LEARNER_PORTAL_HOSTNAME || null,
        ENTERPRISE_LEARNER_PORTAL_URL: process.env.ENTERPRISE_LEARNER_PORTAL_URL || null,
        ENABLE_JUMPNAV: process.env.ENABLE_JUMPNAV || null,
        ENABLE_NOTICES: process.env.ENABLE_NOTICES || null,
        INSIGHTS_BASE_URL: process.env.INSIGHTS_BASE_URL || null,
        SEARCH_CATALOG_URL: process.env.SEARCH_CATALOG_URL || null,
        SOCIAL_UTM_MILESTONE_CAMPAIGN: process.env.SOCIAL_UTM_MILESTONE_CAMPAIGN || null,
        STUDIO_BASE_URL: process.env.STUDIO_BASE_URL || null,
        SUPPORT_URL: process.env.SUPPORT_URL || null,
        SUPPORT_URL_CALCULATOR_MATH: process.env.SUPPORT_URL_CALCULATOR_MATH || null,
        SUPPORT_URL_ID_VERIFICATION: process.env.SUPPORT_URL_ID_VERIFICATION || null,
        SUPPORT_URL_VERIFIED_CERTIFICATE: process.env.SUPPORT_URL_VERIFIED_CERTIFICATE || null,
        TERMS_OF_SERVICE_URL: process.env.TERMS_OF_SERVICE_URL || null,
        TWITTER_HASHTAG: process.env.TWITTER_HASHTAG || null,
        TWITTER_URL: process.env.TWITTER_URL || null,
        LEGACY_THEME_NAME: process.env.LEGACY_THEME_NAME || null,
        MFE_STATIC_CSS_DOMAIN: process.env.MFE_STATIC_CSS_DOMAIN || null,
        EXAMS_BASE_URL: process.env.EXAMS_BASE_URL || null,
        PROCTORED_EXAM_FAQ_URL: process.env.PROCTORED_EXAM_FAQ_URL || null,
        PROCTORED_EXAM_RULES_URL: process.env.PROCTORED_EXAM_RULES_URL || null,
        CHAT_RESPONSE_URL: process.env.CHAT_RESPONSE_URL || null,
        PRIVACY_POLICY_URL: process.env.PRIVACY_POLICY_URL || null,
        SHOW_UNGRADED_ASSIGNMENT_PROGRESS: process.env.SHOW_UNGRADED_ASSIGNMENT_PROGRESS || false,
        ENABLE_XPERT_AUDIT: process.env.ENABLE_XPERT_AUDIT || false,
        JWT_AUTH_ENABLED: process.env.JWT_AUTH_ENABLED === 'true' || false,
        JWT_AUTH_ORIGIN_WHITELIST: process.env.JWT_AUTH_ORIGIN_WHITELIST
          ? process.env.JWT_AUTH_ORIGIN_WHITELIST.split(',').map(origin => origin.trim())
          : [],
        JWT_TEST_TOKEN: process.env.JWT_TEST_TOKEN || null, // TEST MODE: Hardcoded token for testing
      }, 'LearnerAppConfig');
        } catch (configError) {
          console.error('[JWT Auth] Error in config handler:', configError);
          logInitializationMilestone('Config handler error', {
            errorMessage: configError?.message || String(configError),
            errorStack: configError?.stack,
            errorName: configError?.name,
          });
          // Store error globally
          window.__CONFIG_HANDLER_ERROR__ = configError;
          throw configError; // Re-throw to let frontend-platform handle it
        }
    },
  },
  messages,
});

  // Log when initialize() returns (it's synchronous, but frontend-platform may do async work)
  const initDuration = Date.now() - initStartTime;
  const networkRequestsDuringInit = (window.__NETWORK_REQUEST_COUNT__ || 0) - initialNetworkRequestCount;
  console.log('[JWT Auth] Initialize() returned', {
    duration: initDuration,
    networkRequestsDuringInit,
    timestamp: new Date().toISOString(),
  });

  // Monitor authentication state and errors periodically after initialization
  // This helps catch async errors that occur during authentication processing
  let checkCount = 0;
  const maxChecks = 20; // Check for 10 seconds (20 * 500ms)
  const checkInterval = setInterval(() => {
    checkCount++;
    const elapsed = Date.now() - initStartTime;

    // Check if we're in JWT iframe mode
    const isInIframe = window.self !== window.top;
    const jwtAuthEnabled = process.env.JWT_AUTH_ENABLED === 'true' || !!process.env.JWT_TEST_TOKEN;
    const isJWTIframeMode = isInIframe && jwtAuthEnabled;

    // In JWT iframe mode, we don't need to check getAuthenticatedUser()
    // We use JWT tokens instead of cookie-based auth
    if (isJWTIframeMode) {
      // Check global auth state for JWT token instead (safely)
      const globalAuthState = getGlobalAuthStateSafely();

      console.log(`[JWT Auth] Post-init check #${checkCount} (${elapsed}ms) - JWT iframe mode:`, {
        authMode: globalAuthState.mode,
        hasJwtToken: !!globalAuthState.jwtToken,
        jwtTokenLength: globalAuthState.jwtToken ? globalAuthState.jwtToken.length : 0,
        hasInitError: !!window.__FRONTEND_PLATFORM_INIT_ERROR__,
        hasLoginRefreshResponse: !!window.__LOGIN_REFRESH_RESPONSE__,
        loginRefreshStatus: window.__LOGIN_REFRESH_RESPONSE__?.status,
        totalNetworkRequests: window.__ALL_NETWORK_REQUESTS__?.length || 0,
        failedNetworkRequests: window.__FAILED_NETWORK_REQUESTS__?.length || 0,
        note: 'JWT iframe mode - using JWT tokens, not cookie-based auth',
        timestamp: new Date().toISOString(),
      });

      // In JWT mode, we can stop checking after a few iterations
      // The app should proceed even without cookie-based auth
      if (checkCount > 3 && globalAuthState.mode === 'jwt' && globalAuthState.jwtToken) {
        clearInterval(checkInterval);
        console.log('[JWT Auth] JWT iframe mode - stopping checks (JWT token available)');
      }
    } else {
      // Standard cookie-based auth mode - check getAuthenticatedUser()
      const authStateResult = getAuthenticatedUserSafelySync();

      if (authStateResult.error) {
        // Auth module not available or error accessing it
        console.log(`[JWT Auth] Post-init check #${checkCount} (${elapsed}ms) - Auth module status:`, {
          error: authStateResult.error,
          moduleAvailable: authStateResult.available,
          hasInitError: !!window.__FRONTEND_PLATFORM_INIT_ERROR__,
          hasLoginRefreshResponse: !!window.__LOGIN_REFRESH_RESPONSE__,
          loginRefreshStatus: window.__LOGIN_REFRESH_RESPONSE__?.status,
          totalNetworkRequests: window.__ALL_NETWORK_REQUESTS__?.length || 0,
          failedNetworkRequests: window.__FAILED_NETWORK_REQUESTS__?.length || 0,
          note: 'Cookie-based auth required - this may be an error',
          timestamp: new Date().toISOString(),
        });
      } else {
        const authenticatedUser = authStateResult.user;

        console.log(`[JWT Auth] Post-init check #${checkCount} (${elapsed}ms):`, {
          hasAuthenticatedUser: !!authenticatedUser,
          authenticatedUserKeys: authenticatedUser ? Object.keys(authenticatedUser) : [],
          moduleAvailable: authStateResult.available,
          hasInitError: !!window.__FRONTEND_PLATFORM_INIT_ERROR__,
          hasLoginRefreshResponse: !!window.__LOGIN_REFRESH_RESPONSE__,
          loginRefreshStatus: window.__LOGIN_REFRESH_RESPONSE__?.status,
          totalNetworkRequests: window.__ALL_NETWORK_REQUESTS__?.length || 0,
          failedNetworkRequests: window.__FAILED_NETWORK_REQUESTS__?.length || 0,
          note: 'Standard cookie-based auth mode',
          timestamp: new Date().toISOString(),
        });

        // Standard mode - wait for authenticated user
        if (authenticatedUser && checkCount > 2) {
          clearInterval(checkInterval);
          console.log('[JWT Auth] Authentication state confirmed, stopping periodic checks');
        }
      }
    }

    // Stop checking after maxChecks or if APP_READY fired
    if (checkCount >= maxChecks || window.__APP_READY_FIRED__) {
      clearInterval(checkInterval);
      if (!window.__APP_READY_FIRED__) {
      console.warn('[JWT Auth] APP_READY not fired after periodic checks - final status:', {
        checkCount,
        elapsed,
        hasInitError: !!window.__FRONTEND_PLATFORM_INIT_ERROR__,
        hasNetworkErrors: !!(window.__LAST_FETCH_ERROR__ || window.__LAST_XHR_ERROR__),
        hasLoginRefreshResponse: !!window.__LOGIN_REFRESH_RESPONSE__,
        loginRefreshResponse: window.__LOGIN_REFRESH_RESPONSE__,
        totalNetworkRequests: window.__ALL_NETWORK_REQUESTS__?.length || 0,
        failedNetworkRequests: window.__FAILED_NETWORK_REQUESTS__?.length || 0,
        allNetworkRequests: window.__ALL_NETWORK_REQUESTS__ || [],
        failedRequests: window.__FAILED_NETWORK_REQUESTS__ || [],
        timestamp: new Date().toISOString(),
      });
      }
    }
  }, 500); // Check every 500ms

} catch (initError) {
  // Catch any synchronous errors during initialize()
  console.error('[JWT Auth] Synchronous error during initialize():', initError);
  logInitializationMilestone('Initialize() synchronous error', {
    errorMessage: initError?.message || String(initError),
    errorStack: initError?.stack,
    errorName: initError?.name,
    errorType: typeof initError,
  });
  // Store error globally
  window.__INIT_SYNC_ERROR__ = initError;
  // The error will be handled by APP_INIT_ERROR subscriber
}
