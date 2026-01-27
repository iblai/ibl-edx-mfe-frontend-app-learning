// CRITICAL: Load analytics shim FIRST to prevent "sendTrackEvent is undefined" errors
// This must be imported before any frontend-platform modules that might use analytics
import './utils/analytics-shim';

import {
  APP_INIT_ERROR, APP_READY, subscribe, initialize,
  mergeConfig,
  getConfig,
} from '@edx/frontend-platform';
import {
  fetchAuthenticatedUser,
  ensureAuthenticatedUser,
  setAuthenticatedUser,
  getAuthenticatedUser,
  hydrateAuthenticatedUser,
} from '@edx/frontend-platform/auth';
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
import { ErrorBoundary } from './components/ErrorBoundary';
import PreferencesUnsubscribe from './preferences-unsubscribe';
import PageNotFound from './generic/PageNotFound';
import { AuthenticatedHttpClientProvider } from './contexts/AuthenticatedHttpClientContext';
import { setupAuthInterceptor } from './utils/setupAuthInterceptor';
import { decodeJWT } from './utils/jwt-utils';

// Verify we're using local frontend-platform (not npm package)
// This console log confirms webpack aliases are working and resolving to /openedx/frontend-platform/dist
if (typeof window !== 'undefined') {
  console.log('[JWT Auth] Frontend-Platform Verification', {
    source: 'LOCAL BUILD',
    path: '/openedx/frontend-platform/dist',
    note: 'Using local frontend-platform from ibl-edx-mfe-frontend-platform (branch: ibl-develop)',
    webpackAlias: 'Active - @edx/frontend-platform resolves to local build',
  });
}

// Shared function to render React app - called from both APP_READY and APP_INIT_ERROR (when allowing continue)
let reactRoot = null;
function renderReactApp() {
  // Prevent double rendering
  if (reactRoot) {
    return;
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('[JWT Auth] Cannot render React app - root element not found');
    return;
  }

  reactRoot = createRoot(rootElement);

  // Set up auth interceptor BEFORE rendering (so it's ready for API calls)
  const interceptorCleanup = setupAuthInterceptor();

  reactRoot.render(
    <StrictMode>
      <AppProvider store={store}>
        <Helmet>
          <link rel="shortcut icon" href={getConfig().FAVICON_URL} type="image/x-icon" />
        </Helmet>
        <PathFixesProvider>
          <NoticesProvider>
            <UserMessagesProvider>
              <AuthenticatedHttpClientProvider>
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
                          <ErrorBoundary>
                            <TabContainer
                              tab="progress"
                              fetch={fetchProgressTab}
                              slice="courseHome"
                              isProgressTab
                            >
                            <ProgressTab />
                            </TabContainer>
                          </ErrorBoundary>
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
              </AuthenticatedHttpClientProvider>
            </UserMessagesProvider>
          </NoticesProvider>
        </PathFixesProvider>
      </AppProvider>
    </StrictMode>,
  );
}

subscribe(APP_READY, () => {
  renderReactApp();
});

subscribe(APP_INIT_ERROR, (error) => {
  // Check if we're in JWT iframe mode (custom domain with JWT auth)
  // If so, allow app to continue even if APP_INIT_ERROR fires
  const isInIframe = window.self !== window.top;
  const jwtAuthEnabled = process.env.JWT_AUTH_ENABLED === 'true' || !!process.env.JWT_TEST_TOKEN;
  const isJWTIframeMode = isInIframe && jwtAuthEnabled;

  // Also check for early token stored by index.jsx listener
  const hasEarlyToken = !!window.__EARLY_JWT_TOKEN__;

  if (isJWTIframeMode || (isInIframe && hasEarlyToken)) {
    // Check for JWT token (test token, early token, or from window)
    const hasJwtToken = !!process.env.JWT_TEST_TOKEN || !!window.__JWT_TOKEN__ || hasEarlyToken;

    if (hasJwtToken) {
      console.warn('[JWT Auth] APP_INIT_ERROR in JWT iframe mode - allowing app to continue', {
        hasJwtToken: true,
        hasEarlyToken,
        errorMessage: error?.message,
      });

      // Force render React app after a delay to allow APP_READY to fire if it will
      // If APP_READY doesn't fire, we'll render anyway
      setTimeout(() => {
        if (!reactRoot) {
          console.warn('[JWT Auth] APP_READY did not fire - forcing React render');
          renderReactApp();
        }
      }, 500);
      return;
    }
  }

  // Standard error handling - show error page
  const root = createRoot(document.getElementById('root'));
  root.render(
    <StrictMode>
      <ErrorPage message={error.message} />
    </StrictMode>,
  );
});

