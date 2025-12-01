import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Plus, TrendingUp, Flame, Clock, BarChart2 } from 'lucide-react-native';
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Pressable,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { formatTimeAgo } from '@/constants/timeFormat';
import { useAuth } from '@/contexts/AuthContext';
import { api, MEDIA_BASE_URL } from '@/services/api';
import { Video as VideoType } from '@/types';
import { VideoCardSkeleton } from '@/components/SkeletonLoader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Ye Filters hain, Category nahi
const VIDEO_FILTERS = [
  { id: 'all', label: 'All', icon: BarChart2 },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'hot', label: 'Hot', icon: Flame },
  { id: 'recent', label: 'Recent', icon: Clock },
];

const getMediaUri = (uri: string | undefined) => {
  if (!uri) return '';
  return uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`;
};

const formatViews = (views: number) => {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
};

// --- YOUTUBE STYLE VIDEO CARD ---
const VideoCard = React.memo(({ video, index }: { video: VideoType; index: number }) => {
  const handlePress = useCallback(() => {
    router.push({ pathname: '/video-player', params: { videoId: video.id } });
  }, [video.id]);

  const handleChannelPress = useCallback((e: any) => {
    e.stopPropagation();
    const targetUserId = video.channel?.user_id || video.user?.id;
    if (targetUserId) {
      router.push({ pathname: '/user/[userId]', params: { userId: targetUserId } });
    }
  }, [video.channel?.user_id, video.user?.id]);

  const channelName = video.channel?.name || video.user?.channel_name || 'Channel';
  const channelAvatar = getMediaUri(video.channel?.avatar || video.user?.avatar || 'assets/c_profile.jpg');
  const isVerified = !!(video.channel?.is_verified || video.user?.isVerified || video.user?.is_verified);
  const thumbnailUrl = getMediaUri(video.thumbnail_url || video.thumbnailUrl);

  return (
    <TouchableOpacity 
      style={styles.videoCard} 
      onPress={handlePress}
      activeOpacity={0.9}
    >
      {/* 1. Full Width Thumbnail */}
      <View style={styles.thumbnailContainer}>
        <Image 
          source={{ uri: thumbnailUrl }} 
          style={styles.thumbnail} 
          contentFit="cover"
          placeholder={require('@/assets/images/icon.png')}
          transition={200}
        />
        {!!video.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{video.duration}</Text>
          </View>
        )}
      </View>
      
      {/* 2. Info Section (Row Layout) */}
      <View style={styles.videoInfoRow}>
        {/* Left: Avatar */}
        <Pressable onPress={handleChannelPress}>
           <Image source={{ uri: channelAvatar }} style={styles.avatar} />
        </Pressable>

        {/* Right: Details */}
        <View style={styles.videoDetailsColumn}>
            <Text style={styles.videoTitle} numberOfLines={2}>
              {video.title || 'Untitled Video'}
            </Text>
            
            {/* Metadata Row */}
            <View style={styles.metaDataRow}>
                <Text style={styles.metaText} numberOfLines={1}>
                  {channelName}
                  {isVerified && ' ✓'} 
                  {' · '}
                  {formatViews(video.views || 0)} views
                  {' · '}
                  {formatTimeAgo(video.created_at || video.timestamp)}
                </Text>
            </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function VideosScreen() {
  const { isAuthenticated } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState('all');
  const insets = useSafeAreaInsets();

  // --- API CALL FIX ---
  // Ham ab 'selectedFilter' backend ko nahi bhej rahe.
  // Ham sirf page aur limit bhej rahe hain taaki sare videos aa jayein.
  const { 
    data: videosData, 
    isLoading, 
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['videos', 'feed'], 
    queryFn: async () => {
      // API call without category filter
      const response = await api.videos.getVideos(1, 20); 
      return response;
    },
  });

  const videos = videosData?.videos || [];

  // --- CLIENT SIDE SORTING ---
  // Data aane ke baad ham phone par sort karenge
  const displayVideos = useMemo(() => {
    if (!videos.length) return [];
    
    // Create a copy to sort
    let sorted = [...videos];

    if (selectedFilter === 'trending') {
       // Sort by Views (High to Low)
       sorted.sort((a, b) => ((b.views || 0) - (a.views || 0)));
    } else if (selectedFilter === 'hot') {
       // Filter by Viral Score
       const hotVideos = sorted.filter(v => (v.viral_score || 0) > 50);
       // Agar hot videos nahi hain, to fallback me trending dikha do
       sorted = hotVideos.length > 0 ? hotVideos : sorted; 
    } else if (selectedFilter === 'recent') {
       // Sort by Date (Newest First)
       sorted.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    
    return sorted;
  }, [videos, selectedFilter]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Videos</Text>
        {isAuthenticated && (
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => router.push('/video-upload')}
          >
            <Plus color={Colors.text} size={20} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
          {VIDEO_FILTERS.map((filter) => {
            const IconComponent = filter.icon;
            const isActive = selectedFilter === filter.id;
            return (
              <TouchableOpacity
                key={filter.id}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedFilter(filter.id)}
              >
                <IconComponent color={isActive ? Colors.text : Colors.textSecondary} size={16} />
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{filter.label}</Text>
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
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      ) : (
        <FlatList
          data={displayVideos}
          keyExtractor={(item) => item.id || Math.random().toString()}
          renderItem={({ item, index }) => <VideoCard video={item} index={index} />}
          contentContainerStyle={styles.videosList}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No videos found</Text>
              <Text style={styles.emptySubtext}>Be the first to upload!</Text>
            </View>
          }
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
  
  // --- YOUTUBE STYLE LIST ---
  videosList: {
    paddingBottom: 100,
    paddingTop: 0,
  },
  videoCard: {
    marginBottom: 24,
    backgroundColor: Colors.background,
  },
  thumbnailContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.5625, // 16:9 Aspect Ratio
    backgroundColor: Colors.surface,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Info Row Styles
  videoInfoRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
  },
  videoDetailsColumn: {
    flex: 1,
    gap: 4,
  },
  videoTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 20,
  },
  metaDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  
  // Empty State
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
    marginTop: 4,
  },
});
