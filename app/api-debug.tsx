import { router } from 'expo-router';
import { X, Trash2, AlertCircle, CheckCircle, Info } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/colors';

interface ApiLog {
  id: string;
  timestamp: string;
  endpoint: string;
  method: string;
  status: 'success' | 'error' | 'pending';
  statusCode?: number;
  request?: any;
  response?: any;
  rawResponse?: string;
  contentType?: string | null;
  parseError?: string | null;
  error?: string;
  duration?: number;
}

let logs: ApiLog[] = [];
let listeners: ((logs: ApiLog[]) => void)[] = [];

export const ApiLogger = {
  log: (log: Omit<ApiLog, 'id' | 'timestamp'>) => {
    const newLog: ApiLog = {
      ...log,
      id: Date.now().toString() + Math.random().toString(36),
      timestamp: new Date().toISOString(),
    };
    logs = [newLog, ...logs].slice(0, 100);
    listeners.forEach(listener => listener(logs));
  },
  
  clear: () => {
    logs = [];
    listeners.forEach(listener => listener(logs));
  },

  subscribe: (listener: (logs: ApiLog[]) => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  },

  getLogs: () => logs,
};

export default function ApiDebugScreen() {
  const insets = useSafeAreaInsets();
  const [apiLogs, setApiLogs] = useState<ApiLog[]>(ApiLogger.getLogs());
  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);

  useEffect(() => {
    const unsubscribe = ApiLogger.subscribe(setApiLogs);
    return unsubscribe;
  }, []);

  const clearLogs = () => {
    Alert.alert(
      'Clear Logs',
      'Are you sure you want to clear all API logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => ApiLogger.clear()
        }
      ]
    );
  };

  const getStatusIcon = (status: ApiLog['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle color="#10b981" size={20} />;
      case 'error':
        return <AlertCircle color="#ef4444" size={20} />;
      case 'pending':
        return <Info color="#f59e0b" size={20} />;
    }
  };

  const getStatusColor = (status: ApiLog['status']) => {
    switch (status) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'pending': return '#f59e0b';
    }
  };

  const formatJson = (obj: any) => {
    if (!obj) return 'null';
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString();
  };

  if (selectedLog) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Detail Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => setSelectedLog(null)} 
            style={styles.headerButton}
          >
            <X color={Colors.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Request Details</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.detailContainer}>
          {/* Endpoint Info */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Endpoint</Text>
            <View style={[styles.badge, { backgroundColor: Colors.surface }]}>
              <Text style={styles.methodText}>{selectedLog.method}</Text>
            </View>
            <Text style={styles.detailValue}>{selectedLog.endpoint}</Text>
          </View>

          {/* Status */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Status</Text>
            <View style={styles.statusRow}>
              {getStatusIcon(selectedLog.status)}
              <Text style={[styles.statusText, { color: getStatusColor(selectedLog.status) }]}>
                {selectedLog.status.toUpperCase()}
              </Text>
              {selectedLog.statusCode && (
                <Text style={styles.statusCode}>HTTP {selectedLog.statusCode}</Text>
              )}
            </View>
          </View>

          {/* Timestamp & Duration */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.detailValue}>{formatTime(selectedLog.timestamp)}</Text>
            {selectedLog.duration && (
              <Text style={styles.durationText}>Duration: {selectedLog.duration}ms</Text>
            )}
          </View>

          {/* Request */}
          {selectedLog.request && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Request Body</Text>
              <View style={styles.codeBlock}>
                <Text style={styles.codeText}>{formatJson(selectedLog.request)}</Text>
              </View>
            </View>
          )}

          {/* Content Type */}
          {selectedLog.contentType && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Content-Type</Text>
              <Text style={styles.detailValue}>{selectedLog.contentType}</Text>
            </View>
          )}

          {/* Parse Error */}
          {selectedLog.parseError && (
            <View style={styles.detailSection}>
              <Text style={[styles.detailLabel, { color: '#ef4444' }]}>⚠️ Parse Error (Frontend Cannot Parse Response)</Text>
              <View style={[styles.codeBlock, { backgroundColor: '#fee2e2' }]}>  
                <Text style={[styles.codeText, { color: '#991b1b' }]}>
                  {selectedLog.parseError}
                </Text>
              </View>
              <Text style={[styles.warningText, { marginTop: 8 }]}>This means backend returned invalid/empty JSON</Text>
            </View>
          )}

          {/* Raw Response */}
          {selectedLog.rawResponse && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Raw Response (What Backend Actually Sent)</Text>
              <View style={styles.codeBlock}>
                <Text style={styles.codeText}>
                  {selectedLog.rawResponse || '(empty response)'}
                </Text>
              </View>
              {selectedLog.rawResponse.length === 0 && (
                <Text style={styles.warningText}>⚠️ Backend sent empty response - this is a backend issue</Text>
              )}
              {selectedLog.rawResponse.includes('<!DOCTYPE') && (
                <Text style={styles.warningText}>⚠️ Backend sent HTML instead of JSON - this is a backend issue</Text>
              )}
            </View>
          )}

          {/* Response */}
          {selectedLog.response && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Parsed Response</Text>
              <View style={styles.codeBlock}>
                <Text style={styles.codeText}>{formatJson(selectedLog.response)}</Text>
              </View>
            </View>
          )}

          {/* Error */}
          {selectedLog.error && (
            <View style={styles.detailSection}>
              <Text style={[styles.detailLabel, { color: '#ef4444' }]}>Error</Text>
              <View style={[styles.codeBlock, { backgroundColor: '#fee2e2' }]}>
                <Text style={[styles.codeText, { color: '#991b1b' }]}>
                  {selectedLog.error}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <X color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>API Debug</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={clearLogs} style={styles.headerButton}>
            <Trash2 color={Colors.textSecondary} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{apiLogs.length}</Text>
          <Text style={styles.statLabel}>Total Calls</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#10b981' }]}>
            {apiLogs.filter(l => l.status === 'success').length}
          </Text>
          <Text style={styles.statLabel}>Success</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#ef4444' }]}>
            {apiLogs.filter(l => l.status === 'error').length}
          </Text>
          <Text style={styles.statLabel}>Errors</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#f59e0b' }]}>
            {apiLogs.filter(l => l.parseError).length}
          </Text>
          <Text style={styles.statLabel}>Parse Errors</Text>
        </View>
      </View>

      {/* Logs List */}
      <ScrollView style={styles.logsList}>
        {apiLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <Info color={Colors.textMuted} size={48} />
            <Text style={styles.emptyTitle}>No API Calls Yet</Text>
            <Text style={styles.emptyText}>
              All API requests and responses are logged here in real-time.
              Start using the app to see API activity.
            </Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxTitle}>✅ Completed API Integrations:</Text>
              <Text style={styles.infoBoxText}>
                {'• Authentication (Login, Register, Logout, Me)\n'}
                {'• Home Feed (Posts from followed users)\n'}
                {'• Stories (View, Upload, User Stories, Delete, Reactions, Viewers)\n'}
                {'• Posts (Create, Get, Like/Unlike, Comment, Delete, Share)\n'}
                {'• Reels (Upload, Get, Like/Unlike, Comment, Share, Video Playback)\n'}
                {'• Videos (Upload, Get, Like/Unlike, Comment, View, Share, Video Playback)\n'}
                {'• Users (Profile, Follow/Unfollow, Posts, Reels, Videos)\n'}
                {'• Profile Edit (Avatar, Cover, Bio, Details)\n'}
                {'• Search (All, Users, Posts, Hashtags)\n'}
                {'• Notifications (Get, Read, Read All)\n'}
                {'• Messages (Conversations, Messages, Send, Mark Read)\n'}
                {'• Channels (Details, Subscribe/Unsubscribe, Videos)\n'}
                {'• Creator Studio (/creator/* - Stats, Content, Earnings, Analytics)\n'}
                {'• Reports & Admin Functions\n'}
                {'• Watch Time Tracking (Viral Algorithm Support)\n'}
                {'• Recommended Videos (/videos/recommended)'}
              </Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: '#fef3c7', borderColor: '#fbbf24' }]}>
              <Text style={[styles.infoBoxTitle, { color: '#b45309' }]}>🔧 Debug Features:</Text>
              <Text style={[styles.infoBoxText, { color: '#78350f' }]}>
                {'This console automatically captures:\n'}
                {'✓ Full request & response bodies\n'}
                {'✓ HTTP status codes & duration\n'}
                {'✓ JSON parse errors (backend issues)\n'}
                {'✓ Raw response text for debugging\n'}
                {'✓ Network & authentication errors\n'}
                {'✓ FormData uploads indication\n\n'}
                {'Helps identify if issue is frontend or backend.'}
              </Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
              <Text style={[styles.infoBoxTitle, { color: '#dc2626' }]}>⚠️ Common Backend Issues:</Text>
              <Text style={[styles.infoBoxText, { color: '#991b1b' }]}>
                {'1. JSON Parse Error + HTML in raw response\n'}
                {'   → Backend returned error page instead of JSON\n\n'}
                {'2. HTTP 404 Not Found\n'}
                {'   → Endpoint missing or htaccess misconfigured\n\n'}
                {'3. HTTP 400 Bad Request\n'}
                {'   → Missing required fields (e.g., device_id)\n\n'}
                {'4. HTTP 401 Unauthorized\n'}
                {'   → Invalid/expired token or auth issue\n\n'}
                {'5. Empty Raw Response\n'}
                {'   → Backend script crashed before output\n\n'}
                {'6. HTTP 500 Internal Server Error\n'}
                {'   → Backend PHP/database error'}
              </Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }]}>
              <Text style={[styles.infoBoxTitle, { color: '#1e40af' }]}>🎯 Critical API Endpoints:</Text>
              <Text style={[styles.infoBoxText, { color: '#1e3a8a' }]}>
                {'POST /videos/action/view\n'}
                {'  → Tracks video views (requires device_id)\n\n'}
                {'POST /videos/track-watch\n'}
                {'  → Tracks watch time for viral algorithm\n\n'}
                {'GET /channels/details?id={id}\n'}
                {'  → Gets channel info for video player\n\n'}
                {'GET /videos/details?id={id}\n'}
                {'  → Gets video details for playback\n\n'}
                {'GET /videos/recommended?video_id={id}\n'}
                {'  → Gets recommended videos for autoplay\n\n'}
                {'GET /reels?page=1&limit=20\n'}
                {'  → Gets reels feed with pagination'}
              </Text>
            </View>
            <Text style={styles.apiNote}>
              {'📌 API Base URL: https://www.moviedbr.com/api\n'}
              {'⚠️ All endpoints use clean URLs (no .php extension)\n'}
              {'🔑 Authenticated requests include Bearer token\n'}
              {'📊 Frontend logging active - all API calls logged here'}
            </Text>
          </View>
        ) : (
          apiLogs.map(log => (
            <TouchableOpacity 
              key={log.id} 
              style={styles.logItem}
              onPress={() => setSelectedLog(log)}
            >
              <View style={styles.logHeader}>
                <View style={styles.logTitleRow}>
                  {getStatusIcon(log.status)}
                  <Text style={styles.logMethod}>{log.method}</Text>
                  <Text style={styles.logEndpoint} numberOfLines={1}>
                    {log.endpoint}
                  </Text>
                </View>
                <Text style={styles.logTime}>{formatTime(log.timestamp)}</Text>
              </View>
              
              {log.statusCode && (
                <Text style={styles.logStatus}>HTTP {log.statusCode}</Text>
              )}
              
              {log.error && (
                <Text style={styles.logError} numberOfLines={1}>
                  {log.error}
                </Text>
              )}
              
              {log.duration && (
                <Text style={styles.logDuration}>{log.duration}ms</Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  logsList: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  logItem: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  logTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  logMethod: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  logEndpoint: {
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
  logTime: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  logStatus: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  logError: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  logDuration: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  detailContainer: {
    flex: 1,
    padding: 16,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  detailValue: {
    fontSize: 15,
    color: Colors.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  statusCode: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  durationText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  methodText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  codeBlock: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  codeText: {
    fontSize: 12,
    color: '#e2e8f0',
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
  },
  warningText: {
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '600' as const,
    marginTop: 4,
  },
  infoBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoBoxTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 12,
  },
  infoBoxText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
  },
  apiNote: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    marginHorizontal: 24,
    lineHeight: 18,
  },
});
