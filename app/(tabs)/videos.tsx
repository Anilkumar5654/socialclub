import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Plus, TrendingUp, Flame, Clock, BarChart2, Search } from 'lucide-react-native';
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
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { formatTimeAgo } from '@/constants/timeFormat';
import { useAuth } from '@/contexts/AuthContext';
import { api, MEDIA_BASE_URL } from '@/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Filter Categories for Viral Logic
const VIDEO_FILTERS = [
  { id: 'all', label: 'All', icon: BarChart2 },
  { id: 'trending', label: 'Trending', icon: TrendingUp }, // Sort by Viral Score High -> Low
  { id: 'hot', label: 'Hot', icon: Flame }, // High Viral Score + Recent
  { id: 'recent', label: 'Recent', icon: Clock }, // Created Date High -> Low
];

// Helper: Get Full URL
const getMediaUri = (uri: string | undefined) => {
  if (!uri) return '';
  return uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`;
};

// Helper: Format Views (e.g. 1.2M, 5K)
const formatViews = (views: number) => {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
};

// Helper: Format Duration (seconds to MM:SS)
const formatDuration = (seconds: number) => {
    if (!seconds) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
        return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// --- SINGLE VIDEO CARD COMPONENT ---
const VideoCard = React.memo(({ video }: { video: any }) => {
  
  const handlePress = useCallback(() => {
    // Navigate to Player
    router.push({ pathname: '/videos/player', params: { videoId: video.id } });
  }, [video.id]);

  const handleChannelPress = useCallback(() => {
    // Navigate to Channel Profile
    if (video.channel_id) {
        router.push({ pathname: '/channel/[channelId]', params: { channelId: video.channel_id } });
    }
  }, [video.channel_id]);

  // Data Handling (Channel Logic)
  const channelName = video.channel_name || video.user?.channel_name || 'Unknown Channel';
  // Fallback to user avatar if channel avatar missing
  const channelAvatar = getMediaUri(video.channel_avatar || video.user?.avatar || 'assets/c_profile.jpg');
  const isVerified = !!(video.channel_verified || video.is_verified);
  const thumbnailUrl = getMediaUri(video.thumbnail_url);

  return (
    <TouchableOpacity 
      style={styles.videoCard} 
      onPress={handlePress}
      activeOpacity={0.9}
    >
      {/* 1. Thumbnail Section */}
      <View style={styles.thumbnailContainer}>
        <Image 
          source={{ uri: thumbnailUrl }} 
          style={styles.thumbnail} 
          contentFit="cover"
          transition={200}
        />
        {/* Duration Badge */}
        {!!video.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
                {formatDuration(video.duration)}
            </Text>
          </View>
        )}
      </View>
      
      {/* 2. Info Section */}
      <View style={styles.videoInfoRow}>
        {/* Channel Avatar */}
        <Pressable onPress={handleChannelPress}>
           <Image source={{ uri: channelAvatar }} style={styles.avatar} />
        </Pressable>

        {/* Text Details */}
        <View style={styles.videoDetailsColumn}>
            <Text style={styles.videoTitle} numberOfLines={2}>
              {video.title || video.caption || 'Untitled Video'}
            </Text>
            
            <Text style={styles.metaText} numberOfLines={1}>
              {channelName}
              {isVerified ? ' ✓' : ''} 
              {' · '}
              {formatViews(video.views_count || 0)} views
              {' · '}
              {formatTimeAgo(video.created_at)}
            </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// --- MAIN SCREEN ---
export default function VideosScreen() {
  const { isAuthenticated } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState('all');
  const insets = useSafeAreaInsets();

  // 1. Fetch Videos
  const { 
    data: videosData, 
    isLoading, 
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['videos-feed'], 
    queryFn: async () => {
      // Fetching default feed (Page 1, 20 items)
      const response = await api.videos.getVideos(1, 20); 
      return response;
    },
  });

  const videos = videosData?.videos || [];

  // 2. Sorting Logic (Viral Strategy)
  // Frontend sorting is fast for initial data. For heavy data, move sort to Backend API params.
  const displayVideos = useMemo(() => {
    if (!videos.length) return [];
    
    let sorted = [...videos];

    if (selectedFilter === 'trending') {
       // STRATEGY: Highest Viral Score comes first
       sorted.sort((a, b) => (Number(b.viral_score) || 0) - (Number(a.viral_score) || 0));
    } else if (selectedFilter === 'hot') {
       // STRATEGY: Recent + High Viral Score
       // (Simplified: Just Viral Score > 10, then sorted by date)
       sorted = sorted.filter(v => (Number(v.viral_score) || 0) > 10);
       sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (selectedFilter === 'recent') {
       // STRATEGY: Newest Uploads
       sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    // 'all' = Default API order
    
    return sorted;
  }, [videos, selectedFilter]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>Videos</Text>
        <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/search')}>
                <Search color="#fff" size={24} />
            </TouchableOpacity>
            {isAuthenticated && (
            <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => router.push('/videos/upload')}
            >
                <Plus color="#000" size={22} />
            </TouchableOpacity>
            )}
        </View>
      </View>

      {/* Filters */}
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
                <IconComponent color={isActive ? '#000' : Colors.textSecondary} size={14} />
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Video List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayVideos}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <VideoCard video={item} />}
          contentContainerStyle={styles.videosList}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No videos found</Text>
              <Text style={styles.emptySubtext}>
                 {selectedFilter === 'hot' ? 'No hot videos yet.' : 'Be the first to upload!'}
              </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  iconBtn: {
    padding: 4
  },
  uploadButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary, // Pink Brand Color
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Filters
  filterRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    backgroundColor: Colors.background,
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
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: '#000',
  },
  
  // Video List
  videosList: {
    paddingBottom: 100,
  },
  videoCard: {
    marginBottom: 20,
    backgroundColor: Colors.background,
  },
  thumbnailContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.5625, // 16:9 Ratio
    backgroundColor: '#1A1A1A',
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
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  
  // Info Section
  videoInfoRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#333',
  },
  videoDetailsColumn: {
    flex: 1,
    gap: 4,
  },
  videoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 20,
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
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
