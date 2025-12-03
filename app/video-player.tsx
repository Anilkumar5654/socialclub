Import { Video as ExpoVideo, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  ThumbsUp,
  ThumbsDown,
  Share2,
  MessageCircle,
  Send,
  ChevronDown,
  Play,
  Pause,
  Maximize,
} from 'lucide-react-native';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  FlatList,
  TextInput,
  ActivityIndicator,
  Linking,
  Alert,
  Modal,
  Pressable,
  StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { formatTimeAgo } from '@/constants/timeFormat';
import { useWatchTimeTracker } from '@/hooks/useWatchTimeTracker';
import { getDeviceId } from '@/utils/deviceId';

import { api, MEDIA_BASE_URL } from '../services/api';
import { VideoAdManager } from '../services/VideoAdManager'; 

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// GLOBAL COUNTER FOR AD FREQUENCY
let globalVideoViewCount = 0;
const AD_FREQUENCY = 1; // Har 1st video par Ad (Testing के लिए)

// --- HELPER FUNCTIONS ---
const getMediaUrl = (path: string | undefined) => {
  if (!path) return '';
  return path.startsWith('http') ? path : `${MEDIA_BASE_URL}/${path}`;
};

const formatDuration = (millis: number) => {
  const minutes = Math.floor(millis / 60000);
  const seconds = ((millis % 60000) / 1000).toFixed(0);
  return `${minutes}:${Number(seconds) < 10 ? '0' : ''}${seconds}`;
};

// --- TYPES ---
interface Comment {
  id: string;
  user_id: string;
  content: string;
  likes?: number;
  created_at?: string;
  timestamp?: string;
  user?: {
    id: string;
    username?: string;
    avatar?: string;
  };
}

interface VideoData {
  id: string;
  title?: string;
  description?: string;
  caption?: string;
  video_url?: string;
  videoUrl?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  duration?: string;
  created_at?: string;
  timestamp?: string;
  isLiked?: boolean;
  isSubscribed?: boolean;
  
  monetization_enabled?: boolean;
  channel_monetization_enabled?: boolean;
  
  user?: {
    id: string;
    name?: string;
    username?: string;
    avatar?: string;
    channel_id?: string;
    channel_name?: string;
    followers_count?: number;
    is_verified?: boolean;
    isVerified?: boolean;
  };
  channel?: {
    id: string;
    name?: string;
    avatar?: string;
    subscribers_count?: number;
    is_verified?: boolean;
    user_id?: string;
  };
}

// --- COMPONENTS ---

