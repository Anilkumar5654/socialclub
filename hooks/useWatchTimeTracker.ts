import { useEffect, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/services/api';
import { getDeviceId } from '@/utils/deviceId';

interface UseWatchTimeTrackerProps {
  videoId: string;
  videoType: 'reel' | 'video';
  videoDuration: number;
  enabled?: boolean;
}

export function useWatchTimeTracker({
  videoId,
  videoType,
  videoDuration,
  enabled = true,
}: UseWatchTimeTrackerProps) {
  const startTimeRef = useRef<number>(0);
  const totalWatchTimeRef = useRef<number>(0);
  const isTrackingRef = useRef<boolean>(false);
  const lastReportTimeRef = useRef<number>(0);
  const reportIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const trackWatchMutation = useMutation({
    mutationFn: async ({
      watchDuration,
      completionRate,
    }: {
      watchDuration: number;
      completionRate: number;
    }) => {
      const deviceId = await getDeviceId();
      return api.videos.trackWatch(videoId, videoType, watchDuration, completionRate, deviceId);
    },
    onSuccess: (data) => {
      console.log(`[WatchTimeTracker] Watch time tracked for ${videoType} ${videoId}:`, {
        watchDuration: totalWatchTimeRef.current,
        updatedScore: data?.updated_score,
      });
    },
    onError: (error: any) => {
      console.error(`[WatchTimeTracker] Failed to track watch time for ${videoType} ${videoId}:`, error);
    },
  });

  const { mutate: trackWatch } = trackWatchMutation;

  const reportWatchTime = useCallback(() => {
    if (totalWatchTimeRef.current > 0 && enabled) {
      const completionRate = videoDuration > 0
        ? Math.min((totalWatchTimeRef.current / videoDuration) * 100, 100)
        : 0;

      console.log(`[WatchTimeTracker] Reporting watch time for ${videoType} ${videoId}:`, {
        watchDuration: totalWatchTimeRef.current,
        completionRate: completionRate.toFixed(1),
      });

      trackWatch({
        watchDuration: Math.round(totalWatchTimeRef.current),
        completionRate: parseFloat(completionRate.toFixed(2)),
      });

      lastReportTimeRef.current = totalWatchTimeRef.current;
    }
  }, [videoId, videoType, videoDuration, enabled, trackWatch]);

  const startTracking = useCallback(() => {
    if (!enabled || isTrackingRef.current) return;

    console.log(`[WatchTimeTracker] Start tracking ${videoType} ${videoId}`);
    startTimeRef.current = Date.now();
    isTrackingRef.current = true;

    if (reportIntervalRef.current) {
      clearInterval(reportIntervalRef.current);
    }
    reportIntervalRef.current = setInterval(() => {
      if (isTrackingRef.current) {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        totalWatchTimeRef.current += elapsed;
        startTimeRef.current = Date.now();

        if (totalWatchTimeRef.current - lastReportTimeRef.current >= 5) {
          reportWatchTime();
        }
      }
    }, 5000);
  }, [videoId, videoType, enabled, reportWatchTime]);

  const stopTracking = useCallback(() => {
    if (!isTrackingRef.current) return;

    console.log(`[WatchTimeTracker] Stop tracking ${videoType} ${videoId}`);
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    totalWatchTimeRef.current += elapsed;
    isTrackingRef.current = false;

    if (reportIntervalRef.current) {
      clearInterval(reportIntervalRef.current);
      reportIntervalRef.current = null;
    }

    reportWatchTime();
  }, [videoId, videoType, reportWatchTime]);

  const pauseTracking = useCallback(() => {
    if (!isTrackingRef.current) return;

    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    totalWatchTimeRef.current += elapsed;
    isTrackingRef.current = false;

    console.log(`[WatchTimeTracker] Paused tracking ${videoType} ${videoId}`, {
      totalWatchTime: totalWatchTimeRef.current,
    });
  }, [videoId, videoType]);

  const resumeTracking = useCallback(() => {
    if (isTrackingRef.current || !enabled) return;

    console.log(`[WatchTimeTracker] Resumed tracking ${videoType} ${videoId}`);
    startTimeRef.current = Date.now();
    isTrackingRef.current = true;
  }, [videoId, videoType, enabled]);

  useEffect(() => {
    return () => {
      if (isTrackingRef.current) {
        stopTracking();
      }
      if (reportIntervalRef.current) {
        clearInterval(reportIntervalRef.current);
      }
    };
  }, [stopTracking]);

  return {
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    isTracking: isTrackingRef.current,
    totalWatchTime: totalWatchTimeRef.current,
  };
}
