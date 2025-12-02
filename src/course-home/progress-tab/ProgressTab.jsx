import React from 'react';
import { useWindowSize } from '@openedx/paragon';
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
    console.error(`[JWT Auth] ComponentErrorBoundary caught error in ${this.props.componentName}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', margin: '10px 0' }}>
          <small style={{ color: '#856404' }}>
            {this.props.componentName} failed to render: {this.state.error?.message || 'Unknown error'}
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
  // This might cause sendTrackEvent errors if paragon's analytics isn't mocked
  let windowWidth;
  try {
    windowWidth = useWindowSize().width;
  } catch (error) {
    console.warn('[JWT Auth] useWindowSize() error, using fallback:', error);
    // Fallback: use window.innerWidth if available
    windowWidth = typeof window !== 'undefined' ? window.innerWidth : undefined;
  }

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
