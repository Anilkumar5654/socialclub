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
  Bell,
  User,
  LayoutDashboard,
  Calendar,
  MonitorPlay,
  Edit,
  CheckCircle2, // New Icon
  Lock,         // New Icon
  Clock         // New Icon
} from 'lucide-react-native';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { api, MEDIA_BASE_URL } from '@/services/api';
import { formatTimeAgo } from '@/constants/timeFormat';

const { width } = Dimensions.get('window');

// ----------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------

const getImageUrl = (path: string | null | undefined) => {
    if (!path) return 'https://via.placeholder.com/60';
    return path.startsWith('http') ? path : `${MEDIA_BASE_URL}/${path}`;
};

// ----------------------------------------------------------------
// HELPER COMPONENTS
// ----------------------------------------------------------------

function StatCard({ icon, title, value, change }: { icon: React.ReactNode; title: string; value: string; change?: string }) {
    const isPositive = change?.startsWith('+');
    return (
      <View style={styles.statCard}>
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

function ContentItem({ type, item, onPress, hideStats }: { type: 'post' | 'reel' | 'video'; item: any; onPress?: () => void; hideStats?: boolean }) {
    const thumbnailUri = getImageUrl(item.thumbnail_url || item.thumbnailUrl || item.images?.[0]);
    const title = type === 'video' ? (item.title || item.caption || item.content) : (item.content || item.caption || 'Untitled');
    const views = item.views || 0;
    const likes = item.likes || 0;
    const timestamp = item.timestamp || item.created_at || item.uploadDate || item.upload_date;
    const viralScore = item.viral_score;

    const hasThumbnail = !!thumbnailUri && thumbnailUri !== 'https://via.placeholder.com/60';
  
    return (
      <TouchableOpacity style={styles.contentItem} onPress={onPress}>
        <View style={[styles.contentThumbnailContainer, type === 'reel' && styles.reelThumbnailContainer]}>
          
          {hasThumbnail ? (
            <Image
              source={{ uri: thumbnailUri }}
              style={[styles.contentThumbnail, type === 'reel' && styles.reelThumbnail]}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.contentThumbnail, styles.placeholderBackground, type === 'reel' && styles.reelThumbnail]}>
                <MonitorPlay color={Colors.textMuted} size={type === 'reel' ? 30 : 40} />
            </View>
          )}

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
          {!hideStats && (
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
          )}

          <Text style={styles.contentDate}>{formatTimeAgo(timestamp)}</Text>
        </View>
        <ChevronRight color={Colors.textSecondary} size={20} />
      </TouchableOpacity>
    );
}

