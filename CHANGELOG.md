# Changelog

## [Unreleased] - 2025-12-08

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

### Changed
- **Logging**: Comprehensive logging improvements
  - Added detailed logging for Priority 3 condition check in `useAuthMode`
  - Added detailed cookie logging for debugging
  - Added debug logging for Authorization header type and value
  - Added final header verification and enhanced error logging
  - Cleaned up verbose debug logs for production deployment
  - Standardized JWT log prefix format

- **Authentication Flow**:
  - Enhanced ready message logging for JWT postMessage
  - Added check for early JWT token in `APP_INIT_ERROR`
  - Added hook initialization logging
  - Improved authentication mode determination logic

### Technical Details
- **Files Modified**:
  - Authentication interceptor setup and configuration
  - ProgressTab and ProgressHeader components for null user handling
  - Analytics shim for JWT mode compatibility
  - Error boundaries and error handling throughout the app

### Notes
- JWT authentication is designed for cross-origin iframe contexts where cookies are not available
- Cookie-based authentication is always preferred when available
- JWT tokens are received via postMessage from parent window and never persisted to localStorage

