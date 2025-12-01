import {
  APP_INIT_ERROR, APP_READY, subscribe, initialize,
  mergeConfig,
  getConfig,
} from '@edx/frontend-platform';
import { AppProvider, ErrorPage, PageWrap } from '@edx/frontend-platform/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Routes, Route } from 'react-router-dom';

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
import { setupAuthInterceptor } from './utils/setupAuthInterceptor';
import { logInfo } from '@edx/frontend-platform/logging';
import { setupGlobalErrorHandlers, logInitializationMilestone } from './utils/error-logging';
import { ErrorBoundary } from './components/ErrorBoundary';

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
      console.log('[JWT Auth] Initializing global auth interceptor on APP_READY', {
        jwtAuthEnabled: config?.JWT_AUTH_ENABLED === true || !!testToken,
        hasTestToken: !!testToken,
        testTokenLength: testToken ? testToken.length : 0,
        testTokenPreview: testToken ? testToken.substring(0, 30) + '...' : null,
        originWhitelist: config?.JWT_AUTH_ORIGIN_WHITELIST,
      });
      logInfo('[JWT Auth] Initializing global auth interceptor on APP_READY', {
        jwtAuthEnabled: config?.JWT_AUTH_ENABLED === true || !!testToken,
        hasTestToken: !!testToken,
        testTokenLength: testToken ? testToken.length : 0,
        originWhitelist: config?.JWT_AUTH_ORIGIN_WHITELIST,
      });
      interceptorCleanup = setupAuthInterceptor();
    } catch (error) {
      // If interceptor setup fails, log but don't block app initialization
      console.error('[JWT Auth] Failed to setup auth interceptor:', error);
    }
  }
  logInitializationMilestone('About to render React app');

  const root = createRoot(document.getElementById('root'));

  root.render(
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
                          <TabContainer
                            tab="progress"
                            fetch={fetchProgressTab}
                            slice="courseHome"
                            isProgressTab
                          >
                            <ProgressTab />
                          </TabContainer>
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
    console.error('[JWT Auth] APP_INIT_ERROR - window.onerror last error:', window.onerror?.toString());

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

// Wrap initialize in try-catch to catch any synchronous errors
try {
  initialize({
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

  // Set a timeout to check if APP_INIT_ERROR fires after initialization
  setTimeout(() => {
    if (!window.__APP_READY_FIRED__) {
      console.warn('[JWT Auth] APP_READY not fired after 5 seconds - checking for errors', {
        hasInitError: !!window.__FRONTEND_PLATFORM_INIT_ERROR__,
        hasNetworkErrors: !!(window.__LAST_FETCH_ERROR__ || window.__LAST_XHR_ERROR__),
        timestamp: new Date().toISOString(),
      });
    }
  }, 5000);

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
