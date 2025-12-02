Import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  Settings,
  Grid,
  Video,
  Info,
  UserCheck,
  UserPlus,
  ArrowLeft,
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
} from 'react-native';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { api, MEDIA_BASE_URL } from '@/services/api'; 
import { useAuth } from '@/contexts/AuthContext';

const { width } = Dimensions.get('window');
const POST_SIZE = (width - 3) / 3;

// --- DUMMY TYPES ---
interface ChannelData {
  id: string;
  name: string;
  avatar: string;
  handle?: string;
  bio?: string;
  is_verified?: boolean;
  subscribers_count: number;
  videos_count: number;
  reels_count: number;
  is_subscribed: boolean;
  user_id: string;
  about_text?: string;
}

export default function ChannelProfileScreen() {

  const { channelId } = useLocalSearchParams<{ channelId?: string }>();
  const resolvedChannelId = Array.isArray(channelId) ? channelId[0] : channelId ?? '';
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'videos' | 'reels' | 'about'>('videos');
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Note: profile will be defined after the channelQuery loads
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = (useQuery({ queryKey: ['channel-profile', resolvedChannelId] }) as any)?.data?.channel as ChannelData | undefined;

  const isOwnChannel = currentUser?.id === profile?.user_id;

  // --- QUERY: Channel Details ---
  const { data: channelData, isLoading, isError } = useQuery({
    queryKey: ['channel-profile', resolvedChannelId],
    queryFn: () => api.channels.getChannelDetails(resolvedChannelId), 
    enabled: resolvedChannelId.length > 0,
    select: (data) => data.channel,
  });

  // --- QUERY: Channel Content ---
  const { data: contentData, isLoading: isLoadingContent } = useQuery({
    queryKey: ['channel-content', resolvedChannelId, activeTab],
    queryFn: async () => {
      if (activeTab === 'videos') {
        return api.channels.getVideos(resolvedChannelId, 1);
      }
      if (activeTab === 'reels') {
        return api.channels.getReels(resolvedChannelId, 1);
      }
      return { videos: [], reels: [] };
    },
    enabled: resolvedChannelId.length > 0 && activeTab !== 'about',
  });

  // --- MUTATION: Subscribe/Unsubscribe ---
  const subscribeMutation = useMutation({
    mutationFn: () => isSubscribed 
        ? api.channels.unsubscribe(resolvedChannelId) 
        : api.channels.subscribe(resolvedChannelId),
    onSuccess: (data) => {
      setIsSubscribed(data.isSubscribed);
      queryClient.invalidateQueries({ queryKey: ['channel-profile', resolvedChannelId] }); 
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to change subscription status');
    },
  });

  const handleSubscribe = () => {
    if (!resolvedChannelId) {
      Alert.alert('Error', 'Invalid channel ID');
      return;
    }
    subscribeMutation.mutate();
  };


  const getImageUri = (uri: string) => {
    if (!uri) return '';
    return uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`;
  };
  
  const content = activeTab === 'reels' ? ((contentData as any)?.reels || []) : ((contentData as any)?.videos || []);
  
  // State Initialization
  React.useEffect(() => {
    if (profile?.is_subscribed !== undefined) {
      setIsSubscribed(profile.is_subscribed);
    }
  }, [profile?.is_subscribed]);


  // --- RENDERING ---

  if (isLoading) {
    // Loading State
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: true, title: 'Channel' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading channel...</Text>
        </View>
      </View>
    );
  }

  if (isError || !profile) {
    // Error State
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: true, title: 'Channel' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load channel profile</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => queryClient.invalidateQueries({ queryKey: ['channel-profile', resolvedChannelId] })}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: profile.name || 'Channel',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <ArrowLeft color={Colors.text} size={24} />
            </TouchableOpacity>
          ),
          headerRight: isOwnChannel
            ? () => (
                <TouchableOpacity
                  onPress={() => router.push('/settings/channel')}
                  style={styles.headerButton}
                >
                  <Settings color={Colors.text} size={24} />
                </TouchableOpacity>
              )
            : undefined,
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* --- CHANNEL HEADER --- */}
        <View style={styles.profileHeader}>
          <View style={styles.profileTop}>
            <Image
              source={{ uri: getImageUri(profile.avatar) }}
              style={styles.profileImage}
            />
            <View style={styles.profileStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {profile.videos_count || 0}
                </Text>
                <Text style={styles.statLabel}>Videos</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {(profile.subscribers_count || 0) > 999
                    ? `${((profile.subscribers_count || 0) / 1000).toFixed(1)}K`
                    : profile.subscribers_count || 0}
                </Text>
                <Text style={styles.statLabel}>Subscribers</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {profile.reels_count || 0}
                </Text>
                <Text style={styles.statLabel}>Reels</Text>
              </View>
            </View>
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>{profile.name}</Text>
              {profile.is_verified && (
                <Text style={styles.verifiedBadge}>✓</Text>
              )}
            </View>
            {profile.handle && <Text style={styles.profileHandle}>{profile.handle}</Text>}
            {profile.bio && <Text style={styles.profileBio}>{profile.bio}</Text>}
          </View>

          {/* --- SUBSCRIBE / MANAGE BUTTON --- */}
          {isOwnChannel ? (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push('/manage-channel')}
            >
              <Text style={styles.editButtonText}>Manage Channel</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.followButton, isSubscribed && styles.followingButton]}
              onPress={handleSubscribe}
              disabled={subscribeMutation.isPending}
            >
              {subscribeMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.text} />
              ) : (
                <>
                  {isSubscribed ? (
                    <UserCheck color={Colors.text} size={18} />
                  ) : (
                    <UserPlus color={Colors.text} size={18} />
                  )}
                  <Text style={styles.followButtonText}>
                    {isSubscribed ? 'Subscribed' : 'Subscribe'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
        
        {/* --- TABS: Videos, Reels, About --- */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'videos' && styles.tabActive]}
            onPress={() => setActiveTab('videos')}
          >
            <Grid
              color={activeTab === 'videos' ? Colors.text : Colors.textMuted}
              size={24}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'reels' && styles.tabActive]}
            onPress={() => setActiveTab('reels')}
          >
            <Video
              color={activeTab === 'reels' ? Colors.text : Colors.textMuted}
              size={24}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'about' && styles.tabActive]}
            onPress={() => setActiveTab('about')}
          >
            <Info
              color={activeTab === 'about' ? Colors.text : Colors.textMuted}
              size={24}
            />
          </TouchableOpacity>
        </View>

        {/* --- CONTENT AREA --- */}
        {activeTab === 'about' ? (
          // --- ABOUT SECTION ---
          <View style={styles.aboutContainer}>
            <Text style={styles.aboutTitle}>About this Channel</Text>
            <Text style={styles.aboutText}>
              {profile.about_text || 'No description provided for this channel.'}
            </Text>
            <Text style={styles.aboutStats}>
                Joined: {new Date().toLocaleDateString()} 
                {'\n'}
                Total Views: **TODO: Get total channel views from API**
            </Text>
          </View>
        ) : isLoadingContent ? (
          // --- LOADING CONTENT ---
          <View style={styles.postsLoadingContainer}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          // --- VIDEOS / REELS GRID ---
          <View style={styles.postsGrid}>
            {content.length === 0 ? (
              <View style={styles.emptyPosts}>
                <Text style={styles.emptyPostsText}>
                  {activeTab === 'reels' ? 'No reels uploaded yet' : 'No videos uploaded yet'}
                </Text>
              </View>
            ) : (
              content.map((item: any) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.postItem}
                  onPress={() => {
                    // Navigate to video or reels player screen
                    router.push({
                      pathname: activeTab === 'reels' ? '/reels/[reelId]' : '/video/[videoId]',
                      params: { [activeTab === 'reels' ? 'reelId' : 'videoId']: item.id },
                    });
                  }}
                >
                  <Image
                    source={{
                      uri: getImageUri(
                        item.thumbnailUrl ||
                          item.thumbnail_url ||
                          item.images?.[0] || 
                          ''
                      ),
                    }}
                    style={styles.postImage}
                    contentFit="cover"
                  />
                  {activeTab === 'reels' && (
                    <View style={styles.reelIndicator}>
                      <Text style={styles.reelIndicatorText}>▶</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerButton: { padding: 8 },
  content: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 16, fontSize: 15, color: Colors.textSecondary },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  retryButton: { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  
  profileHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  profileTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  profileImage: { width: 86, height: 86, borderRadius: 43, marginRight: 24 },
  profileStats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, marginBottom: 4 },
  statLabel: { fontSize: 13, color: Colors.textSecondary },
  
  profileInfo: { marginBottom: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  profileName: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  profileHandle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  verifiedBadge: { color: Colors.info, fontSize: 18 },
  profileBio: { fontSize: 14, color: Colors.text, lineHeight: 20 },

  editButton: { backgroundColor: Colors.surface, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  editButtonText: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },

  followButton: { flexDirection: 'row', backgroundColor: Colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 8 },
  followingButton: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  followButtonText: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  
  // Content Area
  postsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1 },
  postsLoadingContainer: { paddingVertical: 48, alignItems: 'center' },
  emptyPosts: { width: '100%', paddingVertical: 64, alignItems: 'center' },
  emptyPostsText: { fontSize: 15, color: Colors.textSecondary },
  postItem: { width: POST_SIZE, height: POST_SIZE },
  postImage: { width: '100%', height: '100%', backgroundColor: Colors.surface },
  reelIndicator: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
  reelIndicatorText: { color: Colors.text, fontSize: 10, marginLeft: 2 },

  // About Section Styles
  aboutContainer: { padding: 16, backgroundColor: Colors.background },
  aboutTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, marginBottom: 12 },
  aboutText: { fontSize: 14, color: Colors.text, lineHeight: 22, marginBottom: 20 },
  aboutStats: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
});