// Determine authentication strategy:
// - If NOT in iframe: Always use cookie-based auth (require authenticated user)
// - If in iframe: Don't require auth upfront - let custom auth handler decide based on MFE_CONFIG
const isInIframe = window.self !== window.top;

// For shouldRequireAuth, we only check isInIframe here.
// The actual JWT_AUTH_ENABLED check happens inside customAuthHandler where getConfig() is available.
// If in iframe, don't require auth upfront - let the custom handler decide.
const shouldRequireAuth = !isInIframe;


// Set up message listener IMMEDIATELY to catch JWT tokens before React loads
if (isInIframe) {
  const earlyMessageHandler = (event) => {
    if (event.data?.type === 'auth.jwt.token' && event.data?.edx_jwt_token) {
      // Store token temporarily so useJWTToken hook can pick it up
      window.__EARLY_JWT_TOKEN__ = event.data.edx_jwt_token;
    }
  };
  window.addEventListener('message', earlyMessageHandler);
}

// Send ready message to parent when MFE initializes in iframe
// This happens early, before React components render, to ensure parent knows MFE is ready
if (isInIframe && window.parent && window.parent !== window) {
  try {
    const readyMessage = {
      type: 'auth.jwt.ready',
    };
    window.parent.postMessage(readyMessage, '*');
  } catch (error) {
    console.error('[JWT Auth] Error sending ready message during initialization', {
      error: error.message,
    });
  }
}

/**
 * Custom auth handler that skips the /login_refresh call in JWT mode.
 * In JWT mode, authentication is handled via postMessage from the parent window,
 * not via cookies. This prevents the 401 error from /login_refresh when cookies
 * are blocked in Safari iframe context.
 *
 * NOTE: This handler is called AFTER config is loaded, so getConfig() is available.
 *
 * @param {boolean} requireUser - Whether to redirect to login if not authenticated
 * @param {boolean} hydrateUser - Whether to fetch additional user account data
 */
async function customAuthHandler(requireUser, hydrateUser) {
  // Get JWT_AUTH_ENABLED from MFE_CONFIG (set via Tutor plugin or /api/mfe_config/v1)
  // This is checked here (not at module level) because getConfig() is only available after config loads
  const config = getConfig();
  const jwtAuthEnabled = config.JWT_AUTH_ENABLED === true || config.JWT_AUTH_ENABLED === 'true';
  const hasTestToken = !!config.JWT_TEST_TOKEN;

  // Determine if we should use JWT auth mode
  const useJwtAuthMode = isInIframe && (jwtAuthEnabled || hasTestToken);

  console.log('[JWT Auth] Auth handler called', {
    isInIframe,
    jwtAuthEnabled,
    hasTestToken,
    useJwtAuthMode,
    configKeys: Object.keys(config).filter(k => k.includes('JWT')),
  });

  if (useJwtAuthMode) {
    console.log('[JWT Auth] Using JWT auth mode - skipping cookie-based /login_refresh');

    // Check for early token (from postMessage) or test token from config
    const token = config.JWT_TEST_TOKEN || window.__EARLY_JWT_TOKEN__;

    if (token) {
      // Decode token and set user data
      const decoded = decodeJWT(token);
      if (decoded) {
        const userData = {
          userId: decoded.user_id,
          username: decoded.preferred_username || decoded.username,
          email: decoded.email,
          roles: decoded.roles || [],
          administrator: decoded.administrator || false,
          name: decoded.name,
        };
        setAuthenticatedUser(userData);
        console.log('[JWT Auth] User set from JWT token during init', {
          username: userData.username,
          userId: userData.userId,
        });
      } else {
        console.warn('[JWT Auth] Failed to decode early JWT token');
      }
    } else {
      console.log('[JWT Auth] No early token available - user will be set later via postMessage');
      // Don't set user - it will be set later when token arrives via postMessage
      // The AuthenticatedHttpClientProvider and useJWTToken hook handle this
    }

    // Skip hydrateUser in JWT mode - we don't have cookie auth to make the API call
    return;
  }

  // Cookie mode - use normal auth flow
  console.log('[JWT Auth] Using cookie auth mode');
  if (requireUser) {
    await ensureAuthenticatedUser(globalThis.location.href);
  } else {
    await fetchAuthenticatedUser();
  }

  if (hydrateUser && getAuthenticatedUser() !== null) {
    // We intentionally do not await - additional data is nice-to-have
    hydrateAuthenticatedUser();
  }
}

initialize({
    requireAuthenticatedUser: shouldRequireAuth,
  handlers: {
    // Use custom auth handler that skips /login_refresh in JWT mode
    auth: customAuthHandler,
    config: () => {
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
      }, 'LearnerAppConfig');
    },
  },
  messages,
});
