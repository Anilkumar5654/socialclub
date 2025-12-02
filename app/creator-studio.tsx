import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import {
  TrendingUp,
  Eye,
  Heart,
  Users,
  DollarSign,
  Clock,
  Film,
  Image as ImageIcon,
  Video,
  Plus,
  RefreshCcw,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueries, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { api, MEDIA_BASE_URL } from '@/services/api';
import { formatTimeAgo } from '@/constants/formatTimeAgo'; // Assuming this utility exists

const { width } = Dimensions.get('window');

// --- INTERFACES (Re-defined for clarity) ---
interface CreatorStats {
  total_followers: number;
  total_views: number;
  total_likes: number;
  engagement_rate: number;
  monthly_growth?: { followers: number; views: number; engagement: number; };
  watch_time_minutes: number;
}
interface Earnings { total_earnings: number; pending_earnings: number; paid_earnings: number; ad_revenue: number; reels_bonus: number; period: string; }
interface ChannelData { id: string; name: string; subscribers_count: number; }

// --- HELPER COMPONENTS ---
function StatCard({ icon, title, value, change }: { icon: React.ReactNode; title: string; value: string; change?: string }) {
  const isPositive = change?.startsWith('+');

  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {change && (
        <View style={styles.statChangeRow}>
          <Text style={[styles.statChange, isPositive && styles.statChangePositive]}>
            {change}
          </Text>
          <Text style={styles.statChangeLabel}>this month</Text>
        </View>
      )}
    </View>
  );
}

function ContentItem({ type, item, onPress }: { type: 'post' | 'reel' | 'video'; item: any; onPress?: () => void }) {
  const getMediaUrl = (path: string | undefined) => {
    if (!path) return '';
    return path.startsWith('http') ? path : `${MEDIA_BASE_URL}/${path}`;
  };

  const thumbnailUri = getMediaUrl(item.thumbnail_url || item.thumbnailUrl || item.images?.[0]);
  const title = item.title || item.caption || item.content || 'Untitled Content';
  const views = item.views || 0;
  const likes = item.likes || 0;
  const timestamp = item.timestamp || item.created_at || item.uploadDate || item.upload_date;
  const viralScore = item.viral_score;

  const formatCount = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <TouchableOpacity style={styles.contentItem} onPress={onPress}>
      <View style={styles.contentThumbnailContainer}>
        <Image source={{ uri: thumbnailUri }} style={styles.contentThumbnail} contentFit="cover" />
        {type !== 'post' && viralScore !== undefined && (
          <View style={styles.viralScoreBadge}>
            <Text style={styles.viralScoreText}>Score {viralScore.toFixed(0)}</Text>
          </View>
        )}
      </View>
      <View style={styles.contentInfo}>
        <Text style={styles.contentTitle} numberOfLines={2}>{title}</Text>
        <View style={styles.contentStats}>
          <View style={styles.contentStat}>
            <Eye color={Colors.textSecondary} size={14} />
            <Text style={styles.contentStatText}>{formatCount(views)}</Text>
          </View>
          <View style={styles.contentStat}>
            <Heart color={Colors.textSecondary} size={14} />
            <Text style={styles.contentStatText}>{formatCount(likes)}</Text>
          </View>
        </View>
        <Text style={styles.contentDate}>{formatTimeAgo(timestamp)}</Text>
      </View>
      <ChevronRight color={Colors.textSecondary} size={20} />
    </TouchableOpacity>
  );
}

