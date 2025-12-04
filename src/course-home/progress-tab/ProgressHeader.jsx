import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { useIntl } from '@edx/frontend-platform/i18n';
import { Button } from '@openedx/paragon';
import { useSelector } from 'react-redux';

import { useModel } from '../../generic/model-store';

import messages from './messages';

const ProgressHeader = () => {
  const intl = useIntl();
  const {
    courseId,
    targetUserId,
  } = useSelector(state => state.courseHome);

  // Safely get authenticated user - may be null in JWT mode
  const authenticatedUser = getAuthenticatedUser();
  const administrator = authenticatedUser?.administrator ?? false;
  const userId = authenticatedUser?.userId ?? null;

  // Safely get progress data - may be null if not loaded yet
  const progressData = useModel('progress', courseId);
  const studioUrl = progressData?.studioUrl ?? null;
  const username = progressData?.username ?? null;

  // If courseId is not available, return null (component will re-render when courseId is available)
  if (!courseId) {
    return null;
  }

  const viewingOtherStudentsProgressPage = (targetUserId && targetUserId !== userId);

  const pageTitle = viewingOtherStudentsProgressPage
    ? intl.formatMessage(messages.progressHeaderForTargetUser, { username })
    : intl.formatMessage(messages.progressHeader);

  return (
    <div className="row w-100 m-0 mt-3 mb-4 justify-content-between">
      <h1>{pageTitle}</h1>
      {administrator && studioUrl && (
      <Button variant="outline-primary" size="sm" className="align-self-center" href={studioUrl}>
        {intl.formatMessage(messages.studioLink)}
      </Button>
      )}
    </div>
  );
};

export default ProgressHeader;
