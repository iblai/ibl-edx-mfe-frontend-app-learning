# Changelog

## [Unreleased] - 2026-01-28

### Fixed
- **CORS Error Fix**: Removed `config.headers.common` to fix CORS errors with newer Axios versions
  - Axios was serializing header objects as actual headers, causing preflight failures
  - Now sets `Authorization` header directly on `config.headers` only

- **Safari Iframe 401 Fix**: Skip `/login_refresh` call in JWT iframe mode
  - Prevents 401 errors when cookies are blocked in Safari iframe context
  - Custom auth handler detects JWT mode and skips cookie-based refresh

- **MFE_CONFIG Integration**: Use `MFE_CONFIG` for `JWT_AUTH_ENABLED` instead of `process.env`
  - Allows runtime configuration via Tutor plugin or `/api/mfe_config/v1`
  - JWT_AUTH_ENABLED now properly reads from MFE configuration

### Changed
- **Production Cleanup**: Removed all verbose console.log statements
  - Removed `[JWT Auth]` prefixed debug logs from all files
  - Kept only essential error logging wrapped in `NODE_ENV === 'development'` check
  - Removed token preview logs that exposed sensitive data
  - Removed unused imports (`logInfo`, `logError`) from cleaned files
  - Simplified `JWTAuthDebugger` component to silent initialization

### Files Modified in Production Cleanup
- `src/utils/error-logging.js` - Development-only error logging
- `src/utils/auth-utils.js` - Removed cookie/iframe detection logs
- `src/utils/setupAuthInterceptor.js` - Removed interceptor debug logs
- `src/utils/analytics-shim.js` - Removed shim loaded log
- `src/utils/jwt-utils.js` - Removed token decode error log
- `src/course-home/progress-tab/ProgressTab.jsx` - Removed progress data logs
- `src/course-home/progress-tab/ProgressTabMinimal.jsx` - Removed API fetch logs
- `src/hooks/JWTAuthDebugger.jsx` - Silent component
- `src/hooks/useAuthMode.js` - Removed test mode logs
- `src/hooks/useJWTToken.js` - Removed message/error logs
- `src/contexts/AuthenticatedHttpClientContext.jsx` - Removed sync logs
- `src/components/ErrorBoundary.jsx` - Removed verbose error logs

---

## [Previous] - 2025-12-08

### Added
- **JWT Authentication Support**: Comprehensive JWT authentication implementation for iframe contexts
  - Added `AuthenticatedHttpClientProvider` and auth interceptor setup
  - Added early message listener to receive JWT tokens via postMessage from parent window
  - Added ready message during MFE initialization to signal parent that MFE is ready
  - Enhanced JWT token logging and verification
  - Added support for JWT test tokens via build-time environment variables

- **Authentication Mode Detection**: Smart authentication mode selection
  - Prioritizes cookie-based auth when cookies are available (even in iframe)
  - Falls back to JWT mode when in iframe without cookies and JWT token is available
  - Only uses JWT mode when in iframe context, not on direct access
  - Allows JWT token messages in iframe even when `jwtAuthEnabled` is false

- **Error Handling**: Enhanced error handling for JWT mode
  - Fixed all ProgressTab components to handle null `getAuthenticatedUser()` in JWT mode
  - Wrapped ProgressTab with ErrorBoundary to catch and log rendering errors
  - Fixed ProgressHeader to handle null user data in JWT mode
  - Added better error handling and logging for ProgressTab rendering errors
  - Fixed ReferenceError issues in JWT auth initialization

### Fixed
- **JWT Authentication Implementation**:
  - Fixed Authorization header format to match Postman exactly (`JWT <token>`)
  - Set Authorization header in multiple Axios header locations (direct, common, method-specific)
  - Set `skipJwtTokenRefresh` flag to prevent frontend-platform token refresh in JWT mode
  - Fixed axios config errors and improved error logging
  - Fixed error logging and variable scope issues
  - Fixed JWT auth initialization logic

- **Analytics**: Fixed analytics errors in JWT mode
  - Updated analytics shim Proxy to handle `sendPageEvent` requests
  - Fixed `sendPageEvent` error and standardized JWT log prefix
  - Fixed analytics error and added JWT request verification logging

### Notes
- JWT authentication is designed for cross-origin iframe contexts where cookies are not available
- Cookie-based authentication is always preferred when available
- JWT tokens are received via postMessage from parent window and never persisted to localStorage

## Configuration

### Environment Variables
- `JWT_AUTH_ENABLED`: Enable JWT authentication mode (set via MFE_CONFIG)
- `JWT_TEST_TOKEN`: Hardcoded test token for development
- `JWT_AUTH_ORIGIN_WHITELIST`: Array of allowed origins for postMessage

### postMessage Protocol
Parent window sends JWT token:
```javascript
{ type: 'auth.jwt.token', edx_jwt_token: '<JWT_TOKEN_STRING>' }
```

MFE signals ready:
```javascript
{ type: 'auth.jwt.ready' }
```

MFE requests token refresh:
```javascript
{ type: 'auth.jwt.token.refresh' }
```
