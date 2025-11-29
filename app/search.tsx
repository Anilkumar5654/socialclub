import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Search as SearchIcon, X, TrendingUp, Clock } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { api, MEDIA_BASE_URL } from '@/services/api';

const RECENT_SEARCHES_KEY = '@recent_searches';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'posts' | 'tags'>('users');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['search-users', debouncedQuery],
    queryFn: () => api.search.users(debouncedQuery, 1),
    enabled: debouncedQuery.length > 0 && activeTab === 'users',
  });

  const { data: postsData, isLoading: isLoadingPosts } = useQuery({
    queryKey: ['search-posts', debouncedQuery],
    queryFn: () => api.search.posts(debouncedQuery, 1),
    enabled: debouncedQuery.length > 0 && activeTab === 'posts',
  });

  const { data: hashtagsData, isLoading: isLoadingHashtags } = useQuery({
    queryKey: ['search-hashtags', debouncedQuery],
    queryFn: () => api.search.hashtags(debouncedQuery, 1),
    enabled: debouncedQuery.length > 0 && activeTab === 'tags',
  });

  const followMutation = useMutation({
    mutationFn: (userId: string) => api.users.follow(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-users'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to follow user');
    },
  });

  const users = (usersData as any)?.results?.users || usersData?.users || [];
  const posts = (postsData as any)?.results?.posts || postsData?.posts || [];
  const hashtags = (hashtagsData as any)?.results?.posts || hashtagsData?.posts || [];

  console.log('[Search] Raw users data:', usersData);
  console.log('[Search] Extracted users:', users);
  console.log('[Search] Users count:', users.length);
  console.log('[Search] Raw posts data:', postsData);
  console.log('[Search] Extracted posts:', posts);
  console.log('[Search] Raw hashtags data:', hashtagsData);
  console.log('[Search] Extracted hashtags:', hashtags);

  const isLoading = activeTab === 'users' ? isLoadingUsers : activeTab === 'posts' ? isLoadingPosts : isLoadingHashtags;

  const getImageUri = (uri: string) => {
    if (!uri) return '';
    return uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`;
  };

  const handleUserPress = (userId: string) => {
    router.push({ pathname: '/user/[userId]', params: { userId } });
  };

  const handlePostPress = (postId: string) => {
    router.push({ pathname: '/post/[postId]', params: { postId } });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <X color={Colors.text} size={24} />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <SearchIcon color={Colors.textMuted} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users, posts, tags..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X color={Colors.textMuted} size={18} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {searchQuery.length === 0 ? (
        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Clock color={Colors.textSecondary} size={20} />
              <Text style={styles.sectionTitle}>Recent</Text>
            </View>
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>
                Your recent searches will appear here
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <TrendingUp color={Colors.textSecondary} size={20} />
              <Text style={styles.sectionTitle}>Trending</Text>
            </View>
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>
                Trending topics will appear here
              </Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        <>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'users' && styles.tabActive]}
              onPress={() => setActiveTab('users')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'users' && styles.tabTextActive,
                ]}
              >
                Users
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
              onPress={() => setActiveTab('posts')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'posts' && styles.tabTextActive,
                ]}
              >
                Posts
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'tags' && styles.tabActive]}
              onPress={() => setActiveTab('tags')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'tags' && styles.tabTextActive,
                ]}
              >
                Tags
              </Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={Colors.primary} size="large" />
            </View>
          ) : (
            <>
              {activeTab === 'users' && (
                <FlatList
                  data={users}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={styles.userItem}
                      onPress={() => handleUserPress(item.id)}
                    >
                      <Image 
                        source={{ uri: getImageUri(item.avatar) }} 
                        style={styles.userAvatar} 
                      />
                      <View style={styles.userInfo}>
                        <View style={styles.userNameRow}>
                          <Text style={styles.userName}>{item.name}</Text>
                          {(item.isVerified || item.is_verified) && (
                            <Text style={styles.verifiedBadge}>✓</Text>
                          )}
                        </View>
                        <Text style={styles.userUsername}>@{item.username}</Text>
                        <Text style={styles.userFollowers}>
                          {(item.followersCount || item.followers_count || 0) > 1000
                            ? `${((item.followersCount || item.followers_count || 0) / 1000).toFixed(1)}K`
                            : (item.followersCount || item.followers_count || 0)}{' '}
                          followers
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.followButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          followMutation.mutate(item.id);
                        }}
                        disabled={followMutation.isPending}
                      >
                        <Text style={styles.followButtonText}>
                          {followMutation.isPending ? 'Loading...' : 'Follow'}
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.resultsList}
                  ListEmptyComponent={
                    <View style={styles.emptyResults}>
                      <Text style={styles.emptyResultsText}>No users found</Text>
                    </View>
                  }
                />
              )}

              {activeTab === 'posts' && (
                <FlatList
                  data={posts}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={styles.postItem}
                      onPress={() => handlePostPress(item.id)}
                    >
                      <Image 
                        source={{ 
                          uri: getImageUri(
                            item.images?.[0] || 
                            item.thumbnail_url || 
                            item.thumbnailUrl || 
                            item.user?.avatar || 
                            ''
                          ) 
                        }} 
                        style={styles.postThumbnail} 
                      />
                      <View style={styles.postInfo}>
                        <Text style={styles.postContent} numberOfLines={2}>
                          {item.content || 'View post'}
                        </Text>
                        <View style={styles.postMeta}>
                          <Image 
                            source={{ uri: getImageUri(item.user?.avatar || '') }} 
                            style={styles.postUserAvatar} 
                          />
                          <Text style={styles.postUsername}>
                            {item.user?.username || 'Unknown'}
                          </Text>
                        </View>
                        <View style={styles.postStats}>
                          <Text style={styles.postStat}>
                            {(item.likes || 0) > 999 
                              ? `${((item.likes || 0) / 1000).toFixed(1)}K` 
                              : (item.likes || 0)} likes
                          </Text>
                          <Text style={styles.postStat}> · </Text>
                          <Text style={styles.postStat}>
                            {item.comments || 0} comments
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.resultsList}
                  ListEmptyComponent={
                    <View style={styles.emptyResults}>
                      <Text style={styles.emptyResultsText}>No posts found</Text>
                    </View>
                  }
                />
              )}

              {activeTab === 'tags' && (
                <FlatList
                  data={hashtags}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.tagItem}
                      onPress={() => handlePostPress(item.id)}
                    >
                      <View style={styles.tagIcon}>
                        <Text style={styles.tagHash}>#</Text>
                      </View>
                      <View style={styles.tagInfo}>
                        <Text style={styles.tagText}>
                          {item.content?.substring(0, 50) || 'Tagged post'}
                        </Text>
                        <Text style={styles.tagCount}>
                          {item.user?.username || 'Unknown user'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.resultsList}
                  ListEmptyComponent={
                    <View style={styles.emptyResults}>
                      <Text style={styles.emptyResultsText}>No hashtags found</Text>
                    </View>
                  }
                />
              )}
            </>
          )}
        </>
      )}
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  emptySection: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  emptySectionText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  resultsList: {
    paddingVertical: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  verifiedBadge: {
    color: Colors.info,
    fontSize: 16,
  },
  userUsername: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  userFollowers: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: 20,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  postItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  postThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  postInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  postContent: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 18,
    marginBottom: 8,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  postUserAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  postUsername: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postStat: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  tagIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagHash: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  tagInfo: {
    flex: 1,
  },
  tagText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  tagCount: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  emptyResults: {
    padding: 48,
    alignItems: 'center',
  },
  emptyResultsText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
});