function CommentItem({ comment }: { comment: Comment }) {
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(comment.likes || 0);

  return (
    <View style={styles.commentItem}>
      <Image 
        source={{ uri: getMediaUrl(comment.user?.avatar) }} 
        style={styles.commentAvatar} 
      />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUsername}>{comment.user?.username || 'User'}</Text>
          <Text style={styles.commentTime}>
            {formatTimeAgo(comment.created_at || comment.timestamp)}
          </Text>
        </View>
        <Text style={styles.commentText}>{comment.content}</Text>
        <TouchableOpacity
          style={styles.commentLikeButton}
          onPress={() => {
            setIsLiked(!isLiked);
            setLikes(isLiked ? likes - 1 : likes + 1);
          }}
        >
          <ThumbsUp
            color={isLiked ? Colors.primary : Colors.textSecondary}
            size={14}
            fill={isLiked ? Colors.primary : 'transparent'}
          />
          <Text style={styles.commentLikeText}>{likes}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function RecommendedVideoCard({ video, onPress }: { video: VideoData; onPress: () => void }) {
  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  const channelName = video.channel?.name || video.user?.channel_name || 'Channel';
  const channelAvatar = getMediaUrl(video.channel?.avatar || video.user?.avatar || 'assets/c_profile.jpg');
  const isVerified = video.channel?.is_verified || video.user?.isVerified || video.user?.is_verified;

  return (
    <TouchableOpacity style={styles.recommendedCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.recommendedThumbnailContainer}>
        <Image
          source={{ uri: getMediaUrl(video.thumbnail_url || video.thumbnailUrl) }}
          style={styles.recommendedThumbnail}
          contentFit="cover"
        />
        {!!video.duration && (
          <View style={styles.recommendedDuration}>
            <Text style={styles.recommendedDurationText}>{video.duration}</Text>
          </View>
        )}
      </View>

      <View style={styles.recommendedInfoRow}>
        <Image source={{ uri: channelAvatar }} style={styles.recommendedAvatar} />
        
        <View style={styles.recommendedTextCol}>
          <Text style={styles.recommendedTitle} numberOfLines={1}>
            {video.title || 'Untitled'}
          </Text>
          
          <Text style={styles.recommendedMeta} numberOfLines={1}>
            {channelName}
            {isVerified ? ' ✓' : ''} 
            {' · '}
            {formatViews(video.views || 0)} views
            {' · '}
            {formatTimeAgo(video.created_at || video.timestamp)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// --- MAIN SCREEN ---

export default function VideoPlayerScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const videoRef = useRef<ExpoVideo>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [likes, setLikes] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(0);
  const hasTrackedView = useRef(false);

  const { stopTracking, pauseTracking, resumeTracking } = useWatchTimeTracker({
    videoId: videoId || '',
    videoType: 'video',
    videoDuration: videoDuration / 1000,
    enabled: !!videoId && videoDuration > 0,
  });

  const { data: videoData, isLoading: isLoadingVideo } = useQuery({
    queryKey: ['video-details', videoId],
    queryFn: async () => api.videos.getDetails(videoId || ''),
    enabled: !!videoId,
  });

  const video: VideoData | undefined = videoData?.video;

  const { data: channelData } = useQuery({
    queryKey: ['channel-details', video?.user?.channel_id],
    queryFn: async () => {
      const channelId = video?.user?.channel_id;
      if (!channelId) return null;
      return api.channels.getChannel(channelId);
    },
    enabled: !!video?.user?.channel_id,
  });

  const { data: commentsData, refetch: refetchComments } = useQuery({
    queryKey: ['video-comments', videoId],
    queryFn: async () => api.videos.getComments(videoId || '', 1),
    enabled: !!videoId,
  });

  const { data: recommendedData } = useQuery({
    queryKey: ['recommended-videos', videoId],
    queryFn: async () => {
      try {
        const response = await api.videos.getRecommended(videoId || '');
        if (response.videos?.length > 0) return response;
        throw new Error('No recommended videos');
      } catch {
        const fallback = await api.videos.getVideos(1, 10);
        return { videos: fallback.videos?.filter((v: VideoData) => v.id !== videoId) || [] };
      }
    },
    enabled: !!videoId,
  });

  const channel = channelData?.channel;
  const comments = commentsData?.comments || [];
  const recommendedVideos = recommendedData?.videos || [];

  useEffect(() => {
    if (video) {
      setLikes(video.likes || 0);
      setIsLiked(video.isLiked || false);
      setIsSubscribed(video.isSubscribed || false);
    }
  }, [video]);

  // FINAL AD LOGIC
  useEffect(() => {
    const checkAndPlayAd = async () => {
        if (!video || !videoRef.current) return;
        
        // 1. Ad Loading and Counter
        VideoAdManager.loadAd();
        globalVideoViewCount++;
        console.log(`[VideoPlayer] Count: ${globalVideoViewCount}`);

        // CRITICAL: Monetization Check Logic Update
        const isVideoMonetized = video.monetization_enabled === true; 
        const isChannelMonetized = video.channel_monetization_enabled === true;
        
        // विज्ञापन तभी दिखाएँ जब काउंटर पूरा हो AND वीडियो और चैनल दोनों मोनिटाइज्ड हों।
        const isMonetized = isVideoMonetized && isChannelMonetized;
        const shouldShowAd = (globalVideoViewCount >= AD_FREQUENCY) && isMonetized;
        
        // 2. Ad Show Logic
        if (shouldShowAd) {
            console.log('[VideoPlayer] Triggering Ad');
            
            // CRITICAL: Pause video before showing ad
            await videoRef.current.pauseAsync(); 
            pauseTracking();
            
            const adShown = await VideoAdManager.showAd(video); 
            
            if (adShown) {
                globalVideoViewCount = 0;
            }
        }

        // 3. Resume Playback
        await videoRef.current.playAsync(); 
        setIsPlaying(true); 
        resumeTracking();
    };

    if (video) checkAndPlayAd();
    
    // Cleanup function
    return () => {
        if (videoRef.current) {
            videoRef.current.pauseAsync();
        }
        stopTracking();
    };
  }, [video, videoId, pauseTracking, resumeTracking, stopTracking]); 

  // View Tracking
  useEffect(() => {
    if (video && !hasTrackedView.current && videoId) {
      const trackView = async () => {
        try {
          const deviceId = await getDeviceId();
          await api.videos.view(videoId, deviceId);
          hasTrackedView.current = true;
        } catch (err) {}
      };
      trackView();
    }
  }, [video, videoId]);

  useEffect(() => { return () => stopTracking(); }, [stopTracking]);

  useEffect(() => {
    if (showControls) {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      controlsTimeout.current = setTimeout(() => { if (isPlaying) setShowControls(false); }, 3000);
    }
    return () => { if (controlsTimeout.current) clearTimeout(controlsTimeout.current); };
  }, [showControls, isPlaying]);

  const likeMutation = useMutation({
    mutationFn: () => (isLiked ? api.videos.unlike(videoId || '') : api.videos.like(videoId || '')),
    onSuccess: (data) => { setIsLiked(data.isLiked); setLikes(data.likes); queryClient.invalidateQueries({ queryKey: ['video-details', videoId] }); },
  });

  const subscribeMutation = useMutation({
    mutationFn: () => {
      const channelId = channel?.id || video?.user?.channel_id;
      if (!channelId) throw new Error('No channel');
      return isSubscribed ? api.channels.unsubscribe(channelId) : api.channels.subscribe(channelId);
    },
    onSuccess: (data) => { setIsSubscribed(data.isSubscribed); queryClient.invalidateQueries({ queryKey: ['channel-details'] }); },
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => api.videos.comment(videoId || '', content),
    onSuccess: () => { setCommentText(''); refetchComments(); queryClient.invalidateQueries({ queryKey: ['video-comments', videoId] }); },
  });

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (status.durationMillis) setVideoDuration(status.durationMillis);
      if (status.positionMillis) setCurrentPosition(status.positionMillis);
      if (status.didJustFinish) { setIsPlaying(false); setShowControls(true); stopTracking(); }
    }
  }, [stopTracking]);

  const togglePlayPause = async () => {
    if (!videoRef.current) return;
    if (isPlaying) { await videoRef.current.pauseAsync(); setIsPlaying(false); pauseTracking(); setShowControls(true); }
    else { await videoRef.current.playAsync(); setIsPlaying(true); resumeTracking(); }
  };

  const handleScreenTap = () => setShowControls(prev => !prev);
  const handleLike = () => { if (isDisliked) setIsDisliked(false); likeMutation.mutate(); };
  const handleDislike = () => { if (isLiked) { setIsLiked(false); setLikes(l => l - 1); } setIsDisliked(!isDisliked); };
  const handleSubscribe = () => subscribeMutation.mutate();
  const handleAddComment = () => { if (commentText.trim()) commentMutation.mutate(commentText.trim()); };
  
  const handleShare = async () => {
    try { await api.videos.share(videoId || ''); } catch {}
    Alert.alert('Share', `https://www.moviedbr.com/video/${videoId}`);
  };

  const handleWhatsAppShare = async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(`Check out this video: https://www.moviedbr.com/video/${videoId}`)}`;
    try { await Linking.openURL(url); } catch { Alert.alert('Error', 'WhatsApp not installed'); }
  };

  const handleChannelPress = () => {
    const targetChannelId = channel?.id || video?.user?.channel_id;
    if (targetChannelId) {
      router.push({ pathname: '/channel/[channelId]', params: { channelId: targetChannelId } });
    } else {
      Alert.alert('Error', 'Channel details not available.');
    }
  };

  const handleRecommendedPress = (recVideoId: string) => {
    hasTrackedView.current = false;
    stopTracking();
    setIsPlaying(false); 
    router.push({ pathname: '/video-player', params: { videoId: recVideoId } });
  };

  const formatViewsDisplay = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  if (isLoadingVideo || !video) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const videoUrl = getMediaUrl(video.video_url || video.videoUrl);
  
  let safeChannelName = 'Channel';
  if (channel?.name) safeChannelName = channel.name;
  else if (video?.channel?.name) safeChannelName = video.channel.name;
  else if (video?.user?.channel_name) safeChannelName = video.user.channel_name;

  const channelAvatar = getMediaUrl(channel?.avatar || video.channel?.avatar || 'assets/c_profile.jpg');
  const subscriberCount = channel?.subscribers_count ?? video.channel?.subscribers_count ?? 0;
  const isChannelVerified = channel?.is_verified || video.channel?.is_verified || false;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <View style={styles.playerContainer}>
        <ExpoVideo
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.player}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls={false}
          shouldPlay={isPlaying}
          isLooping={false}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        />
        <Pressable style={styles.overlayContainer} onPress={handleScreenTap}>
          {showControls && (
            <View style={styles.controlsLayer}>
              <TouchableOpacity style={styles.centerButton} onPress={togglePlayPause}>
                {isPlaying ? <Pause color="white" size={48} fill="white" /> : <Play color="white" size={48} fill="white" />}
              </TouchableOpacity>
              <View style={styles.bottomControlBar}>
                <Text style={styles.timeText}>{formatDuration(currentPosition)} / {formatDuration(videoDuration)}</Text>
                <View style={styles.progressBarContainer}>
                   <View style={[styles.progressBarFill, { width: `${(currentPosition / (videoDuration || 1)) * 100}%` }]} />
                </View>
                <Maximize color="white" size={20} />
              </View>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <View style={styles.videoDetails}>
          <Text style={styles.videoTitle}>{video.title || video.caption || 'Untitled Video'}</Text>
          <Text style={styles.videoStats}>{formatViewsDisplay(video.views || 0)} views · {formatTimeAgo(video.created_at || video.timestamp)}</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
              <ThumbsUp color={isLiked ? Colors.primary : Colors.text} fill={isLiked ? Colors.primary : 'transparent'} size={22} />
              <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>{formatViewsDisplay(likes)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButtonIconOnly} onPress={handleDislike}><ThumbsDown color={isDisliked ? Colors.primary : Colors.text} size={22} /></TouchableOpacity>
            <TouchableOpacity style={styles.actionButtonIconOnly} onPress={() => setShowCommentsModal(true)}><MessageCircle color={Colors.text} size={22} /></TouchableOpacity>
            <TouchableOpacity style={styles.actionButtonIconOnly} onPress={handleWhatsAppShare}><Send color={Colors.text} size={22} /></TouchableOpacity>
            <TouchableOpacity style={styles.actionButtonIconOnly} onPress={handleShare}><Share2 color={Colors.text} size={22} /></TouchableOpacity>
          </ScrollView>
        </View>

        <TouchableOpacity style={styles.channelContainer} onPress={handleChannelPress} activeOpacity={0.8}>
          <View style={styles.channelInfo}>
            <Image source={{ uri: channelAvatar }} style={styles.channelAvatar} />
            <View style={styles.channelDetails}>
              <View style={styles.channelNameRow}>
                <Text style={styles.channelName}>{safeChannelName}</Text>
                {isChannelVerified && <Text style={styles.verifiedBadge}> ✓</Text>}
              </View>
              <Text style={styles.subscriberCount}>{subscriberCount > 1000 ? `${(subscriberCount / 1000).toFixed(1)}K` : subscriberCount} subscribers</Text>
            </View>
          </View>
          {(channel?.id || video.user?.channel_id) && (
            <TouchableOpacity style={[styles.subscribeButton, isSubscribed && styles.subscribedButton]} onPress={handleSubscribe} disabled={subscribeMutation.isPending}>
              <Text style={[styles.subscribeText, isSubscribed && styles.subscribedText]}>{subscribeMutation.isPending ? '...' : isSubscribed ? 'Subscribed' : 'Subscribe'}</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText} numberOfLines={showFullDescription ? undefined : 3}>{video.description || video.caption || 'No description'}</Text>
          <TouchableOpacity onPress={() => setShowFullDescription(!showFullDescription)}>
            <View style={styles.showMoreButton}>
              <Text style={styles.showMoreText}>{showFullDescription ? 'Show less' : 'Show more'}</Text>
              <ChevronDown color={Colors.textSecondary} size={16} style={showFullDescription ? { transform: [{ rotate: '180deg' }] } : undefined} />
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.commentsPreview} onPress={() => setShowCommentsModal(true)}>
          <Text style={styles.commentsTitle}>Comments · {comments.length}</Text>
          {comments.length > 0 && (
            <View style={styles.commentPreviewItem}>
              <Image source={{ uri: getMediaUrl(comments[0].user?.avatar) }} style={styles.commentPreviewAvatar} />
              <Text style={styles.commentPreviewText} numberOfLines={2}>{comments[0].content}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.recommendedSection}>
          <Text style={styles.recommendedSectionTitle}>Recommended</Text>
          {recommendedVideos.map((rec: VideoData) => (
            <RecommendedVideoCard key={rec.id} video={rec} onPress={() => handleRecommendedPress(rec.id)} />
          ))}
        </View>
      </ScrollView>

      <Modal visible={showCommentsModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCommentsModal(false)}>
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Comments · {comments.length}</Text>
            <TouchableOpacity onPress={() => setShowCommentsModal(false)}><Text style={styles.modalCloseButton}>Done</Text></TouchableOpacity>
          </View>
          <View style={styles.addCommentContainer}>
            <TextInput style={styles.commentInput} placeholder="Add a comment..." placeholderTextColor={Colors.textMuted} value={commentText} onChangeText={setCommentText} multiline />
            {commentText.trim().length > 0 && (
              <TouchableOpacity style={styles.commentPostButton} onPress={handleAddComment}><Text style={styles.commentPostButtonText}>Post</Text></TouchableOpacity>
            )}
          </View>
          <FlatList data={comments} keyExtractor={(item) => item.id} renderItem={({ item }) => <CommentItem comment={item} />} contentContainerStyle={styles.commentsList} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: Colors.textSecondary, marginTop: 16 },
  errorText: { fontSize: 16, color: Colors.error, marginBottom: 16 },
  retryButton: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  retryButtonText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  playerContainer: { width: SCREEN_WIDTH, aspectRatio: 16 / 9, backgroundColor: '#000', position: 'relative' },
  player: { width: '100%', height: '100%' },
  overlayContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  controlsLayer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  centerButton: { padding: 20 },
  bottomControlBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: 'transparent' },
  timeText: { color: 'white', fontSize: 12, marginRight: 10, fontWeight: '600' },
  progressBarContainer: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginRight: 10, borderRadius: 2 },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  videoDetails: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  videoTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, lineHeight: 24, marginBottom: 8 },
  videoStats: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  actionsContainer: { flexDirection: 'row', gap: 12, paddingRight: 16 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, backgroundColor: Colors.surface },
  actionButtonIconOnly: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface },
  actionText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  actionTextActive: { color: Colors.primary },
  channelContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  channelInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  channelAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface },
  channelDetails: { flex: 1 },
  channelNameRow: { flexDirection: 'row', alignItems: 'center' },
  channelName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  verifiedBadge: { color: Colors.info, fontSize: 13 },
  subscriberCount: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  subscribeButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, backgroundColor: Colors.primary },
  subscribedButton: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  subscribeText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  subscribedText: { color: Colors.textSecondary },
  descriptionContainer: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  descriptionText: { fontSize: 14, color: Colors.text, lineHeight: 20, marginBottom: 8 },
  showMoreButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  showMoreText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  commentsPreview: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  commentsTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  commentPreviewItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  commentPreviewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface },
  commentPreviewText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 18 },
  recommendedSection: { paddingBottom: 20 },
  recommendedSectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginHorizontal: 16, marginVertical: 16 },
  recommendedCard: { marginBottom: 20, backgroundColor: Colors.background },
  recommendedThumbnailContainer: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.5625, backgroundColor: Colors.surface, position: 'relative' },
  recommendedThumbnail: { width: '100%', height: '100%' },
  recommendedDuration: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0, 0, 0, 0.85)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  recommendedDurationText: { color: Colors.text, fontSize: 12, fontWeight: '600' },
  recommendedInfoRow: { flexDirection: 'row', padding: 12, gap: 12 },
  recommendedAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface },
  recommendedTextCol: { flex: 1, justifyContent: 'center', gap: 4 },
  recommendedTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, lineHeight: 20 },
  recommendedMeta: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  modalCloseButton: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  addCommentContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  commentInput: { flex: 1, fontSize: 14, color: Colors.text, backgroundColor: Colors.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, minHeight: 40, maxHeight: 100 },
  commentPostButton: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 20, minWidth: 60, alignItems: 'center' },
  commentPostButtonText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  commentsList: { padding: 16 },
  commentItem: { flexDirection: 'row', marginBottom: 16, gap: 12 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  commentUsername: { fontSize: 14, fontWeight: '600', color: Colors.text },
  commentTime: { fontSize: 12, color: Colors.textMuted },
  commentText: { fontSize: 14, color: Colors.text, lineHeight: 20, marginBottom: 8 },
  commentLikeButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentLikeText: { fontSize: 13, color: Colors.textSecondary },
});
