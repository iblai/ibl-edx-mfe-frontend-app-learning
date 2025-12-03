import React from 'react';
// Removed useWindowSize import - using window.innerWidth directly to avoid paragon analytics dependency
import { useContextId } from '../../data/hooks';
import ProgressTabCertificateStatusSidePanelSlot from '../../plugin-slots/ProgressTabCertificateStatusSidePanelSlot';

import CourseCompletion from './course-completion/CourseCompletion';
import ProgressHeader from './ProgressHeader';

import ProgressTabCertificateStatusMainBodySlot from '../../plugin-slots/ProgressTabCertificateStatusMainBodySlot';
import ProgressTabCourseGradeSlot from '../../plugin-slots/ProgressTabCourseGradeSlot';
import ProgressTabGradeBreakdownSlot from '../../plugin-slots/ProgressTabGradeBreakdownSlot';
import ProgressTabRelatedLinksSlot from '../../plugin-slots/ProgressTabRelatedLinksSlot';
import { useModel } from '../../generic/model-store';

// PHASE 2, STEP 5: Incrementally restore child components with error boundaries
// This allows us to test each component individually and see which ones need additional providers
// Redux store is now available (Phase 1, Step 1)
// Data is in Redux (Phase 1, Step 3)
// IntlProvider is available (Phase 3, Step 7)
// Now we can use useModel() and useContextId() hooks

// Simple error boundary for individual components
class ComponentErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const errorMessage = error?.message || String(error);
    const isSendTrackEventError = errorMessage.includes('sendTrackEvent');

    console.error(`[JWT Auth] ComponentErrorBoundary caught error in ${this.props.componentName}:`, {
      error,
      errorMessage,
      isSendTrackEventError,
      errorInfo,
      stack: error?.stack,
      note: isSendTrackEventError
        ? 'This is an analytics error - webpack rebuild needed for permanent fix'
        : 'Unknown error',
    });

    // If it's a sendTrackEvent error, try to patch analytics one more time
    if (isSendTrackEventError && typeof window !== 'undefined') {
      try {
        const analyticsModule = require('@edx/frontend-platform/analytics');
        if (analyticsModule && (!analyticsModule.sendTrackEvent || typeof analyticsModule.sendTrackEvent !== 'function')) {
          analyticsModule.sendTrackEvent = function() { return Promise.resolve(); };
          console.log(`[JWT Auth] Emergency patch: Patched sendTrackEvent for ${this.props.componentName}`);
        }
      } catch (e) {
        // Ignore
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Unknown error';
      const isSendTrackEventError = errorMessage.includes('sendTrackEvent');

      return (
        <div style={{ padding: '10px', backgroundColor: isSendTrackEventError ? '#f8d7da' : '#fff3cd', borderRadius: '4px', margin: '10px 0' }}>
          <small style={{ color: isSendTrackEventError ? '#721c24' : '#856404' }}>
            <strong>{this.props.componentName}</strong> failed to render: {errorMessage}
            {isSendTrackEventError && (
              <div style={{ marginTop: '5px', fontSize: '11px' }}>
                ⚠️ Analytics error - webpack rebuild required for permanent fix
              </div>
            )}
          </small>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProgressTab = () => {
  const courseId = useContextId();
  const { disableProgressGraph } = useModel('progress', courseId);

  // PHASE 3, STEP 8: useWindowSize from paragon
  // CRITICAL: Paragon's useWindowSize() uses analytics internally via useTrackColorSchemeChoice
  // Since analytics isn't properly initialized in minimal mode, we bypass useWindowSize entirely
  // and use window.innerWidth directly to avoid the sendTrackEvent error

  // Use window.innerWidth directly instead of useWindowSize() to avoid paragon analytics dependency
  const [windowWidth, setWindowWidth] = React.useState(() => {
    // Initialize with current window width or default
    if (typeof window !== 'undefined' && window.innerWidth) {
      return window.innerWidth;
    }
    return 1200; // Default to desktop width
  });

  // Update window width on resize (simple implementation without paragon)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setWindowWidth(window.innerWidth || 1200);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (windowWidth === undefined) {
    // Bail because we don't want to load <CertificateStatus/> twice, emitting 'visited' events both times.
    // This is a hacky solution, since the user can resize the screen and still get two visited events.
    // But I'm leaving a larger refactor as an exercise to a future reader.
    return null;
  }

  return (
    <>
      {/* Wrap each component in error boundary to isolate errors */}
      <ComponentErrorBoundary componentName="ProgressHeader">
        <ProgressHeader />
      </ComponentErrorBoundary>

      <div className="row w-100 m-0">
        {/* Main body */}
        <div className="col-12 col-md-8 p-0">
          {!disableProgressGraph && (
            <ComponentErrorBoundary componentName="CourseCompletion">
              <CourseCompletion />
            </ComponentErrorBoundary>
          )}
          <ComponentErrorBoundary componentName="ProgressTabCertificateStatusMainBodySlot">
            <ProgressTabCertificateStatusMainBodySlot />
          </ComponentErrorBoundary>
          <ComponentErrorBoundary componentName="ProgressTabCourseGradeSlot">
            <ProgressTabCourseGradeSlot />
          </ComponentErrorBoundary>
          <ComponentErrorBoundary componentName="ProgressTabGradeBreakdownSlot">
            <ProgressTabGradeBreakdownSlot />
          </ComponentErrorBoundary>
        </div>

        {/* Side panel */}
        <div className="col-12 col-md-4 p-0 px-md-4">
          <ComponentErrorBoundary componentName="ProgressTabCertificateStatusSidePanelSlot">
            <ProgressTabCertificateStatusSidePanelSlot />
          </ComponentErrorBoundary>
          <ComponentErrorBoundary componentName="ProgressTabRelatedLinksSlot">
            <ProgressTabRelatedLinksSlot />
          </ComponentErrorBoundary>
        </div>
      </div>
    </>
  );
};

export default ProgressTab;