// ✅ NEW: Monetization Progress Bar Component
function MonetizationProgress({ 
    icon, 
    title, 
    current, 
    target, 
    suffix = '' 
}: { icon: any, title: string, current: number, target: number, suffix?: string }) {
    const progress = Math.min((current / target) * 100, 100);
    const isCompleted = current >= target;

    return (
        <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
                <View style={styles.progressTitleRow}>
                    {icon}
                    <Text style={styles.progressTitle}>{title}</Text>
                </View>
                {isCompleted && <CheckCircle2 size={18} color={Colors.success} />}
            </View>
            
            <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${progress}%`, backgroundColor: isCompleted ? Colors.success : Colors.primary }]} />
            </View>
            
            <View style={styles.progressStats}>
                <Text style={styles.progressCurrent}>
                    {current.toLocaleString()} <Text style={styles.progressTarget}>/ {target.toLocaleString()} {suffix}</Text>
                </Text>
            </View>
        </View>
    );
}

// ✅ UPDATED INTERFACE (Added monetization fields)
interface Channel {
    id: string; name: string; description: string; avatar: string; cover_photo: string; subscribers_count: number; videos_count: number; created_at: string;
    is_monetization_enabled?: boolean | number;
    monetization_watch_hours?: number; 
}
interface CreatorStats {
    total_followers: number; total_views: number; total_likes: number; engagement_rate: number; monthly_growth?: { followers: number; views: number; engagement: number; };
}
interface Earnings {
    total_earnings: number; pending_earnings: number; paid_earnings: number; ad_revenue: number; reels_bonus: number; period: string;
}

// ----------------------------------------------------------------
// CUSTOM FIXED HEADER COMPONENT
// ----------------------------------------------------------------

function CustomFixedHeader({ user, router, avatarUrl, onUploadPress }: { user: any, router: any, avatarUrl?: string, onUploadPress: () => void }) {
    const insets = useSafeAreaInsets(); 
    return (
        <View style={[styles.customHeaderWrapper, { paddingTop: insets.top }]}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
            <View style={styles.customHeaderContainer}>
                <View style={styles.customHeaderLeft}>
                    <Text style={styles.customHeaderTitle}>Studio</Text>
                </View>
                <View style={styles.headerRightContainer}>
                    <TouchableOpacity onPress={onUploadPress} style={styles.headerIcon}>
                        <Plus color={Colors.text} size={24} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Alert.alert('Notifications', 'Show notifications')} style={styles.headerIcon}>
                        <Bell color={Colors.text} size={24} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Alert.alert('Profile', 'Open profile settings')}>
                        {avatarUrl ? (
                             <Image 
                                source={{ uri: avatarUrl }}
                                style={styles.headerAvatar}
                                contentFit="cover"
                             />
                        ) : (
                            <View style={styles.profileAvatarPlaceholder}>
                                <User color={Colors.textMuted} size={20} />
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

// ----------------------------------------------------------------
// MAIN SCREEN COMPONENT
// ----------------------------------------------------------------

export default function CreatorStudioScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'earnings'>('overview');
  
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  // --- MONETIZATION CONSTANTS ---
  const TARGET_SUBS = 1000;
  const TARGET_WATCH_HOURS = 4000;
  
  // Logic to determine monetization status
  const isMonetized = !!(channel?.is_monetization_enabled);
  const currentSubs = channel?.subscribers_count || 0;
  const currentWatchHours = channel?.monetization_watch_hours || 0; 

  const handleEditChannel = () => {
    router.push('/channel/edit'); 
  };

  const handleUploadVideo = () => {
    if (!channel) {
        Alert.alert("Create Channel", "You need to create a channel before uploading videos.");
        return;
    }
    router.push('/video-upload'); 
  };
  
  useEffect(() => {
    loadCreatorData();
  }, []);
  
  const loadCreatorData = async () => { 
      if (!refreshing) setIsLoading(true); 
      try { 
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
          setRefreshing(false);
      } 
  };

  const loadStatsAndContent = async () => { 
      try { 
          const [statsRes, earningsRes, postsRes, reelsRes, videosRes] = await Promise.all([ 
              api.creator.getStats().catch(() => ({ stats: null })), 
              api.creator.getEarnings('month').catch(() => ({ earnings: null })), 
              api.creator.getContent('posts', 1).catch(() => ({ content: [] })), 
              api.creator.getContent('reels', 1).catch(() => ({ content: [] })), 
              api.creator.getContent('videos', 1).catch(() => ({ content: [] })), 
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCreatorData();
  }, []);

  const handleCreateChannel = async () => { 
      if (!channelName.trim()) { Alert.alert('Error', 'Please enter a channel name'); return; } 
      setIsCreatingChannel(true); 
      try { 
          const response = await api.channels.create({ name: channelName, description: channelDescription, }); 
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
      if (type === 'post') { router.push(`/post/${id}`); } 
      else if (type === 'reel') { router.push({ pathname: '/reels-player', params: { reelId: id } }); } 
      else if (type === 'video') { router.push({ pathname: '/video-analytics', params: { videoId: id } }); } 
  };

  const handleApplyMonetization = () => {
      Alert.alert("Application Sent", "Your channel is under review.");
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Stack.Screen options={{ headerShown: false }}/>
        <CustomFixedHeader user={user} router={router} onUploadPress={handleUploadVideo} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading creator data...</Text>
      </View>
    );
  }

  if (!channel && !showCreateChannel) {
    return (
        <View style={[styles.container, styles.centerContent]}>
          <Stack.Screen options={{ headerShown: false }}/>
          <CustomFixedHeader user={user} router={router} onUploadPress={handleUploadVideo} />
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Film color={Colors.textSecondary} size={80} />
            <Text style={styles.noChannelTitle}>No Channel Found</Text>
            <Text style={styles.noChannelSubtitle}>
                You need to create a channel to access Creator Studio features and upload long videos.
            </Text>
            <TouchableOpacity style={styles.createChannelButton} onPress={() => setShowCreateChannel(true)}>
                <Plus color={Colors.text} size={20} />
                <Text style={styles.createChannelButtonText}>Create Channel</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
  }

  if (showCreateChannel) {
    return (
        <View style={styles.container}>
          <Stack.Screen options={{ headerShown: false }}/>
          <View style={[styles.customHeaderWrapper, { paddingTop: insets.top }]}>
             <View style={styles.customHeaderContainer}>
                <Text style={styles.customHeaderTitle}>Create Channel</Text>
             </View>
          </View>
          <ScrollView style={styles.content} contentContainerStyle={styles.createChannelContent}>
            <Text style={styles.createChannelTitle}>Create Your Channel</Text>
            <Text style={styles.createChannelDescription}>
              Start your creator journey! Create a channel to upload long-form videos and access monetization features.
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Channel Name *</Text>
              <TextInput style={styles.input} placeholder="Enter channel name" placeholderTextColor={Colors.textMuted} value={channelName} onChangeText={setChannelName}/>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Tell viewers about your channel" placeholderTextColor={Colors.textMuted} value={channelDescription} onChangeText={setChannelDescription} multiline numberOfLines={4}/>
            </View>
            <TouchableOpacity style={[styles.submitButton, isCreatingChannel && styles.submitButtonDisabled]} onPress={handleCreateChannel} disabled={isCreatingChannel}>
              {isCreatingChannel ? (<ActivityIndicator color={Colors.text} />) : (<Text style={styles.submitButtonText}>Create Channel</Text>)}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowCreateChannel(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
  }

  return (
    <View style={styles.container}> 
      <Stack.Screen options={{ headerShown: false }} /> 
      
      <CustomFixedHeader 
        user={user} 
        router={router} 
        avatarUrl={channel?.avatar ? getImageUrl(channel.avatar) : undefined} 
        onUploadPress={handleUploadVideo} 
      /> 

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
          
        {activeTab === 'overview' && channel && (
          <View style={styles.channelDetailsSection}>
            <Image
              source={{ uri: getImageUrl(channel.avatar) }} 
              style={styles.channelAvatar}
              contentFit="cover"
              cachePolicy="disk"
            />
            <View style={styles.channelHeaderInfo}>
              <Text style={styles.channelName}>{channel.name}</Text>
              <Text style={styles.channelStats}>
                {channel.subscribers_count.toLocaleString()} total subscribers
              </Text>
            </View>

            <TouchableOpacity 
                style={styles.editChannelButton} 
                onPress={handleEditChannel} 
            >
                <Edit color={Colors.text} size={18} />
                <Text style={styles.editChannelButtonText}>Edit</Text>
            </TouchableOpacity>
            
          </View>
        )}

        {/* --- TABS CONTENT --- */}
        {activeTab === 'overview' && (
          <>
            {stats && (
                <View style={[styles.section, styles.noBorderBottom]}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Performance</Text>
                        <View style={styles.timeFilterContainer}>
                            <Calendar color={Colors.textSecondary} size={16} />
                            <Text style={styles.timeFilterText}>Last 28 days</Text>
                        </View>
                    </View>

                    <View style={styles.overviewAnalyticsGrid}>
                        <View style={styles.analyticsStatCard}>
                            <Text style={styles.analyticsStatValue}>
                                {stats.total_views > 999 ? `${(stats.total_views / 1000).toFixed(1)}K` : stats.total_views}
                            </Text>
                            <Text style={styles.analyticsStatTitle}>Views</Text>
                        </View>
                        <View style={styles.analyticsStatCard}>
                            <Text style={styles.analyticsStatValue}>{currentWatchHours.toFixed(1)}</Text> 
                            <Text style={styles.analyticsStatTitle}>Watch time (hours)</Text>
                        </View>
                    </View>
                    
                    <View style={styles.statsGrid}> 
                        <StatCard icon={<Users color={Colors.primary} size={24} />} title="Followers" value={stats.total_followers.toLocaleString()} change={stats.monthly_growth?.followers ? `+${stats.monthly_growth.followers}%` : undefined}/>
                        <StatCard icon={<TrendingUp color={Colors.info} size={24} />} title="Engagement" value={`${stats.engagement_rate.toFixed(1)}%`} change={stats.monthly_growth?.engagement ? `+${stats.monthly_growth.engagement}%` : undefined}/>
                    </View>
                </View>
            )}

            {videos.length > 0 && (
              <View style={[styles.section, { borderTopWidth: 1, borderTopColor: Colors.border }]}>
                <Text style={styles.sectionTitle}>Latest videos</Text>
                {videos.slice(0, 3).map((video) => (
                  <ContentItem
                    key={video.id}
                    type="video"
                    item={video}
                    onPress={() => handleContentPress('video', video.id)}
                    hideStats={true} 
                  />
                ))}
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

        {/* ... Content Tab UI ... */}
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
              {posts.length > 0 ? ( posts.map((post) => (<ContentItem key={post.id} type="post" item={post} onPress={() => handleContentPress('post', post.id)}/>))
              ) : ( <View style={styles.emptyState}> <ImageIcon color={Colors.textSecondary} size={40} /> <Text style={styles.emptyText}>No posts yet</Text> </View> )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Reels</Text>
                <View style={styles.contentCount}>
                  <Film color={Colors.textSecondary} size={16} />
                  <Text style={styles.contentCountText}>{reels.length}</Text>
                </View>
              </View>
              {reels.length > 0 ? ( reels.map((reel) => (<ContentItem key={reel.id} type="reel" item={reel} onPress={() => handleContentPress('reel', reel.id)}/>))
              ) : ( <View style={styles.emptyState}> <Film color={Colors.textSecondary} size={40} /> <Text style={styles.emptyText}>No reels yet</Text> </View> )}
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
              {videos.length > 0 ? ( videos.map((video) => (<ContentItem key={video.id} type="video" item={video} onPress={() => handleContentPress('video', video.id)}/>))
              ) : ( <View style={styles.emptyState}> <Video color={Colors.textSecondary} size={40} /> <Text style={styles.emptyText}>No videos yet. Create a channel to upload videos!</Text> </View> )}
            </View>
          </>
        )}

        {/* ✅ LOGIC APPLIED HERE: EARNINGS TAB */}
        {activeTab === 'earnings' && (
          <>
            {isMonetized ? (
              /* --- STATE 1: MONETIZED DASHBOARD (Existing Logic) --- */
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Total Earnings</Text>
                  <View style={styles.earningsCard}>
                    <DollarSign color={Colors.success} size={32} />
                    <Text style={styles.totalEarnings}>
                      ${earnings?.total_earnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </Text>
                    <Text style={styles.earningsSubtext}>This {earnings?.period || 'month'}</Text>
                  </View>
                  <View style={styles.earningsBreakdown}>
                    <View style={styles.earningsRow}>
                      <Text style={styles.earningsLabel}>Available:</Text>
                      <Text style={styles.earningsValue}>${availableEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                    </View>
                    <View style={styles.earningsRow}>
                      <Text style={styles.earningsLabel}>Pending:</Text>
                      <Text style={[styles.earningsValue, { color: Colors.warning }]}>${earnings?.pending_earnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</Text>
                    </View>
                    <View style={styles.earningsRow}>
                      <Text style={styles.earningsLabel}>Paid Out:</Text>
                      <Text style={[styles.earningsValue, { color: Colors.success }]}>${earnings?.paid_earnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Revenue Breakdown</Text>
                  <View style={styles.revenueItem}>
                    <View style={styles.revenueInfo}><Text style={styles.revenueTitle}>Ad Revenue</Text><Text style={styles.revenueDescription}>From video ads</Text></View>
                    <Text style={styles.revenueAmount}>${earnings?.ad_revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</Text>
                  </View>
                  <View style={styles.revenueItem}>
                    <View style={styles.revenueInfo}><Text style={styles.revenueTitle}>Reels Bonus</Text><Text style={styles.revenueDescription}>Performance bonus</Text></View>
                    <Text style={styles.revenueAmount}>${earnings?.reels_bonus.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <TouchableOpacity style={[styles.withdrawButton, !canWithdraw && styles.submitButtonDisabled]} onPress={() => Alert.alert('Request', 'Request sent')} disabled={!canWithdraw}>
                    <Text style={styles.withdrawButtonText}>Request Withdrawal</Text>
                  </TouchableOpacity>
                  <Text style={styles.withdrawNote}>Min withdrawal $100.</Text>
                </View>
              </>
            ) : (
              /* --- STATE 2: NOT MONETIZED (YOUTUBE STYLE CRITERIA) --- */
              <View style={[styles.section, {paddingBottom: 40}]}>
                  <View style={styles.monetizationHeader}>
                      <DollarSign color={Colors.primary} size={48} style={styles.monetizationIcon} />
                      <Text style={styles.monetizationTitle}>Become a Partner</Text>
                      <Text style={styles.monetizationSubtitle}>
                          Join the Partner Program to earn money, get creator support, and more.
                      </Text>
                  </View>

                  <View style={styles.criteriaContainer}>
                      <Text style={styles.criteriaTitle}>Eligibility Requirements</Text>
                      
                      {/* Subscriber Progress */}
                      <MonetizationProgress 
                          icon={<Users color={Colors.text} size={20} />} 
                          title="Reach 1,000 Subscribers" 
                          current={currentSubs} 
                          target={TARGET_SUBS} 
                      />

                      {/* Watch Hours Progress */}
                      <MonetizationProgress 
                          icon={<Clock color={Colors.text} size={20} />} 
                          title="4,000 Watch hours (Last 365 days)" 
                          current={currentWatchHours} 
                          target={TARGET_WATCH_HOURS} 
                          suffix="hours"
                      />
                  </View>

                  <View style={styles.monetizationFooter}>
                      <View style={styles.lockContainer}>
                          <Lock color={Colors.textSecondary} size={16} />
                          <Text style={styles.lockText}>
                              {currentSubs >= TARGET_SUBS && currentWatchHours >= TARGET_WATCH_HOURS 
                                ? "You are eligible to apply!" 
                                : "Keep growing to unlock monetization"}
                          </Text>
                      </View>
                      
                      <TouchableOpacity 
                          style={[styles.applyButton, (currentSubs < TARGET_SUBS || currentWatchHours < TARGET_WATCH_HOURS) && styles.submitButtonDisabled]} 
                          disabled={currentSubs < TARGET_SUBS || currentWatchHours < TARGET_WATCH_HOURS}
                          onPress={handleApplyMonetization}
                      >
                          <Text style={styles.applyButtonText}>Apply Now</Text>
                      </TouchableOpacity>
                  </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* BOTTOM TAB BAR */}
      <View style={[styles.bottomTabBar, { paddingBottom: insets.bottom }]}>
        <TouchableOpacity style={styles.bottomTab} onPress={() => setActiveTab('overview')}>
          <LayoutDashboard color={activeTab === 'overview' ? Colors.primary : Colors.textSecondary} size={24} />
          <Text style={[styles.bottomTabText, activeTab === 'overview' && styles.bottomTabTextActive]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomTab} onPress={() => setActiveTab('content')}>
          <Film color={activeTab === 'content' ? Colors.primary : Colors.textSecondary} size={24} />
          <Text style={[styles.bottomTabText, activeTab === 'content' && styles.bottomTabTextActive]}>Content</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomTab} onPress={() => router.push('/analytics')}>
          <BarChart3 color={Colors.textSecondary} size={24} />
          <Text style={styles.bottomTabText}>Analytics</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomTab} onPress={() => router.push('/comments')}>
          <User color={Colors.textSecondary} size={24} />
          <Text style={styles.bottomTabText}>Community</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomTab} onPress={() => setActiveTab('earnings')}>
          <DollarSign color={activeTab === 'earnings' ? Colors.primary : Colors.textSecondary} size={24} />
          <Text style={[styles.bottomTabText, activeTab === 'earnings' && styles.bottomTabTextActive]}>Earn</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ----------------------------------------------------------------
// STYLES
// ----------------------------------------------------------------

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    customHeaderWrapper: { backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
    customHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 52 },
    customHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
    customHeaderTitle: { fontSize: 22, fontWeight: '700' as const, color: Colors.text, letterSpacing: -0.5 },
    bottomTabBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', height: 60, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
    bottomTab: { flex: 1, alignItems: 'center', paddingVertical: 4, gap: 2 },
    bottomTabText: { fontSize: 10, color: Colors.textSecondary },
    bottomTabTextActive: { color: Colors.primary, fontWeight: '600' as const },
    headerRightContainer: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    headerIcon: { padding: 4 },
    profileAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
    headerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
    channelDetailsSection: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border, justifyContent: 'space-between' },
    channelAvatar: { width: 60, height: 60, borderRadius: 30, marginRight: 16, backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.border },
    channelHeaderInfo: { flex: 1, justifyContent: 'center', marginRight: 10 },
    channelName: { fontSize: 24, fontWeight: '800' as const, color: Colors.text },
    channelStats: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },
    editChannelButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignSelf: 'flex-start' },
    editChannelButtonText: { color: Colors.text, fontWeight: '600', fontSize: 14 },
    content: { flex: 1 },
    section: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
    noBorderBottom: { borderBottomWidth: 0 },
    sectionTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, marginBottom: 12 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    timeFilterContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
    timeFilterText: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary },
    overviewAnalyticsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 16 },
    analyticsStatCard: { width: (width - 48) / 2, backgroundColor: Colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border, minHeight: 80 },
    analyticsStatValue: { fontSize: 22, fontWeight: '700' as const, color: Colors.text, marginBottom: 4 },
    analyticsStatTitle: { fontSize: 14, color: Colors.textSecondary },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
    statCard: { width: (width - 48) / 2, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, justifyContent: 'space-between', minHeight: 120 },
    statIcon: { marginBottom: 10, alignSelf: 'flex-start' },
    statTitle: { fontSize: 13, color: Colors.textSecondary },
    statValue: { fontSize: 28, fontWeight: '800' as const, color: Colors.text },
    statChange: { fontSize: 12, fontWeight: '600' as const, marginTop: 4 },
    statChangePositive: { color: Colors.success },
    statChangeNegative: { color: Colors.error },
    contentItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
    contentThumbnailContainer: { position: 'relative', width: 100, aspectRatio: 16 / 9 },
    contentThumbnail: { width: '100%', height: '100%', borderRadius: 6, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
    placeholderBackground: { backgroundColor: Colors.surface },
    contentInfo: { flex: 1, marginLeft: 0 },
    contentTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.text, lineHeight: 20, marginBottom: 6 },
    contentDate: { fontSize: 13, color: Colors.textSecondary }, 
    contentStats: { flexDirection: 'row', gap: 12, marginBottom: 4 },
    analyticsCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 24, alignItems: 'center', gap: 16, borderWidth: 1, borderColor: Colors.border },
    analyticsText: { fontSize: 16, color: Colors.text, textAlign: 'center', lineHeight: 22 },
    contentCount: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
    contentCountText: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 },
    emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center },
    
    // --- EARNINGS & MONETIZATION STYLES ---
    earningsCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 32, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.border },
    totalEarnings: { fontSize: 48, fontWeight: '700' as const, color: Colors.success },
    earningsSubtext: { fontSize: 16, color: Colors.textSecondary },
    revenueItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
    revenueTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, marginBottom: 4 },
    revenueDescription: { fontSize: 13, color: Colors.textSecondary },
    revenueAmount: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
    withdrawButton: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
    withdrawButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text },
    submitButtonDisabled: { opacity: 0.4 },
    withdrawNote: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
    withdrawNoteDanger: { color: Colors.error, fontWeight: '600' as const },
    earningsBreakdown: { marginTop: 16, gap: 12 },
    earningsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center },
    earningsLabel: { fontSize: 15, color: Colors.textSecondary },
    earningsValue: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
    
    // Monetization Criteria Styles
    monetizationHeader: { alignItems: 'center', marginBottom: 30, paddingHorizontal: 20 },
    monetizationIcon: { marginBottom: 16 },
    monetizationTitle: { fontSize: 24, fontWeight: '800' as const, color: Colors.text, marginBottom: 8, textAlign: 'center' },
    monetizationSubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    criteriaContainer: { marginBottom: 30, gap: 24 },
    criteriaTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, marginBottom: 16 },
    progressContainer: { gap: 10 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progressTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    progressTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
    progressTrack: { height: 8, backgroundColor: Colors.surface, borderRadius: 4, overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 4 },
    progressStats: { alignItems: 'flex-start' },
    progressCurrent: { fontSize: 14, fontWeight: '700' as const, color: Colors.text },
    progressTarget: { color: Colors.textSecondary, fontWeight: '400' as const },
    monetizationFooter: { gap: 16 },
    lockContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    lockText: { fontSize: 13, color: Colors.textSecondary },
    applyButton: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    applyButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text },

    reelThumbnailContainer: { width: 70, aspectRatio: 9 / 16 },
    viralScoreBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    viralScoreText: { fontSize: 11, fontWeight: '700' as const, color: Colors.text, },
    
    centerContent: { justifyContent: 'center', alignItems: 'center', padding: 32 },
    loadingText: { fontSize: 16, color: Colors.textSecondary, marginTop: 16 },
    noChannelTitle: { fontSize: 24, fontWeight: '700' as const, color: Colors.text, marginTop: 24, marginBottom: 8, textAlign: 'center' },
    noChannelSubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32, paddingHorizontal: 16, },
    createChannelButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, },
    createChannelButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text },
    createChannelContent: { padding: 16 },
    createChannelTitle: { fontSize: 28, fontWeight: '700' as const, color: Colors.text, marginBottom: 12 },
    createChannelDescription: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 32 },
    inputGroup: { marginBottom: 24 },
    inputLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.text, marginBottom: 8 },
    input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Colors.text },
    textArea: { minHeight: 100, paddingTop: 14, textAlignVertical: 'top' },
    submitButton: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
    submitButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text },
    cancelButton: { paddingVertical: 12, alignItems: 'center' },
    cancelButtonText: { fontSize: 15, fontWeight: '600' as const, color: Colors.textSecondary },
    sectionHint: { fontSize: 13, color: Colors.textMuted, marginBottom: 12, fontStyle: 'italic' as const },
});
