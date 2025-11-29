import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Plus, TrendingUp, Flame, Clock, BarChart2 } from 'lucide-react-native';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { formatTimeAgo } from '@/constants/timeFormat';
import { useAuth } from '@/contexts/AuthContext';
import { api, MEDIA_BASE_URL } from '@/services/api';
import { Video as VideoType } from '@/types';
import { VideoCardSkeleton } from '@/components/SkeletonLoader';

const VIDEO_CATEGORIES = [
  { id: 'all', label: 'All', icon: BarChart2 },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'hot', label: 'Hot', icon: Flame },
  { id: 'recent', label: 'Recent', icon: Clock },
];

function VideoCard({ video, index }: { video: VideoType; index: number }) {
  const handlePress = useCallback(() => {
    console.log('[Videos] Opening video player for:', video.id);
    router.push({
      pathname: '/video-player',
      params: { videoId: video.id },
    });
  }, [video.id]);

  const getMediaUri = useCallback((uri: string | undefined) => {
    if (!uri) return '';
    return uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`;
  }, []);

  const formatViews = useCallback((views: number) => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    }
    if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  }, []);

  const handleChannelPress = useCallback(() => {
    const targetUserId = video.channel?.user_id || video.user?.id;
    if (targetUserId) {
      console.log('[Videos] Navigating to user profile:', targetUserId);
      router.push({
        pathname: '/user/[userId]',
        params: { userId: targetUserId },
      });
    }
  }, [video.channel?.user_id, video.user?.id]);

  const channelName = video.channel?.name || video.user?.channel_name || video.user?.name || 'Unknown Channel';
  const isVerified = video.channel?.is_verified || video.user?.isVerified || video.user?.is_verified;
  const isHot = (video.viral_score || 0) > 75;
  const isTrending = index < 3;
  const thumbnailUrl = getMediaUri(video.thumbnail_url || video.thumbnailUrl);

  return (
    <TouchableOpacity 
      style={styles.videoCard} 
      onPress={handlePress}
      activeOpacity={0.8}
      testID={`video-card-${video.id}`}
    >
      <View style={styles.thumbnailContainer}>
        <Image 
          source={{ uri: thumbnailUrl }} 
          style={styles.thumbnail} 
          contentFit="cover"
          placeholder={require('@/assets/images/icon.png')}
        />
        {video.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{video.duration}</Text>
          </View>
        )}
        {isHot && (
          <View style={styles.hotBadge}>
            <Flame color={Colors.text} size={12} fill={Colors.error} />
            <Text style={styles.hotBadgeText}>HOT</Text>
          </View>
        )}
        {isTrending && !isHot && (
          <View style={styles.trendingBadge}>
            <Text style={styles.trendingBadgeText}>#{index + 1}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>
          {video.title || 'Untitled Video'}
        </Text>
        <TouchableOpacity 
          onPress={handleChannelPress}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 0, right: 16 }}
        >
          <View style={styles.channelRow}>
            <Text style={styles.channelName} numberOfLines={1}>
              {channelName}
            </Text>
            {isVerified && (
              <Text style={styles.verifiedBadge}> ✓</Text>
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.videoStats}>
          {formatViews(video.views || 0)} views · {formatTimeAgo(video.created_at || video.timestamp || video.uploadDate)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function VideosScreen() {
  const { isAuthenticated } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState('all');
  const insets = useSafeAreaInsets();

  const { 
    data: videosData, 
    isLoading, 
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['videos', selectedFilter],
    queryFn: async () => {
      console.log('[Videos] Fetching videos with filter:', selectedFilter);
      const response = await api.videos.getVideos(1, 20);
      console.log('[Videos] Received', response.videos?.length || 0, 'videos');
      return response;
    },
  });

  const videos = videosData?.videos || [];
  
  const sortedVideos = React.useMemo(() => {
    const videosCopy = [...videos];
    
    switch (selectedFilter) {
      case 'trending':
        return videosCopy.sort((a, b) => {
          const scoreA = (a.viral_score || 0) + ((a.views || 0) / 100);
          const scoreB = (b.viral_score || 0) + ((b.views || 0) / 100);
          return scoreB - scoreA;
        });
      case 'hot':
        return videosCopy
          .filter(v => (v.viral_score || 0) > 50)
          .sort((a, b) => (b.viral_score || 0) - (a.viral_score || 0));
      case 'recent':
        return videosCopy.sort((a, b) => {
          const dateA = new Date(a.created_at || a.timestamp || 0).getTime();
          const dateB = new Date(b.created_at || b.timestamp || 0).getTime();
          return dateB - dateA;
        });
      default:
        return videosCopy;
    }
  }, [videos, selectedFilter]);

  const handleRefresh = useCallback(() => {
    console.log('[Videos] Refreshing videos');
    refetch();
  }, [refetch]);

  const renderVideoCard = useCallback(({ item, index }: { item: VideoType; index: number }) => (
    <VideoCard video={item} index={index} />
  ), []);

  const keyExtractor = useCallback((item: VideoType) => item.id, []);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Videos</Text>
        {isAuthenticated && (
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => router.push('/video-upload')}
            testID="upload-video-button"
          >
            <Plus color={Colors.text} size={20} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {VIDEO_CATEGORIES.map((filter) => {
            const IconComponent = filter.icon;
            const isActive = selectedFilter === filter.id;
            return (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                ]}
                onPress={() => setSelectedFilter(filter.id)}
                testID={`filter-${filter.id}`}
              >
                <IconComponent
                  color={isActive ? Colors.text : Colors.textSecondary}
                  size={16}
                />
                <Text
                  style={[
                    styles.filterText,
                    isActive && styles.filterTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <FlatList
          data={[1, 2, 3, 4, 5]}
          keyExtractor={(item) => `skeleton-${item}`}
          renderItem={() => <VideoCardSkeleton />}
          contentContainerStyle={styles.videosList}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={sortedVideos}
          keyExtractor={keyExtractor}
          renderItem={renderVideoCard}
          contentContainerStyle={styles.videosList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No videos available</Text>
              <Text style={styles.emptySubtext}>Check back later for new content</Text>
            </View>
          }
          testID="videos-list"
        />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  uploadButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterRow: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.text,
  },
  videosList: {
    padding: 16,
    paddingBottom: 100,
  },
  videoCard: {
    marginBottom: 20,
  },
  thumbnailContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: Colors.surface,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  durationText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  hotBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hotBadgeText: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: '700' as const,
  },
  trendingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  trendingBadgeText: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  videoInfo: {
    gap: 4,
  },
  videoTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 20,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelName: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  verifiedBadge: {
    color: Colors.info,
    fontSize: 12,
  },
  videoStats: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