// --- MAIN SCREEN ---
export default function CreatorStudioScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'earnings'>('overview');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');

  // --- 1. DATA FETCHING ---
  const { data: channelCheck, isLoading: loadingChannel, refetch: refetchChannel } = useQuery({
    queryKey: ['check-user-channel'],
    queryFn: () => api.channels.checkUserChannel(user?.id || ''),
    enabled: !!user?.id,
  });

  const hasChannel = channelCheck?.has_channel || false;
  const channelData = channelCheck?.data as ChannelData | null || null;

  // Fetch Stats, Earnings, and Content concurrently if channel exists
  const results = useQueries({
    queries: [
      { queryKey: ['creator-stats'], queryFn: api.creator.getStats, enabled: hasChannel },
      { queryKey: ['creator-earnings'], queryFn: () => api.creator.getEarnings('month'), enabled: hasChannel },
      { queryKey: ['creator-content-posts'], queryFn: () => api.creator.getContent('posts', 1), enabled: hasChannel },
      { queryKey: ['creator-content-reels'], queryFn: () => api.creator.getContent('reels', 1), enabled: hasChannel },
      { queryKey: ['creator-content-videos'], queryFn: () => api.creator.getContent('videos', 1), enabled: hasChannel },
    ],
  });

  const [statsRes, earningsRes, postsRes, reelsRes, videosRes] = results;

  const isTotalLoading = loadingChannel || statsRes.isLoading || earningsRes.isLoading || postsRes.isLoading || reelsRes.isLoading || videosRes.isLoading;

  const stats = statsRes.data?.stats as CreatorStats | null;
  const earnings = earningsRes.data?.earnings as Earnings | null;
  const posts = postsRes.data?.content || [];
  const reels = reelsRes.data?.content || [];
  const videos = videosRes.data?.content || [];

  const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['creator-stats'] });
      queryClient.invalidateQueries({ queryKey: ['creator-earnings'] });
      queryClient.invalidateQueries({ queryKey: ['creator-content-posts'] });
      queryClient.invalidateQueries({ queryKey: ['creator-content-reels'] });
      queryClient.invalidateQueries({ queryKey: ['creator-content-videos'] });
      refetchChannel();
  };

  const createChannelMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) => api.channels.create(data),
    onSuccess: () => {
      Alert.alert('Success', 'Channel created successfully!');
      setShowCreateChannel(false);
      setChannelName('');
      setChannelDescription('');
      queryClient.invalidateQueries({ queryKey: ['check-user-channel'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to create channel');
    },
  });
  const isCreatingChannel = createChannelMutation.isPending;

  const handleCreateChannel = () => {
    if (!channelName.trim()) {
      Alert.alert('Error', 'Please enter a channel name');
      return;
    }
    createChannelMutation.mutate({ name: channelName, description: channelDescription });
  };

  const handleContentPress = (type: 'post' | 'reel' | 'video', id: string) => {
    if (type === 'post') {
      router.push(`/post/${id}`);
    } else if (type === 'reel') {
      // Re-route to the main reels page
      router.push('/(tabs)/reels'); 
    } else if (type === 'video') {
      router.push(`/video-analytics?videoId=${id}`);
    }
  };

  const formatViewsDisplay = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDurationDisplay = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // --- RENDER LOGIC ---

  if (isTotalLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Stack.Screen options={{ title: 'Studio', headerTintColor: Colors.text, headerStyle: { backgroundColor: Colors.background } }} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  // A. No Channel View
  if (!hasChannel && !showCreateChannel) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Stack.Screen options={{ title: 'Studio', headerTintColor: Colors.text, headerStyle: { backgroundColor: Colors.background } }} />
        <Film color={Colors.textSecondary} size={80} />
        <Text style={styles.noChannelTitle}>No Channel Found</Text>
        <Text style={styles.noChannelSubtitle}>
          You need to create a channel to access Creator Studio features.
        </Text>
        <TouchableOpacity style={styles.createChannelButton} onPress={() => setShowCreateChannel(true)}>
          <Plus color={Colors.text} size={20} />
          <Text style={styles.createChannelButtonText}>Create Channel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // B. Create Channel Form View
  if (showCreateChannel) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Create Channel', headerTintColor: Colors.text, headerStyle: { backgroundColor: Colors.background } }} />
        <ScrollView style={styles.content} contentContainerStyle={styles.createChannelContent}>
          <Text style={styles.createChannelTitle}>Create Your Channel</Text>
          <Text style={styles.createChannelDescription}>Start your creator journey!</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Channel Name *</Text>
            <TextInput style={styles.input} placeholder="Enter channel name" placeholderTextColor={Colors.textMuted} value={channelName} onChangeText={setChannelName} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Tell viewers about your channel" placeholderTextColor={Colors.textMuted} value={channelDescription} onChangeText={setChannelDescription} multiline numberOfLines={4} />
          </View>

          <TouchableOpacity style={[styles.submitButton, isCreatingChannel && styles.submitButtonDisabled]} onPress={handleCreateChannel} disabled={isCreatingChannel}>
            {isCreatingChannel ? <ActivityIndicator color={Colors.text} /> : <Text style={styles.submitButtonText}>Create Channel</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={() => setShowCreateChannel(false)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // C. Main Studio Dashboard View
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Creator Studio',
          headerTintColor: Colors.text,
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
              <RefreshCcw color={Colors.primary} size={20} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.tabBar}>
        {['overview', 'content', 'earnings'].map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab as 'overview' | 'content' | 'earnings')}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* === OVERVIEW TAB (YouTube Studio Look) === */}
        {activeTab === 'overview' && (
          <>
            {/* Channel Profile Header */}
            <View style={styles.channelInfoSection}>
                <View style={styles.channelHeader}>
                  <Text style={styles.channelName}>{channelData?.name || 'Channel Name'}</Text>
                  <Text style={styles.channelStats}>
                    {channelData?.subscribers_count?.toLocaleString() || '0'} subscribers
                  </Text>
                </View>
            </View>

            {/* Analytics Cards */}
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>Channel Analytics</Text>
              
              <View style={styles.statsRow}>
                {/* Views Card */}
                <StatCard 
                    icon={<Eye color={Colors.primary} size={24} />}
                    title="Views"
                    value={stats?.total_views ? formatViewsDisplay(stats.total_views) : '0'} 
                    change={stats?.monthly_growth?.views ? `+${stats.monthly_growth.views}%` : undefined}
                />
                {/* Watch Time Card */}
                <StatCard 
                    icon={<Clock color={Colors.error} size={24} />}
                    title="Watch time (hrs)" 
                    value={stats?.watch_time_minutes ? formatDurationDisplay(stats.watch_time_minutes) : '0m'} 
                    change={stats?.monthly_growth?.engagement ? `+${stats.monthly_growth.engagement}%` : undefined}
                />
              </View>
            </View>
            
            {/* Latest Content Section */}
            <View style={styles.section}>
                <Text style={styles.sectionHeading}>Latest Published Content</Text>
                
                {videos.length === 0 && posts.length === 0 && reels.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Video color={Colors.textSecondary} size={40} />
                        <Text style={styles.emptyText}>No content statistics available yet.</Text>
                    </View>
                ) : (
                    // Display Videos (Long form content prioritized)
                    videos.slice(0, 3).map((content: any) => (
                        <ContentItem key={content.id} type="video" item={content} onPress={() => handleContentPress('video', content.id)} />
                    ))
                )}
            </View>
          </>
        )}

        {/* === CONTENT TAB === */}
        {activeTab === 'content' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Posts ({posts.length})</Text>
              {posts.map((post) => (<ContentItem key={post.id} type="post" item={post} onPress={() => handleContentPress('post', post.id)} />))}
              {posts.length === 0 && <Text style={styles.noDataText}>No posts yet.</Text>}
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reels ({reels.length})</Text>
              {reels.map((reel) => (<ContentItem key={reel.id} type="reel" item={reel} onPress={() => handleContentPress('reel', reel.id)} />))}
              {reels.length === 0 && <Text style={styles.noDataText}>No reels yet.</Text>}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Videos ({videos.length})</Text>
              {videos.map((video) => (<ContentItem key={video.id} type="video" item={video} onPress={() => handleContentPress('video', video.id)} />))}
              {videos.length === 0 && <Text style={styles.noDataText}>No videos yet.</Text>}
            </View>
          </>
        )}

        {/* === EARNINGS TAB === */}
        {activeTab === 'earnings' && (
          <View style={styles.section}>
            {earnings ? (
              <>
                <Text style={styles.sectionTitle}>Total Earnings</Text>
                <View style={styles.earningsCard}>
                  <DollarSign color={Colors.success} size={32} />
                  <Text style={styles.totalEarnings}>
                    ${earnings.total_earnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <Text style={styles.earningsSubtext}>This {earnings.period}</Text>
                </View>

                <View style={styles.earningsBreakdown}>
                    <View style={styles.earningsRow}>
                      <Text style={styles.earningsLabel}>Available:</Text>
                      <Text style={styles.earningsValue}>
                        ${(earnings.total_earnings - earnings.pending_earnings - earnings.paid_earnings).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <View style={styles.earningsRow}>
                      <Text style={styles.earningsLabel}>Pending:</Text>
                      <Text style={[styles.earningsValue, { color: Colors.warning }]}>
                        ${earnings.pending_earnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <View style={styles.earningsRow}>
                      <Text style={styles.earningsLabel}>Paid Out:</Text>
                      <Text style={[styles.earningsValue, { color: Colors.success }]}>
                        ${earnings.paid_earnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.withdrawButton} onPress={() => Alert.alert('Coming Soon', 'Withdrawal feature will be available soon')}>
                  <Text style={styles.withdrawButtonText}>Request Withdrawal</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={[styles.emptyState]}>
                <DollarSign color={Colors.textSecondary} size={60} />
                <Text style={styles.emptyTitle}>No Earnings Yet</Text>
                <Text style={styles.emptyText}>Start creating content to earn revenue from ads, bonuses, and more!</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, },
  tab: { flex: 1, paddingVertical: 16, alignItems: 'center', },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary, },
  tabText: { fontSize: 15, fontWeight: '600' as const, color: Colors.textSecondary, },
  tabTextActive: { color: Colors.primary, },
  content: { flex: 1, },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, },
  sectionHeading: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, marginTop: 20, marginBottom: 10, },
  sectionTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, marginBottom: 16, },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20, },
  statCard: { width: (width - 42) / 2, backgroundColor: Colors.surface, borderRadius: 10, padding: 15, borderWidth: 1, borderColor: Colors.border, },
  statIcon: { marginBottom: 12, },
  statTitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4, },
  statValue: { fontSize: 28, fontWeight: 'bold', color: Colors.text, marginBottom: 4, },
  statChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statChange: { fontSize: 12, color: Colors.textMuted, },
  statChangeLabel: { fontSize: 12, color: Colors.textSecondary },
  statChangePositive: { color: Colors.success, },
  contentItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, },
  contentThumbnailContainer: { width: 120, aspectRatio: 16 / 9, },
  contentThumbnail: { width: '100%', height: '100%', borderRadius: 8, backgroundColor: Colors.surface, },
  viralScoreBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, },
  viralScoreText: { fontSize: 11, fontWeight: '700' as const, color: Colors.text, },
  contentInfo: { flex: 1, marginLeft: -4, },
  contentTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.text, lineHeight: 18, marginBottom: 6, },
  contentStats: { flexDirection: 'row', gap: 12, marginBottom: 4, },
  contentStat: { flexDirection: 'row', alignItems: 'center', gap: 4, },
  contentStatText: { fontSize: 12, color: Colors.textSecondary, },
  contentDate: { fontSize: 11, color: Colors.textMuted, },
  earningsCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 32, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.border, },
  totalEarnings: { fontSize: 48, fontWeight: '700' as const, color: Colors.success, },
  earningsBreakdown: { marginTop: 16, gap: 12, },
  earningsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', },
  earningsLabel: { fontSize: 15, color: Colors.textSecondary, },
  earningsValue: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, },
  withdrawButton: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12, },
  withdrawButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, },
  channelInfoSection: { padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, },
  channelHeader: { gap: 4, },
  channelName: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, },
  channelStats: { fontSize: 14, color: Colors.textSecondary, },
  noChannelTitle: { fontSize: 24, fontWeight: '700' as const, color: Colors.text, marginTop: 24, marginBottom: 8, textAlign: 'center', },
  noChannelSubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32, paddingHorizontal: 16, },
  createChannelButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, },
  createChannelButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, },
  createChannelContent: { padding: 16, },
  createChannelTitle: { fontSize: 28, fontWeight: '700' as const, color: Colors.text, marginBottom: 12, },
  createChannelDescription: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 32, },
  inputGroup: { marginBottom: 24, },
  inputLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.text, marginBottom: 8, },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Colors.text, },
  textArea: { minHeight: 100, paddingTop: 14, textAlignVertical: 'top', },
  submitButton: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12, },
  submitButtonDisabled: { opacity: 0.6, },
  submitButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, },
  cancelButton: { paddingVertical: 12, alignItems: 'center', },
  cancelButtonText: { fontSize: 15, fontWeight: '600' as const, color: Colors.textSecondary, },
  refreshButton: { padding: 8, },
  centerContent: { justifyContent: 'center', alignItems: 'center', padding: 32, },
  loadingText: { fontSize: 16, color: Colors.textSecondary, marginTop: 16, },
  noDataText: { textAlign: 'center', color: Colors.textSecondary, marginTop: 30, },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12, },
  emptyTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, marginTop: 8, },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', },
});
