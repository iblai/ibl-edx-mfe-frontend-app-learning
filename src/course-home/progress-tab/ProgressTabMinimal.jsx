import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getConfig } from '@edx/frontend-platform';
import { camelCaseObject } from '@edx/frontend-platform';
import { getGlobalAuthState } from '../../utils/setupAuthInterceptor';

/**
 * Minimal ProgressTab component that fetches data using JWT token
 * Bypasses Redux store and complex providers
 */
const ProgressTabMinimal = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [courseId, setCourseId] = useState(null);

  // Extract courseId from URL
  useEffect(() => {
    const path = window.location.pathname;
    // URL format: /learning/course/course-v1:main+BN101+2024/progress/
    const match = path.match(/\/course\/([^/]+)\//);
    if (match) {
      const extractedCourseId = match[1];
      console.log('[JWT Auth] ProgressTabMinimal - Extracted courseId from URL:', extractedCourseId);
      setCourseId(extractedCourseId);
    } else {
      console.error('[JWT Auth] ProgressTabMinimal - Could not extract courseId from URL:', path);
      setError('Could not extract course ID from URL');
      setLoading(false);
    }
  }, []);

  // Fetch progress data when courseId is available
  useEffect(() => {
    if (!courseId) return;

    const fetchProgressData = async () => {
      try {
        console.log('[JWT Auth] ProgressTabMinimal - Fetching progress data for courseId:', courseId);
        setLoading(true);
        setError(null);

        const lmsBaseUrl = getConfig().LMS_BASE_URL || 'https://learn.iblai.org';
        const url = `${lmsBaseUrl}/api/course_home/progress/${courseId}`;
        
        console.log('[JWT Auth] ProgressTabMinimal - API URL:', url);
        
        // Get JWT token from global auth state (bypass frontend-platform auth client)
        const authState = getGlobalAuthState();
        const jwtToken = authState.jwtToken || process.env.JWT_TEST_TOKEN || window.__JWT_TOKEN__;
        
        if (!jwtToken) {
          throw new Error('JWT token not available. Auth state:', authState);
        }
        
        console.log('[JWT Auth] ProgressTabMinimal - Using JWT token (length:', jwtToken.length, ')');
        
        // Use plain axios with JWT token in Authorization header
        // This bypasses getAuthenticatedHttpClient() which expects cookie-based auth
        const response = await axios.get(url, {
          headers: {
            'Authorization': `JWT ${jwtToken}`,
            'Content-Type': 'application/json',
          },
          withCredentials: false, // Don't send cookies in JWT mode
        });
        
        console.log('[JWT Auth] ProgressTabMinimal - API response:', response);

        const data = response.data;
        const camelCasedData = camelCaseObject(data);

        console.log('[JWT Auth] ProgressTabMinimal - Progress data received:', camelCasedData);
        setProgressData(camelCasedData);
        setLoading(false);
      } catch (err) {
        console.error('[JWT Auth] ProgressTabMinimal - Error fetching progress data:', err);
        setError(err.message || 'Failed to fetch progress data');
        setLoading(false);
      }
    };

    fetchProgressData();
  }, [courseId]);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading progress data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#dc3545', marginBottom: '10px' }}>Error: {error}</div>
        <div style={{ fontSize: '14px', color: '#666' }}>Course ID: {courseId || 'N/A'}</div>
      </div>
    );
  }

  if (!progressData) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>No progress data available</div>
      </div>
    );
  }

  // Render simplified progress data
  const { completionSummary, currentGrade, sectionScores } = progressData;
  const percent = currentGrade?.percent || 0;
  const gradeDisplay = (percent * 100).toFixed(1);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px' }}>Course Progress</h2>

      {/* Course Grade */}
      {currentGrade && (
        <div style={{
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #dee2e6'
        }}>
          <h3 style={{ marginTop: 0 }}>Current Grade</h3>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#28a745' }}>
            {gradeDisplay}%
          </div>
        </div>
      )}

      {/* Completion Summary */}
      {completionSummary && (
        <div style={{
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #dee2e6'
        }}>
          <h3 style={{ marginTop: 0 }}>Completion Summary</h3>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {completionSummary.completeCount !== undefined && (
              <div>
                <strong>Completed:</strong> {completionSummary.completeCount}
              </div>
            )}
            {completionSummary.incompleteCount !== undefined && (
              <div>
                <strong>Incomplete:</strong> {completionSummary.incompleteCount}
              </div>
            )}
            {completionSummary.lockedCount !== undefined && (
              <div>
                <strong>Locked:</strong> {completionSummary.lockedCount}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section Scores */}
      {sectionScores && sectionScores.length > 0 && (
        <div style={{
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <h3 style={{ marginTop: 0 }}>Section Scores</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sectionScores.map((section, index) => (
              <div key={index} style={{
                padding: '10px',
                backgroundColor: 'white',
                borderRadius: '4px',
                border: '1px solid #dee2e6'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                  {section.displayName || `Section ${index + 1}`}
                </div>
                {section.percent !== undefined && (
                  <div style={{ color: '#666' }}>
                    Grade: {(section.percent * 100).toFixed(1)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debug info */}
      <div style={{
        marginTop: '20px',
        padding: '10px',
        backgroundColor: '#e9ecef',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#666'
      }}>
        <strong>Debug:</strong> Course ID: {courseId} | Data loaded: {progressData ? 'Yes' : 'No'}
      </div>
    </div>
  );
};

export default ProgressTabMinimal;

