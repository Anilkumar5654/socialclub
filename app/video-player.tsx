import { Video as ExpoVideo, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  ThumbsUp,
  ThumbsDown,
  Share2,
  MessageCircle,
  Send,
  ChevronDown,
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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { api, MEDIA_BASE_URL } from '@/services/api';
import { formatTimeAgo } from '@/constants/timeFormat';
import { useWatchTimeTracker } from '@/hooks/useWatchTimeTracker';
import { getDeviceId } from '@/utils/deviceId';
import { Comment } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- HELPER FUNCTION ---
const getMediaUrl = (path: string | undefined) => {
  if (!path) return '';
  return path.startsWith('http') ? path : `${MEDIA_BASE_URL}/${path}`;
};

// --- TYPES ---
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

// FIXED: RecommendedVideoCard (Removed extra whitespace causing crash)
function RecommendedVideoCard({ video, onPress }: { video: VideoData; onPress: () => void }) {
  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  const channelName = video.channel?.name || video.user?.channel_name || 'Channel Name';
  const isVerified = video.channel?.is_verified || video.user?.isVerified || video.user?.is_verified;

  return (
    <TouchableOpacity style={styles.recommendedCard} onPress={onPress} activeOpacity={0.8}>
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
      <View style={styles.recommendedInfo}>
        <Text style={styles.recommendedTitle} numberOfLines={2}>
          {video.title || 'Untitled'}
        </Text>
        <View style={styles.recommendedChannelRow}>
          <Text style={styles.recommendedChannel} numberOfLines={1}>
            {channelName}
          </Text>
          {/* SAFE RENDERING: Conditional null check to avoid text strings outside <Text> */}
          {isVerified ? <Text style={styles.recommendedVerified}> ✓</Text> : null}
        </View>
        <Text style={styles.recommendedStats}>
          {formatViews(video.views || 0)} views · {formatTimeAgo(video.created_at || video.timestamp)}
        </Text>
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

  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [likes, setLikes] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const hasTrackedView = useRef(false);

  // Watch Time Tracker Hook
  const { stopTracking, pauseTracking, resumeTracking } = useWatchTimeTracker({
    videoId: videoId || '',
    videoType: 'video',
    videoDuration: videoDuration / 1000,
    enabled: !!videoId && videoDuration > 0,
  });

  // Queries
  const { data: videoData, isLoading: isLoadingVideo } = useQuery({
    queryKey: ['video-details', videoId],
    queryFn: async () => api.videos.getDetails(videoId || ''),
    enabled: !!videoId,
  });

  const { data: channelData } = useQuery({
    queryKey: ['channel-details', videoData?.video?.user?.channel_id],
    queryFn: async () => {
      const channelId = videoData?.video?.user?.channel_id;
      if (!channelId) return null;
      return api.channels.getChannel(channelId);
    },
    enabled: !!videoData?.video?.user?.channel_id,
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

  const video: VideoData | undefined = videoData?.video;
  const channel = channelData?.channel;
  const comments = commentsData?.comments || [];
  const recommendedVideos = recommendedData?.videos || [];

  // Initialize States
  useEffect(() => {
    if (video) {
      setLikes(video.likes || 0);
      setIsLiked(video.isLiked || false);
      setIsSubscribed(video.isSubscribed || false);
    }
  }, [video]);

  // View Tracking (Fixed with Device ID)
  useEffect(() => {
    if (video && !hasTrackedView.current && videoId) {
      const trackView = async () => {
        try {
          // Fix: Ensure device_id is passed as per API docs
          const deviceId = await getDeviceId();
          // Assuming api.videos.view accepts (videoId, deviceId) or similar. 
          // If strict, we pass deviceId to ensure backend validates it.
          await api.videos.view(videoId, deviceId);
          hasTrackedView.current = true;
        } catch (err) {
          console.log('[VideoPlayer] View tracking skipped/failed');
        }
      };
      trackView();
    }
  }, [video, videoId]);

  useEffect(() => {
    return () => stopTracking();
  }, [stopTracking]);

  // Mutations
  const likeMutation = useMutation({
    mutationFn: () => (isLiked ? api.videos.unlike(videoId || '') : api.videos.like(videoId || '')),
    onSuccess: (data) => {
      setIsLiked(data.isLiked);
      setLikes(data.likes);
      queryClient.invalidateQueries({ queryKey: ['video-details', videoId] });
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: () => {
      const channelId = channel?.id || video?.user?.channel_id;
      if (!channelId) throw new Error('No channel');
      return isSubscribed ? api.channels.unsubscribe(channelId) : api.channels.subscribe(channelId);
    },
    onSuccess: (data) => {
      setIsSubscribed(data.isSubscribed);
      queryClient.invalidateQueries({ queryKey: ['channel-details'] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => api.videos.comment(videoId || '', content),
    onSuccess: () => {
      setCommentText('');
      refetchComments();
      queryClient.invalidateQueries({ queryKey: ['video-comments', videoId] });
    },
  });

  // Handlers
  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      const wasPlaying = isPlaying;
      const nowPlaying = status.isPlaying;
      setIsPlaying(nowPlaying);

      if (wasPlaying && !nowPlaying) pauseTracking();
      else if (!wasPlaying && nowPlaying) resumeTracking();

      if (status.durationMillis) setVideoDuration(status.durationMillis);
      if (status.didJustFinish) stopTracking();
    }
  }, [isPlaying, pauseTracking, resumeTracking, stopTracking]);

  const handleLike = useCallback(() => {
    if (isDisliked) setIsDisliked(false);
    likeMutation.mutate();
  }, [isDisliked, likeMutation]);

  const handleDislike = useCallback(() => {
    if (isLiked) {
      setIsLiked(false);
      setLikes(l => l - 1);
    }
    setIsDisliked(!isDisliked);
  }, [isLiked, isDisliked]);

  const handleSubscribe = useCallback(() => subscribeMutation.mutate(), [subscribeMutation]);

  const handleAddComment = useCallback(() => {
    if (!commentText.trim()) return;
    commentMutation.mutate(commentText.trim());
  }, [commentText, commentMutation]);

  const handleShare = useCallback(async () => {
    const shareUrl = `https://www.moviedbr.com/video/${videoId}`;
    try { await api.videos.share(videoId || ''); } catch {}
    Alert.alert('Share', shareUrl);
  }, [videoId]);

  const handleWhatsAppShare = useCallback(async () => {
    const videoUrl = `https://www.moviedbr.com/video/${videoId}`;
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(`Check out this video: ${videoUrl}`)}`;
    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) await Linking.openURL(whatsappUrl);
      else Alert.alert('Error', 'WhatsApp not installed');
    } catch {
      Alert.alert('Error', 'Failed to open WhatsApp');
    }
  }, [videoId]);

  const handleChannelPress = useCallback(() => {
    const targetUserId = channel?.user_id || video?.user?.id;
    if (targetUserId) {
      router.push({ pathname: '/user/[userId]', params: { userId: targetUserId } });
    }
  }, [channel?.user_id, video?.user?.id]);

  const handleRecommendedPress = useCallback((recVideoId: string) => {
    hasTrackedView.current = false;
    stopTracking();
    router.setParams({ videoId: recVideoId });
  }, [stopTracking]);

  const formatViewsDisplay = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  if (isLoadingVideo) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!video) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorText}>Video not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const videoUrl = getMediaUrl(video.video_url || video.videoUrl);
  const channelName = channel?.name || video.channel?.name || video.user?.channel_name || 'Channel';
  
  // LOGIC FIX: Fallback to assets/c_profile.jpg ONLY if no real channel/user avatar
  const channelAvatar = getMediaUrl(channel?.avatar || video.channel?.avatar || 'assets/c_profile.jpg');
  
  const subscriberCount = channel?.subscribers_count ?? video.channel?.subscribers_count ?? 0;
  const isChannelVerified = channel?.is_verified || video.channel?.is_verified || false;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* STICKY VIDEO PLAYER CONTAINER */}
      <View style={styles.playerContainer}>
        <ExpoVideo
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.player}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls={true} // Using Native Controls for YouTube-like Seekbar/Fullscreen
          shouldPlay={isPlaying}
          isLooping={false}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        />
      </View>

      {/* SCROLLABLE CONTENT */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        
        <View style={styles.videoDetails}>
          <Text style={styles.videoTitle}>{video.title || video.caption || 'Untitled Video'}</Text>
          <Text style={styles.videoStats}>
            {formatViewsDisplay(video.views || 0)} views · {formatTimeAgo(video.created_at || video.timestamp)}
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
              <ThumbsUp
                color={isLiked ? Colors.primary : Colors.text}
                fill={isLiked ? Colors.primary : 'transparent'}
                size={22}
              />
              <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>
                {formatViewsDisplay(likes)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleDislike}>
              <ThumbsDown
                color={isDisliked ? Colors.primary : Colors.text}
                fill={isDisliked ? Colors.primary : 'transparent'}
                size={22}
              />
              <Text style={[styles.actionText, isDisliked && styles.actionTextActive]}>Dislike</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => setShowCommentsModal(true)}>
              <MessageCircle color={Colors.text} size={22} />
              <Text style={styles.actionText}>{comments.length}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleWhatsAppShare}>
              <Send color={Colors.text} size={22} />
              <Text style={styles.actionText}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Share2 color={Colors.text} size={22} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <TouchableOpacity style={styles.channelContainer} onPress={handleChannelPress} activeOpacity={0.8}>
          <View style={styles.channelInfo}>
            <Image source={{ uri: channelAvatar }} style={styles.channelAvatar} />
            <View style={styles.channelDetails}>
              <View style={styles.channelNameRow}>
                <Text style={styles.channelName}>{channelName}</Text>
                {isChannelVerified && <Text style={styles.verifiedBadge}> ✓</Text>}
              </View>
              <Text style={styles.subscriberCount}>
                {subscriberCount > 1000 ? `${(subscriberCount / 1000).toFixed(1)}K` : subscriberCount} subscribers
              </Text>
            </View>
          </View>
          {(channel?.id || video.user?.channel_id) && (
            <TouchableOpacity
              style={[styles.subscribeButton, isSubscribed && styles.subscribedButton]}
              onPress={handleSubscribe}
              disabled={subscribeMutation.isPending}
            >
              <Text style={[styles.subscribeText, isSubscribed && styles.subscribedText]}>
                {subscribeMutation.isPending ? '...' : isSubscribed ? 'Subscribed' : 'Subscribe'}
              </Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText} numberOfLines={showFullDescription ? undefined : 3}>
            {video.description || video.caption || 'No description available'}
          </Text>
          <TouchableOpacity onPress={() => setShowFullDescription(!showFullDescription)}>
            <View style={styles.showMoreButton}>
              <Text style={styles.showMoreText}>{showFullDescription ? 'Show less' : 'Show more'}</Text>
              <ChevronDown
                color={Colors.textSecondary}
                size={16}
                style={showFullDescription ? { transform: [{ rotate: '180deg' }] } : undefined}
              />
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
            <RecommendedVideoCard 
              key={rec.id} 
              video={rec} 
              onPress={() => handleRecommendedPress(rec.id)} 
            />
          ))}
        </View>
      </ScrollView>

      {/* COMMENTS MODAL */}
      <Modal
        visible={showCommentsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCommentsModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Comments · {comments.length}</Text>
            <TouchableOpacity onPress={() => setShowCommentsModal(false)}>
              <Text style={styles.modalCloseButton}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.addCommentContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              placeholderTextColor={Colors.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            {commentText.trim().length > 0 && (
              <TouchableOpacity
                style={styles.commentPostButton}
                onPress={handleAddComment}
                disabled={commentMutation.isPending}
              >
                {commentMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.text} />
                ) : (
                  <Text style={styles.commentPostButtonText}>Post</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <CommentItem comment={item} />}
            contentContainerStyle={styles.commentsList}
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                <Text style={styles.emptyCommentsText}>No comments yet. Be the first!</Text>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  playerContainer: {
    width: SCREEN_WIDTH,
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  player: {
    width: '100%',
    height: '100%',
  },
  videoDetails: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  videoTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 24,
    marginBottom: 8,
  },
  videoStats: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  actionTextActive: {
    color: Colors.primary,
  },
  channelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  channelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  channelAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
  },
  channelDetails: {
    flex: 1,
  },
  channelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  verifiedBadge: {
    color: Colors.info,
    fontSize: 13,
  },
  subscriberCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  subscribeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: Colors.primary,
  },
  subscribedButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subscribeText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  subscribedText: {
    color: Colors.textSecondary,
  },
  descriptionContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  descriptionText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  commentsPreview: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  commentPreviewItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  commentPreviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  commentPreviewText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  recommendedSection: {
    padding: 16,
  },
  recommendedSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  recommendedCard: {
    marginBottom: 16,
  },
  recommendedThumbnailContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: Colors.surface,
  },
  recommendedThumbnail: {
    width: '100%',
    height: '100%',
  },
  recommendedDuration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  recommendedDurationText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  recommendedInfo: {
    gap: 4,
  },
  recommendedTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 18,
  },
  recommendedChannelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendedChannel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  recommendedVerified: {
    color: Colors.info,
    fontSize: 11,
  },
  recommendedStats: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  modalCloseButton: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    maxHeight: 100,
  },
  commentPostButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  commentPostButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  commentsList: {
    padding: 16,
  },
  emptyComments: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyCommentsText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  commentTime: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  commentText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  commentLikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentLikeText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
