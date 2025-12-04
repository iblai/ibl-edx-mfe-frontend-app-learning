import React from 'react';
import { useContextId } from '../../data/hooks';
import ProgressTabCertificateStatusSidePanelSlot from '../../plugin-slots/ProgressTabCertificateStatusSidePanelSlot';

import CourseCompletion from './course-completion/CourseCompletion';
import ProgressHeader from './ProgressHeader';

import ProgressTabCertificateStatusMainBodySlot from '../../plugin-slots/ProgressTabCertificateStatusMainBodySlot';
import ProgressTabCourseGradeSlot from '../../plugin-slots/ProgressTabCourseGradeSlot';
import ProgressTabGradeBreakdownSlot from '../../plugin-slots/ProgressTabGradeBreakdownSlot';
import ProgressTabRelatedLinksSlot from '../../plugin-slots/ProgressTabRelatedLinksSlot';
import { useModel } from '../../generic/model-store';

const ProgressTab = () => {
  const courseId = useContextId();
  const progressData = useModel('progress', courseId);

  // Log progress data for debugging
  console.log('[JWT Auth] ProgressTab - progressData:', progressData);
  console.log('[JWT Auth] ProgressTab - courseId:', courseId);

  // Safely extract disableProgressGraph with fallback
  const disableProgressGraph = progressData?.disableProgressGraph ?? false;

  // Use window.innerWidth directly instead of useWindowSize() to avoid paragon analytics dependency
  // Paragon's useWindowSize() internally uses useTrackColorSchemeChoice which requires analytics
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;

  if (windowWidth === undefined) {
    // Bail because we don't want to load <CertificateStatus/> twice, emitting 'visited' events both times.
    // This is a hacky solution, since the user can resize the screen and still get two visited events.
    // But I'm leaving a larger refactor as an exercise to a future reader.
    return null;
  }

  // If progress data is not available, show loading state
  if (!progressData) {
    console.warn('[JWT Auth] ProgressTab - progressData is not available, showing loading state');
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading progress data...</div>
      </div>
    );
  }

  try {
    return (
      <>
        <ProgressHeader />
        <div className="row w-100 m-0">
          {/* Main body */}
          <div className="col-12 col-md-8 p-0">
            {!disableProgressGraph && <CourseCompletion />}
            <ProgressTabCertificateStatusMainBodySlot />
            <ProgressTabCourseGradeSlot />
            <ProgressTabGradeBreakdownSlot />
          </div>

          {/* Side panel */}
          <div className="col-12 col-md-4 p-0 px-md-4">
            <ProgressTabCertificateStatusSidePanelSlot />
            <ProgressTabRelatedLinksSlot />
          </div>
        </div>
      </>
    );
  } catch (error) {
    console.error('[JWT Auth] ProgressTab - Rendering error:', error);
    console.error('[JWT Auth] ProgressTab - Error stack:', error.stack);
    console.error('[JWT Auth] ProgressTab - Progress data:', progressData);
    throw error; // Re-throw to let ErrorBoundary handle it
  }
};

export default ProgressTab;
