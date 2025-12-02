import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import { getConfig } from '@edx/frontend-platform';
import { camelCaseObject } from '@edx/frontend-platform';
import { getGlobalAuthState } from '../../utils/setupAuthInterceptor';
import { addModel } from '../../generic/model-store';
import { fetchTabSuccess } from '../../course-home/data/slice';
import ProgressTab from './ProgressTab';

/**
 * Minimal ProgressTab component that fetches data using JWT token
 * Bypasses Redux store and complex providers
 */
const ProgressTabMinimal = () => {
  const dispatch = useDispatch();
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

        // PHASE 1, STEP 3: Also store data in Redux so useModel() can access it
        // This allows original ProgressTab components to work with Redux
        dispatch(addModel({
          modelType: 'progress',
          model: {
            id: courseId,
            ...camelCasedData,
          },
        }));

        // Also set courseId in Redux state for useContextId() hook
        dispatch(addModel({
          modelType: 'courseHomeMeta',
          model: {
            id: courseId,
            courseId, // This makes useContextId() work
          },
        }));

        dispatch(fetchTabSuccess({ courseId }));

        console.log('[JWT Auth] ProgressTabMinimal - Data stored in Redux store');

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

  // PHASE 2, STEP 4: Render original ProgressTab component
  // Data is now in Redux store, so ProgressTab can use useModel() to read it
  console.log('[JWT Auth] ProgressTabMinimal - Rendering original ProgressTab component');
  return <ProgressTab />;
};

export default ProgressTabMinimal;

