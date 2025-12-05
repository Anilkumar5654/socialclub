import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';

// Helper functions (Must be consistent with main file helpers)
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getMediaUrl = (path: string | undefined) => {
  if (!path) return '';
  return path.startsWith('http') ? path : `${MEDIA_BASE_URL}/${path}`;
};

const formatViews = (views: number | undefined | null) => {
  const safeViews = Number(views) || 0;
  if (safeViews >= 1000000) return `${(safeViews / 1000000).toFixed(1)}M`;
  if (safeViews >= 1000) return `${(safeViews / 1000).toFixed(1)}K`;
  return safeViews.toString();
};

const formatDuration = (seconds: any) => {
    const sec = Number(seconds) || 0;
    if (sec <= 0) return "00:00";
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

interface RecommendedVideo {
    id: string;
    title: string;
    thumbnail_url: string;
    duration: number;
    views_count: number;
    created_at: string;
    channel_name: string;
    channel_avatar: string;
}

interface RecommendedVideosProps {
    recommended: RecommendedVideo[];
}

// --- RECOMMENDED CARD (Helper used inside the main component) ---
const RecommendedVideoCard = ({ video, onPress }: { video: RecommendedVideo; onPress: () => void }) => {
  const channelName = video.channel_name || 'Channel';
  const channelAvatar = getMediaUrl(video.channel_avatar || 'assets/c_profile.jpg');
  
  return (
    <TouchableOpacity style={styles.recCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.recThumbContainer}>
        <Image source={{ uri: getMediaUrl(video.thumbnail_url) }} style={styles.recThumb} contentFit="cover" />
        <View style={styles.recDuration}>
            <Text style={styles.recDurationText}>{formatDuration(video.duration)}</Text>
        </View>
      </View>
      <View style={styles.recInfo}>
        <Image source={{ uri: channelAvatar }} style={styles.recAvatar} />
        <View style={styles.recTextCol}>
          <Text style={styles.recTitle} numberOfLines={2}>{video.title}</Text>
          <Text style={styles.recMeta} numberOfLines={1}>
            {channelName} · {formatViews(video.views_count)} views · {formatTimeAgo(video.created_at)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};


// --- MAIN RECOMMENDED VIDEOS COMPONENT ---
export default function RecommendedVideos({ recommended }: RecommendedVideosProps) {
    
    // Handler to navigate to the new video player screen
    const handleVideoPress = (videoId: string) => {
        // Use replace to prevent stacking endless player screens
        router.replace({ pathname: '/videos/player', params: { videoId } });
    };

    if (!recommended || recommended.length === 0) {
        return null; 
    }

    return (
        <View style={styles.recSection}>
            {recommended.map((item: RecommendedVideo) => (
                <RecommendedVideoCard 
                    key={item.id} 
                    video={item} 
                    onPress={() => handleVideoPress(item.id)} 
                />
            ))}
        </View>
    );
}

// --- STYLES ---

const styles = StyleSheet.create({
    recSection: { paddingBottom: 40 },
    recCard: { marginBottom: 16 },
    recThumbContainer: { width: SCREEN_WIDTH, aspectRatio: 16/9, backgroundColor: '#222' },
    recThumb: { width: '100%', height: '100%' },
    recDuration: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    recDurationText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    recInfo: { flexDirection: 'row', padding: 12, gap: 12 },
    recAvatar: { width: 36, height: 36, borderRadius: 18 },
    recTextCol: { flex: 1, gap: 4 },
    recTitle: { color: '#fff', fontSize: 15, fontWeight: '500', lineHeight: 20 },
    recMeta: { color: '#999', fontSize: 12 }, // Assuming default secondary color is needed
});
