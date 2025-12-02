import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import {
  TrendingUp,
  Eye,
  Heart,
  Users,
  DollarSign,
  BarChart3,
  ChevronRight,
  Film,
  Image as ImageIcon,
  Video,
  Plus,
  Bell, // Bell added for header
  User, // User added for profile placeholder
} from 'lucide-react-native';
import React, { useState, useEffect, useMemo } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { api, MEDIA_BASE_URL } from '@/services/api';
import { formatTimeAgo } from '@/constants/timeFormat';

const { width } = Dimensions.get('window');

// ----------------------------------------------------------------
// HELPER COMPONENTS (UI IMPROVEMENTS APPLIED)
// ----------------------------------------------------------------

function StatCard({ icon, title, value, change }: { icon: React.ReactNode; title: string; value: string; change?: string }) {
    const isPositive = change?.startsWith('+');
  
    return (
      <View style={styles.statCard}>
        {/* Icon is top left */}
        <View style={styles.statIcon}>{icon}</View>
        
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
        
        {change && (
          <Text style={[styles.statChange, isPositive ? styles.statChangePositive : styles.statChangeNegative]}>
            {change} this month
          </Text>
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
    const title = type === 'video' ? (item.title || item.caption || item.content) : (item.content || item.caption || 'Untitled');
    const views = item.views || 0;
    const likes = item.likes || 0;
    const timestamp = item.timestamp || item.created_at || item.uploadDate || item.upload_date;
    const viralScore = item.viral_score;
  
    return (
      <TouchableOpacity style={styles.contentItem} onPress={onPress}>
        <View style={[styles.contentThumbnailContainer, type === 'reel' && styles.reelThumbnailContainer]}>
          <Image
            source={{ uri: thumbnailUri }}
            style={[styles.contentThumbnail, type === 'reel' && styles.reelThumbnail]}
            contentFit="cover"
          />
          {(type === 'video' || type === 'reel') && viralScore !== undefined && (
            <View style={styles.viralScoreBadge}>
              <Text style={styles.viralScoreText}>{viralScore.toFixed(0)}</Text>
            </View>
          )}
        </View>
        <View style={styles.contentInfo}>
          <Text style={styles.contentTitle} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.contentStats}>
            <View style={styles.contentStat}>
              <Eye color={Colors.textSecondary} size={14} />
              <Text style={styles.contentStatText}>
                {views > 999 ? `${(views / 1000).toFixed(1)}K` : views}
              </Text>
            </View>
            <View style={styles.contentStat}>
              <Heart color={Colors.textSecondary} size={14} />
              <Text style={styles.contentStatText}>
                {likes > 999 ? `${(likes / 1000).toFixed(1)}K` : likes}
              </Text>
            </View>
          </View>
          <Text style={styles.contentDate}>{formatTimeAgo(timestamp)}</Text>
        </View>
        <ChevronRight color={Colors.textSecondary} size={20} />
      </TouchableOpacity>
    );
  }

// ----------------------------------------------------------------
// INTERFACES (LOGIC UNCHANGED)
// ----------------------------------------------------------------

interface Channel {
    id: string;
    name: string;
    description: string;
    avatar: string;
    cover_photo: string;
    subscribers_count: number;
    videos_count: number;
    created_at: string;
  }
  
  interface CreatorStats {
    total_followers: number;
    total_views: number;
    total_likes: number;
    engagement_rate: number;
    monthly_growth?: {
      followers: number;
      views: number;
      engagement: number;
    };
  }
  
  interface Earnings {
    total_earnings: number;
    pending_earnings: number;
    paid_earnings: number;
    ad_revenue: number;
    reels_bonus: number;
    period: string;
  }

// ----------------------------------------------------------------
// MAIN SCREEN COMPONENT
// ----------------------------------------------------------------

export default function CreatorStudioScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // useSafeAreaInsets for Status Bar Fix
  const insets = useSafeAreaInsets(); 
  
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'earnings'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  
  const availableEarnings = useMemo(() => {
    if (!earnings) return 0;
    return earnings.total_earnings - earnings.pending_earnings - earnings.paid_earnings;
  }, [earnings]);
  
  const canWithdraw = availableEarnings >= 100;

  // ------------------------------------------------
  // LOGIC FUNCTIONS (UNCHANGED)
  // ------------------------------------------------

  useEffect(() => {
    loadCreatorData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCreatorData = async () => {
    setIsLoading(true);
    try {
      // API call logic remains the same
      const channelResponse = await api.channels.checkUserChannel(user?.id || '');
      
      if (channelResponse.success && channelResponse.has_channel && channelResponse.data) {
        setChannel(channelResponse.data);
        await loadStatsAndContent();
      } else {
        setChannel(null);
      }
    } catch (error: any) {
      setChannel(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStatsAndContent = async () => {
    try {
      // API call logic remains the same
      const [statsRes, earningsRes, postsRes, reelsRes, videosRes] = await Promise.all([
        api.creator.getStats().catch((err) => { return { stats: null }; }),
        api.creator.getEarnings('month').catch((err) => { return { earnings: null }; }),
        api.creator.getContent('posts', 1).catch((err) => { return { content: [] }; }),
        api.creator.getContent('reels', 1).catch((err) => { return { content: [] }; }),
        api.creator.getContent('videos', 1).catch((err) => { return { content: [] }; }),
      ]);

      setStats(statsRes.stats);
      setEarnings(earningsRes.earnings);
      setPosts(postsRes.content || []);
      setReels(reelsRes.content || []);
      setVideos(videosRes.content || []);
    } catch (error) {
      console.error('[Creator Studio] Critical error:', error);
    }
  };

  const handleCreateChannel = async () => {
    if (!channelName.trim()) {
      Alert.alert('Error', 'Please enter a channel name');
      return;
    }

    setIsCreatingChannel(true);
    try {
      // API call logic remains the same
      const response = await api.channels.create({
        name: channelName,
        description: channelDescription,
      });

      if (response.channel) {
        setChannel(response.channel);
        setShowCreateChannel(false);
        setChannelName('');
        setChannelDescription('');
        Alert.alert('Success', 'Channel created successfully!');
        await loadStatsAndContent();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create channel');
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleContentPress = (type: 'post' | 'reel' | 'video', id: string) => {
    // Navigation logic remains the same
    if (type === 'post') {
      router.push(`/post/${id}`);
    } else if (type === 'reel') {
      router.push('/reels');
    } else if (type === 'video') {
      router.push(`/video-analytics?videoId=${id}`);
    }
  };
  
  // ------------------------------------------------
  // RENDER LOGIC (UI UPDATED)
  // ------------------------------------------------

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Stack.Screen options={{ title: 'Creator Studio', headerStyle: { backgroundColor: Colors.background }, headerTintColor: Colors.text, headerShadowVisible: false }}/>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading creator data...</Text>
      </View>
    );
  }

  if (!channel && !showCreateChannel) {
    // No Channel Found UI unchanged
    return (
        <View style={[styles.container, styles.centerContent]}>
          <Stack.Screen options={{ title: 'Creator Studio', headerStyle: { backgroundColor: Colors.background }, headerTintColor: Colors.text, headerShadowVisible: false }}/>
          <Film color={Colors.textSecondary} size={80} />
          <Text style={styles.noChannelTitle}>No Channel Found</Text>
          <Text style={styles.noChannelSubtitle}>
            You need to create a channel to access Creator Studio features and upload long videos.
          </Text>
          <TouchableOpacity
            style={styles.createChannelButton}
            onPress={() => setShowCreateChannel(true)}
          >
            <Plus color={Colors.text} size={20} />
            <Text style={styles.createChannelButtonText}>Create Channel</Text>
          </TouchableOpacity>
        </View>
      );
  }

  if (showCreateChannel) {
    // Create Channel UI unchanged
    return (
        <View style={styles.container}>
          <Stack.Screen
            options={{
              title: 'Create Channel',
              headerStyle: { backgroundColor: Colors.background },
              headerTintColor: Colors.text,
              headerShadowVisible: false,
            }}
          />
          <ScrollView style={styles.content} contentContainerStyle={styles.createChannelContent}>
            <Text style={styles.createChannelTitle}>Create Your Channel</Text>
            <Text style={styles.createChannelDescription}>
              Start your creator journey! Create a channel to upload long-form videos and access monetization features.
            </Text>
  
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Channel Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter channel name"
                placeholderTextColor={Colors.textMuted}
                value={channelName}
                onChangeText={setChannelName}
              />
            </View>
  
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell viewers about your channel"
                placeholderTextColor={Colors.textMuted}
                value={channelDescription}
                onChangeText={setChannelDescription}
                multiline
                numberOfLines={4}
              />
            </View>
  
            <TouchableOpacity
              style={[styles.submitButton, isCreatingChannel && styles.submitButtonDisabled]}
              onPress={handleCreateChannel}
              disabled={isCreatingChannel}
            >
              {isCreatingChannel ? (
                <ActivityIndicator color={Colors.text} />
              ) : (
                <Text style={styles.submitButtonText}>Create Channel</Text>
              )}
            </TouchableOpacity>
  
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowCreateChannel(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
  }

  return (
    // SafeAreaView fix for Status Bar overlay
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}> 
      <Stack.Screen
        options={{
          // Header Title: 'Studio'
          title: 'Studio', 
          headerStyle: { backgroundColor: Colors.background, borderBottomWidth: 0, elevation: 0 },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
          // Right Icons: Plus, Bell, Profile
          headerRight: () => (
            <View style={styles.headerRightContainer}>
              <TouchableOpacity onPress={() => Alert.alert('Create', 'Open content creation options')} style={styles.headerIcon}>
                <Plus color={Colors.text} size={24} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert('Notifications', 'Show notifications')} style={styles.headerIcon}>
                <Bell color={Colors.text} size={24} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert('Profile', 'Open profile settings')}>
                {/* Profile Avatar Placeholder */}
                <View style={styles.profileAvatarPlaceholder}>
                    <User color={Colors.textMuted} size={20} />
                </View>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      
      {/* Sticky Channel Header (YouTube Studio style) */}
      {channel && (
        <View style={styles.stickyChannelHeader}>
          {/* Channel Avatar */}
          <Image
            source={{ uri: channel.avatar || 'https://via.placeholder.com/60' }} 
            style={styles.channelAvatar}
            contentFit="cover"
          />
          <View style={styles.channelHeaderInfo}>
            <Text style={styles.channelName}>{channel.name}</Text>
            <Text style={styles.channelStats}>
              {channel.subscribers_count.toLocaleString()} total subscribers
            </Text>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, activeTab === 'overview' && styles.tabActive]} onPress={() => setActiveTab('overview')}>
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'content' && styles.tabActive]} onPress={() => setActiveTab('content')}>
          <Text style={[styles.tabText, activeTab === 'content' && styles.tabTextActive]}>Content</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'earnings' && styles.tabActive]} onPress={() => setActiveTab('earnings')}>
          <Text style={[styles.tabText, activeTab === 'earnings' && styles.tabTextActive]}>Earnings</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'overview' && (
          <>
            {/* Overview Top Analytics (Views and Watch Time - YouTube Style) */}
            {stats && (
                <View style={styles.sectionNoBorder}>
                    <Text style={styles.timeFilterTextContainer}>Last 28 days</Text>
                    <View style={styles.overviewAnalyticsGrid}>
                        <View style={styles.analyticsStatCard}>
                            <Text style={styles.analyticsStatValue}>
                                {stats.total_views > 999 ? `${(stats.total_views / 1000).toFixed(1)}K` : stats.total_views}
                            </Text>
                            <Text style={styles.analyticsStatTitle}>Views</Text>
                        </View>
                        <View style={styles.analyticsStatCard}>
                            {/* Watch Time is hardcoded/placeholder as per original data structure */}
                            <Text style={styles.analyticsStatValue}>40.0</Text> 
                            <Text style={styles.analyticsStatTitle}>Watch time (hours)</Text>
                        </View>
                    </View>
                </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Performance</Text>
              {stats ? (
                <View style={styles.statsGrid}> 
                  <StatCard icon={<Users color={Colors.primary} size={24} />} title="Followers" value={stats.total_followers.toLocaleString()} change={stats.monthly_growth?.followers ? `+${stats.monthly_growth.followers}%` : undefined}/>
                  <StatCard icon={<Eye color={Colors.success} size={24} />} title="Views" value={stats.total_views > 999 ? `${(stats.total_views / 1000).toFixed(1)}K` : stats.total_views.toString()} change={stats.monthly_growth?.views ? `+${stats.monthly_growth.views}%` : undefined}/>
                  <StatCard icon={<Heart color={Colors.error} size={24} />} title="Likes" value={stats.total_likes > 999 ? `${(stats.total_likes / 1000).toFixed(1)}K` : stats.total_likes.toString()} change={stats.monthly_growth?.engagement ? `+${stats.monthly_growth.engagement}%` : undefined}/>
                  <StatCard icon={<TrendingUp color={Colors.info} size={24} />} title="Engagement" value={`${stats.engagement_rate.toFixed(1)}%`} change={stats.monthly_growth?.engagement ? `+${stats.monthly_growth.engagement}%` : undefined}/>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No statistics available yet</Text>
                </View>
              )}
            </View>

            {reels.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Performing</Text>
                <View style={styles.topPerformingSection}>
                  <Text style={styles.topPerformingLabel}>Most Popular Reel</Text>
                  <TouchableOpacity style={styles.topPerformingCard} onPress={() => handleContentPress('reel', reels[0].id)}>
                    <Image source={{ uri: `${MEDIA_BASE_URL}/${reels[0].thumbnail_url || reels[0].thumbnailUrl}` }} style={styles.topPerformingImage} contentFit="cover"/>
                    <View style={styles.topPerformingInfo}>
                      <Text style={styles.topPerformingTitle} numberOfLines={2}>{reels[0].caption || 'Untitled'}</Text>
                      <View style={styles.topPerformingStats}>
                        <View style={styles.topPerformingStat}>
                          <Eye color={Colors.textSecondary} size={16} />
                          <Text style={styles.topPerformingStatText}>{reels[0].views > 999 ? `${(reels[0].views / 1000).toFixed(1)}K` : reels[0].views}</Text>
                        </View>
                        <View style={styles.topPerformingStat}>
                          <Heart color={Colors.textSecondary} size={16} />
                          <Text style={styles.topPerformingStatText}>{reels[0].likes > 999 ? `${(reels[0].likes / 1000).toFixed(1)}K` : reels[0].likes}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {stats && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Analytics</Text>
                </View>
                <View style={styles.analyticsCard}>
                  <BarChart3 color={Colors.primary} size={48} />
                  <Text style={styles.analyticsText}>
                    Your content reached {stats.total_views > 999999 ? `${(stats.total_views / 1000000).toFixed(1)}M` : `${(stats.total_views / 1000).toFixed(1)}K`} people this month
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {activeTab === 'content' && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Posts</Text>
                <View style={styles.contentCount}>
                  <ImageIcon color={Colors.textSecondary} size={16} />
                  <Text style={styles.contentCountText}>{posts.length}</Text>
                </View>
              </View>
              {posts.length > 0 ? (
                posts.map((post) => (
                  <ContentItem key={post.id} type="post" item={post} onPress={() => handleContentPress('post', post.id)}/>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <ImageIcon color={Colors.textSecondary} size={40} />
                  <Text style={styles.emptyText}>No posts yet</Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Reels</Text>
                <View style={styles.contentCount}>
                  <Film color={Colors.textSecondary} size={16} />
                  <Text style={styles.contentCountText}>{reels.length}</Text>
                </View>
              </View>
              {reels.length > 0 ? (
                reels.map((reel) => (
                  <ContentItem key={reel.id} type="reel" item={reel} onPress={() => handleContentPress('reel', reel.id)}/>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Film color={Colors.textSecondary} size={40} />
                  <Text style={styles.emptyText}>No reels yet</Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Videos</Text>
                <View style={styles.contentCount}>
                  <Video color={Colors.textSecondary} size={16} />
                  <Text style={styles.contentCountText}>{videos.length}</Text>
                </View>
              </View>
              <Text style={styles.sectionHint}>Tap on a video to view detailed analytics</Text>
              {videos.length > 0 ? (
                videos.map((video) => (
                  <ContentItem key={video.id} type="video" item={video} onPress={() => handleContentPress('video', video.id)}/>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Video color={Colors.textSecondary} size={40} />
                  <Text style={styles.emptyText}>No videos yet. Create a channel to upload videos!</Text>
                </View>
              )}
            </View>
          </>
        )}

        {activeTab === 'earnings' && (
          <>
            {earnings ? (
              <>
                <View style={styles.section}>
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
                        ${availableEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Revenue Breakdown</Text>
                  <View style={styles.revenueItem}>
                    <View style={styles.revenueInfo}>
                      <Text style={styles.revenueTitle}>Ad Revenue</Text>
                      <Text style={styles.revenueDescription}>From video ads</Text>
                    </View>
                    <Text style={styles.revenueAmount}>
                      ${earnings.ad_revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={styles.revenueItem}>
                    <View style={styles.revenueInfo}>
                      <Text style={styles.revenueTitle}>Reels Bonus</Text>
                      <Text style={styles.revenueDescription}>Performance bonus</Text>
                    </View>
                    <Text style={styles.revenueAmount}>
                      ${earnings.reels_bonus.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <TouchableOpacity
                    style={[styles.withdrawButton, !canWithdraw && styles.submitButtonDisabled]}
                    onPress={() => canWithdraw ? Alert.alert('Coming Soon', 'Withdrawal feature will be available soon') : Alert.alert('Insufficient Balance', 'Minimum withdrawal amount is $100.')}
                    disabled={!canWithdraw}
                  >
                    <Text style={styles.withdrawButtonText}>Request Withdrawal</Text>
                  </TouchableOpacity>
                  <Text style={[styles.withdrawNote, !canWithdraw && styles.withdrawNoteDanger]}>
                    Minimum withdrawal amount is $100. Payments are processed within 3-5 business days.
                  </Text>
                </View>
              </>
            ) : (
              <View style={[styles.section, styles.emptyState]}>
                <DollarSign color={Colors.textSecondary} size={60} />
                <Text style={styles.emptyTitle}>No Earnings Yet</Text>
                <Text style={styles.emptyText}>Start creating content to earn revenue from ads, bonuses, and more!</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ----------------------------------------------------------------
// STYLES (FINAL CLEANUP)
// ----------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.background,
    },
    tab: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
    },
    tabActive: {
        borderBottomWidth: 3,
        borderBottomColor: Colors.primary,
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600' as const,
        color: Colors.textSecondary,
    },
    tabTextActive: {
        color: Colors.text,
        fontWeight: '700' as const,
    },
    content: {
        flex: 1,
    },
    section: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    sectionNoBorder: { // For the top analytics section
        padding: 16,
        paddingBottom: 0,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700' as const,
        color: Colors.text,
        marginBottom: 12,
    },
    
    // NEW HEADER STYLES
    headerRightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginRight: 8,
    },
    headerIcon: {
        padding: 4,
    },
    profileAvatarPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    stickyChannelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: Colors.background,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    channelAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 16,
        backgroundColor: Colors.surface,
        borderWidth: 2,
        borderColor: Colors.border,
    },
    channelHeaderInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    channelName: {
        fontSize: 24,
        fontWeight: '800' as const,
        color: Colors.text,
    },
    channelStats: {
        fontSize: 15,
        color: Colors.textSecondary,
        marginTop: 4,
    },

    // NEW OVERVIEW ANALYTICS STYLES
    overviewAnalyticsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
        marginBottom: 16,
    },
    analyticsStatCard: {
        width: (width - 48) / 2,
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        minHeight: 80,
    },
    analyticsStatValue: {
        fontSize: 22,
        fontWeight: '700' as const,
        color: Colors.text,
        marginBottom: 4,
    },
    analyticsStatTitle: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    timeFilterTextContainer: {
        fontSize: 13,
        fontWeight: '600' as const,
        color: Colors.textMuted,
        alignSelf: 'flex-end',
        paddingVertical: 8,
    },

    // STAT CARD STYLES
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, },
    statCard: { width: (width - 48) / 2, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, justifyContent: 'space-between', minHeight: 120, },
    statIcon: { marginBottom: 10, alignSelf: 'flex-start', },
    statTitle: { fontSize: 13, color: Colors.textSecondary, },
    statValue: { fontSize: 28, fontWeight: '800' as const, color: Colors.text, },
    statChange: { fontSize: 12, fontWeight: '600' as const, marginTop: 4, },
    statChangePositive: { color: Colors.success, },
    statChangeNegative: { color: Colors.error, },
    
    // CONTENT STYLES
    topPerformingSection: { gap: 12, },
    topPerformingLabel: { fontSize: 15, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 8, },
    topPerformingCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, },
    topPerformingImage: { width: 120, aspectRatio: 9 / 16, },
    topPerformingInfo: { flex: 1, padding: 12, justifyContent: 'space-between', },
    topPerformingTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, lineHeight: 20, },
    topPerformingStats: { flexDirection: 'row', gap: 16, },
    topPerformingStat: { flexDirection: 'row', alignItems: 'center', gap: 6, },
    topPerformingStatText: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary, },
    analyticsCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 24, alignItems: 'center', gap: 16, borderWidth: 1, borderColor: Colors.border, },
    analyticsText: { fontSize: 16, color: Colors.text, textAlign: 'center', lineHeight: 22, },
    contentCount: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, },
    contentCountText: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary, },
    contentItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, },
    contentThumbnailContainer: { position: 'relative', width: 100, aspectRatio: 16 / 9, },
    reelThumbnailContainer: { width: 70, aspectRatio: 9 / 16, },
    contentThumbnail: { width: '100%', height: '100%', borderRadius: 6, backgroundColor: Colors.surface, },
    viralScoreBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, },
    viralScoreText: { fontSize: 11, fontWeight: '700' as const, color: Colors.text, },
    contentInfo: { flex: 1, marginLeft: 0, },
    contentTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.text, lineHeight: 20, marginBottom: 6, },
    contentStats: { flexDirection: 'row', gap: 12, marginBottom: 4, },
    contentStat: { flexDirection: 'row', alignItems: 'center', gap: 4, },
    contentStatText: { fontSize: 12, color: Colors.textSecondary, },
    contentDate: { fontSize: 11, color: Colors.textMuted, },
    
    // EARNINGS STYLES
    earningsCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 32, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.border, },
    totalEarnings: { fontSize: 48, fontWeight: '700' as const, color: Colors.success, },
    earningsSubtext: { fontSize: 16, color: Colors.textSecondary, },
    revenueItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, },
    revenueInfo: { flex: 1, },
    revenueTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, marginBottom: 4, },
    revenueDescription: { fontSize: 13, color: Colors.textSecondary, },
    revenueAmount: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, },
    withdrawButton: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12, },
    withdrawButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, },
    submitButtonDisabled: { opacity: 0.4, },
    withdrawNote: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 18, },
    withdrawNoteDanger: { color: Colors.error, fontWeight: '600' as const, },
    
    // UTILITY STYLES
    centerContent: { justifyContent: 'center', alignItems: 'center', padding: 32, },
    loadingText: { fontSize: 16, color: Colors.textSecondary, marginTop: 16, },
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
    submitButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, },
    cancelButton: { paddingVertical: 12, alignItems: 'center', },
    cancelButtonText: { fontSize: 15, fontWeight: '600' as const, color: Colors.textSecondary, },
    earningsBreakdown: { marginTop: 16, gap: 12, },
    earningsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', },
    earningsLabel: { fontSize: 15, color: Colors.textSecondary, },
    earningsValue: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, },
    refreshButton: { padding: 8, },
    sectionHint: { fontSize: 13, color: Colors.textMuted, marginBottom: 12, fontStyle: 'italic' as const, },
});
