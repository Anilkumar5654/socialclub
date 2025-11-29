import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  Settings,
  Grid,
  Video,
  Bookmark,
  UserPlus,
  UserMinus,
  MessageCircle,
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

export default function UserProfileScreen() {

  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const resolvedUserId = Array.isArray(userId) ? userId[0] : userId ?? '';
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);

  const isOwnProfile = currentUser?.id === resolvedUserId;

  const { data: profileData, isLoading, isError } = useQuery({
    queryKey: ['user-profile', resolvedUserId],
    queryFn: () => api.users.getProfile(resolvedUserId),
    enabled: resolvedUserId.length > 0,
  });

  const { data: postsData, isLoading: isLoadingPosts } = useQuery({
    queryKey: ['user-content', resolvedUserId, activeTab],
    queryFn: async () => {
      if (activeTab === 'posts') {
        return api.users.getPosts(resolvedUserId, 1);
      }
      if (activeTab === 'reels') {
        return api.users.getReels(resolvedUserId, 1);
      }
      return { posts: [], reels: [] };
    },
    enabled: resolvedUserId.length > 0,
  });

  const followMutation = useMutation({
    mutationFn: (userId: string) => api.users.follow(userId),
    onSuccess: (data) => {
      setIsFollowing(data.isFollowing);
      queryClient.invalidateQueries({ queryKey: ['user-profile', resolvedUserId] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to follow user');
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: (userId: string) => api.users.unfollow(userId),
    onSuccess: (data) => {
      setIsFollowing(data.isFollowing);
      queryClient.invalidateQueries({ queryKey: ['user-profile', resolvedUserId] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to unfollow user');
    },
  });

  const handleFollow = () => {
    if (!resolvedUserId) {
      Alert.alert('Error', 'Invalid user profile');
      return;
    }
    if (isFollowing) {
      unfollowMutation.mutate(resolvedUserId);
    } else {
      followMutation.mutate(resolvedUserId);
    }
  };

  const getImageUri = (uri: string) => {
    if (!uri) return '';
    return uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`;
  };

  const profile = profileData?.user;
  const posts = activeTab === 'reels' ? ((postsData as any)?.reels || []) : ((postsData as any)?.posts || []);

  React.useEffect(() => {
    if (profile?.is_following !== undefined) {
      setIsFollowing(profile.is_following);
    }
  }, [profile?.is_following]);

  console.log('[UserProfile] Active tab:', activeTab);
  console.log('[UserProfile] Posts data:', postsData);
  console.log('[UserProfile] Posts array:', posts);
  console.log('[UserProfile] Profile data:', profile);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Profile',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                <ArrowLeft color={Colors.text} size={24} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (isError || !profile) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Profile',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                <ArrowLeft color={Colors.text} size={24} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load profile</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() =>
              queryClient.invalidateQueries({ queryKey: ['user-profile', resolvedUserId] })
            }
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
          title: profile.username || 'Profile',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <ArrowLeft color={Colors.text} size={24} />
            </TouchableOpacity>
          ),
          headerRight: isOwnProfile
            ? () => (
                <TouchableOpacity
                  onPress={() => router.push('/settings')}
                  style={styles.headerButton}
                >
                  <Settings color={Colors.text} size={24} />
                </TouchableOpacity>
              )
            : undefined,
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.profileTop}>
            <Image
              source={{ uri: getImageUri(profile.avatar || '') }}
              style={styles.profileImage}
            />
            <View style={styles.profileStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {profile.postsCount || profile.posts_count || 0}
                </Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {(profile.followersCount || profile.followers_count || 0) > 999
                    ? `${((profile.followersCount || profile.followers_count || 0) / 1000).toFixed(1)}K`
                    : profile.followersCount || profile.followers_count || 0}
                </Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {profile.followingCount || profile.following_count || 0}
                </Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
            </View>
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>{profile.name || profile.username}</Text>
              {(profile.isVerified || profile.is_verified) && (
                <Text style={styles.verifiedBadge}>✓</Text>
              )}
            </View>
            {profile.bio && <Text style={styles.profileBio}>{profile.bio}</Text>}
          </View>

          {isOwnProfile ? (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push('/edit-profile')}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.followButton, isFollowing && styles.followingButton]}
                onPress={handleFollow}
                disabled={followMutation.isPending || unfollowMutation.isPending}
              >
                {followMutation.isPending || unfollowMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.text} />
                ) : (
                  <>
                    {isFollowing ? (
                      <UserMinus color={Colors.text} size={18} />
                    ) : (
                      <UserPlus color={Colors.text} size={18} />
                    )}
                    <Text style={styles.followButtonText}>
                      {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.messageButton}
                onPress={() =>
                  router.push({
                    pathname: '/chat/[userId]',
                    params: { userId: resolvedUserId },
                  })
                }
              >
                <MessageCircle color={Colors.text} size={18} />
                <Text style={styles.messageButtonText}>Message</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
            onPress={() => setActiveTab('posts')}
          >
            <Grid
              color={activeTab === 'posts' ? Colors.text : Colors.textMuted}
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
          {isOwnProfile && (
            <TouchableOpacity
              style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
              onPress={() => setActiveTab('saved')}
            >
              <Bookmark
                color={activeTab === 'saved' ? Colors.text : Colors.textMuted}
                size={24}
              />
            </TouchableOpacity>
          )}
        </View>

        {isLoadingPosts ? (
          <View style={styles.postsLoadingContainer}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <View style={styles.postsGrid}>
            {posts.length === 0 ? (
              <View style={styles.emptyPosts}>
                <Text style={styles.emptyPostsText}>
                  {activeTab === 'reels' ? 'No reels yet' : activeTab === 'saved' ? 'No saved posts yet' : 'No posts yet'}
                </Text>
              </View>
            ) : (
              posts.map((item: any, index: number) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.postItem}
                  onPress={() => {
                    if (activeTab === 'reels') {
                      router.push('/(tabs)/reels');
                    } else {
                      router.push({
                        pathname: '/post/[postId]',
                        params: { postId: item.id },
                      });
                    }
                  }}
                >
                  <Image
                    source={{
                      uri: getImageUri(
                        item.images?.[0] ||
                          item.thumbnailUrl ||
                          item.thumbnail_url ||
                          item.video_url ||
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  profileHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 86,
    height: 86,
    borderRadius: 43,
    marginRight: 24,
  },
  profileStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  profileInfo: {
    marginBottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  verifiedBadge: {
    color: Colors.info,
    fontSize: 16,
  },
  profileBio: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  editButton: {
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  followButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  followingButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
  },
  postItem: {
    width: POST_SIZE,
    height: POST_SIZE,
  },
  postImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surface,
  },
  reelIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelIndicatorText: {
    color: Colors.text,
    fontSize: 10,
    marginLeft: 2,
  },
  postsLoadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyPosts: {
    width: '100%',
    paddingVertical: 64,
    alignItems: 'center',
  },
  emptyPostsText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
});
