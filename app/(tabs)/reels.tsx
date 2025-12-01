import { Video as ExpoVideo, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import {
  Heart,
  MessageCircle,
  Share2,
  Music,
  Bookmark,
  Volume2,
  VolumeX,
  Play,
  Eye,
} from 'lucide-react-native';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share as RNShare,
  Alert,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { formatTimeAgo } from '@/constants/timeFormat';
import { api, MEDIA_BASE_URL } from '@/services/api';
import { Reel } from '@/types';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// --- HELPER COMPONENTS & FUNCTIONS ---

interface CommentData {
  id: string;
  content: string;
  created_at?: string;
  timestamp?: string;
  user?: {
    id: string;
    username?: string;
    avatar?: string;
  };
}

interface CommentsSheetProps {
  visible: boolean;
  onClose: () => void;
  reelId: string;
}

function CommentsSheet({ visible, onClose, reelId }: CommentsSheetProps) {
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const insets = useSafeAreaInsets();

  const { data: commentsData, isLoading, refetch } = useQuery({
    queryKey: ['reel-comments', reelId],
    queryFn: () => api.reels.getComments(reelId, 1),
    enabled: visible,
  });

  const comments = commentsData?.comments || [];

  const { mutate: submitComment, isPending: isSubmitting } = useMutation({
    mutationFn: (content: string) => api.reels.comment(reelId, content),
    onSuccess: () => {
      setCommentText('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['reels'] });
    },
  });

  const handleSubmit = useCallback(() => {
    if (!commentText.trim()) return;
    submitComment(commentText.trim());
  }, [commentText, submitComment]);

  const getMediaUri = (uri: string | undefined) => {
    if (!uri) return '';
    return uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView
        style={[styles.commentsContainer, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.commentsHeader}>
          <Text style={styles.commentsTitle}>Comments</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.commentsLoading}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.commentsList}>
            {comments.length === 0 ? (
              <View style={styles.emptyComments}>
                <Text style={styles.emptyCommentsTitle}>No comments yet</Text>
              </View>
            ) : (
              comments.map((comment: CommentData) => (
                <View key={comment.id} style={styles.commentRow}>
                  <Image source={{ uri: getMediaUri(comment.user?.avatar) }} style={styles.commentAvatar} />
                  <View style={styles.commentBubble}>
                    <Text style={styles.commentAuthor}>{comment.user?.username || 'User'}</Text>
                    <Text style={styles.commentBody}>{comment.content}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}

        <View style={[styles.commentComposer, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            placeholderTextColor={Colors.textMuted}
            value={commentText}
            onChangeText={setCommentText}
          />
          <TouchableOpacity onPress={handleSubmit} disabled={!commentText.trim() || isSubmitting}>
            <Text style={styles.commentSendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// --- REEL ITEM COMPONENT ---

interface ReelItemProps {
  reel: Reel;
  isActive: boolean;
}

function ReelItem({ reel, isActive }: ReelItemProps) {
  const queryClient = useQueryClient();
  const videoRef = useRef<ExpoVideo>(null);
  const [isLiked, setIsLiked] = useState(reel.isLiked);
  const [likes, setLikes] = useState(reel.likes);
  const [isMuted, setIsMuted] = useState(false);
  
  // FIX: Channel Subscribe Logic
  const [isSubscribed, setIsSubscribed] = useState(false); // Default false, logic needs API data
  // Note: Assuming API sends is_subscribed for channels. If not, fallback to follow logic.
  
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // --- DATA MAPPING ---
  const getMediaUri = (uri: string | undefined) => uri ? (uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`) : '';
  
  // 1. Channel Info Priority
  const channelName = reel.channel?.name || reel.user?.channel_name || reel.user?.name || 'Channel';
  const channelAvatar = getMediaUri(reel.channel?.avatar || reel.user?.avatar || 'assets/c_profile.jpg');
  const channelId = reel.channel?.id || reel.user?.channel_id;

  const videoUrl = getMediaUri(reel.videoUrl || (reel as any).video_url);

  // --- EFFECTS ---
  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.playAsync();
    } else if (videoRef.current) {
      videoRef.current.pauseAsync();
    }
  }, [isActive]);

  // --- MUTATIONS ---
  const { mutate: likeReel } = useMutation({
    mutationFn: () => api.reels.like(reel.id),
    onSuccess: (data) => { setIsLiked(data.isLiked); setLikes(data.likes); }
  });

  const { mutate: unlikeReel } = useMutation({
    mutationFn: () => api.reels.unlike(reel.id),
    onSuccess: (data) => { setIsLiked(data.isLiked); setLikes(data.likes); }
  });

  const { mutate: subscribeChannel, isPending: isSubPending } = useMutation({
    mutationFn: () => channelId ? api.channels.subscribe(channelId) : Promise.reject('No Channel ID'),
    onSuccess: () => setIsSubscribed(true),
  });

  const handleLike = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    isLiked ? unlikeReel() : likeReel();
  }, [isLiked, likeReel, unlikeReel, scaleAnim]);

  const handleSubscribe = () => {
    if (!isSubscribed) subscribeChannel();
  };

  const handleTogglePlay = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
      setShowPlayIcon(true);
    } else {
      await videoRef.current.playAsync();
      setShowPlayIcon(false);
    }
  };

  const formatCount = (count: number | undefined | null) => {
    if (!count) return "0";
    const num = Number(count);
    if (isNaN(num)) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <View style={styles.reelContainer}>
      {/* 1. VIDEO PLAYER (Resizemode CONTAIN for 16:9) */}
      <Pressable style={styles.videoContainer} onPress={handleTogglePlay}>
        <ExpoVideo
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.reelVideo}
          resizeMode={ResizeMode.CONTAIN} // <-- FIX: Ensures 16:9 fits without crop
          isLooping
          shouldPlay={isActive}
          isMuted={isMuted}
          onPlaybackStatusUpdate={status => status.isLoaded && setIsPlaying(status.isPlaying)}
        />
        {showPlayIcon && !isPlaying && (
          <View style={styles.playIconOverlay}>
            <Play color="rgba(255,255,255,0.8)" size={60} fill="rgba(255,255,255,0.8)" />
          </View>
        )}
      </Pressable>

      {/* Mute Button (Top Right) */}
      <TouchableOpacity style={styles.muteButton} onPress={() => setIsMuted(!isMuted)}>
        {isMuted ? <VolumeX color="white" size={20} /> : <Volume2 color="white" size={20} />}
      </TouchableOpacity>

      {/* --- OVERLAY UI (Instagram Style) --- */}
      <View style={styles.uiOverlay}>
        
        {/* LEFT BOTTOM: Channel Info & Caption */}
        <View style={styles.leftColumn}>
          
          {/* Channel Row */}
          <View style={styles.channelRow}>
            <TouchableOpacity onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: reel.user.id } })}>
              <Image source={{ uri: channelAvatar }} style={styles.channelAvatar} />
            </TouchableOpacity>
            
            <Text style={styles.channelName} numberOfLines={1}>
              {channelName}
            </Text>

            {/* Subscribe Button (Small & Inline) */}
            {!isSubscribed && (
              <TouchableOpacity 
                style={styles.subscribeButton} 
                onPress={handleSubscribe}
                disabled={isSubPending}
              >
                <Text style={styles.subscribeText}>
                  {isSubPending ? '...' : 'Subscribe'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Caption */}
          <Text style={styles.caption} numberOfLines={2}>
            {reel.caption}
          </Text>

          {/* Music Tag */}
          {reel.music && (
            <View style={styles.musicRow}>
              <Music color="white" size={12} />
              <Text style={styles.musicText} numberOfLines={1}>
                {reel.music.title} · {reel.music.artist}
              </Text>
            </View>
          )}
        </View>

        {/* RIGHT BOTTOM: Actions (Like, Views, Comment, Share) */}
        <View style={styles.rightColumn}>
          
          {/* Like */}
          <View style={styles.actionItem}>
            <TouchableOpacity onPress={handleLike}>
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <Heart
                  color={isLiked ? Colors.error : "white"}
                  fill={isLiked ? Colors.error : 'transparent'}
                  size={32}
                />
              </Animated.View>
            </TouchableOpacity>
            <Text style={styles.actionText}>{formatCount(likes)}</Text>
          </View>

          {/* Views (Moved here as requested) */}
          <View style={styles.actionItem}>
             <Eye color="white" size={28} />
             <Text style={styles.actionText}>{formatCount(reel.views)}</Text>
          </View>

          {/* Comments */}
          <View style={styles.actionItem}>
            <TouchableOpacity onPress={() => setCommentsVisible(true)}>
              <MessageCircle color="white" size={30} />
            </TouchableOpacity>
            <Text style={styles.actionText}>{formatCount(reel.comments)}</Text>
          </View>

          {/* Share */}
          <View style={styles.actionItem}>
            <TouchableOpacity onPress={() => { /* Share Logic */ }}>
              <Share2 color="white" size={28} />
            </TouchableOpacity>
            <Text style={styles.actionText}>{formatCount(reel.shares)}</Text>
          </View>

          {/* Music Disc Animation */}
          <View style={styles.musicDisc}>
             <Image source={{ uri: channelAvatar }} style={styles.musicDiscImage} />
          </View>

        </View>
      </View>

      <CommentsSheet visible={commentsVisible} onClose={() => setCommentsVisible(false)} reelId={reel.id} />
    </View>
  );
}

// --- MAIN SCREEN ---

export default function ReelsScreen() {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: reelsData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['reels'],
    queryFn: async () => api.reels.getReels(1, 20),
  });

  const reels = reelsData?.reels || [];

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }, []);

  const renderReel = useCallback(
    ({ item, index }: { item: Reel; index: number }) => (
      <ReelItem reel={item} isActive={index === activeIndex} />
    ),
    [activeIndex]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>Reels</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : reels.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={{ color: 'white' }}>No reels available</Text>
        </View>
      ) : (
        <FlatList
          data={reels}
          keyExtractor={(item) => item.id}
          renderItem={renderReel}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={SCREEN_HEIGHT}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          removeClippedSubviews
          windowSize={5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  reelContainer: {
    height: SCREEN_HEIGHT,
    width: SCREEN_WIDTH,
    backgroundColor: 'black',
    position: 'relative',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center', // Centers 16:9 video vertically
  },
  reelVideo: {
    width: '100%',
    height: '100%',
  },
  playIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  muteButton: {
    position: 'absolute',
    top: 100, // Below header
    right: 20,
    zIndex: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 20,
  },
  
  // --- UI OVERLAY (Instagram Layout) ---
  uiOverlay: {
    position: 'absolute',
    bottom: 20, // Bottom padding like Instagram
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 15,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10, // Extra padding for tab bar
  },
  
  // Left Column (Channel Info)
  leftColumn: {
    flex: 1,
    marginRight: 60, // Space for right actions
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  channelAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'white',
    marginRight: 10,
  },
  channelName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'black',
    textShadowRadius: 3,
    maxWidth: 120, // Truncate limit
    marginRight: 10,
  },
  subscribeButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  subscribeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  caption: {
    color: 'white',
    fontSize: 14,
    marginBottom: 10,
    textShadowColor: 'black',
    textShadowRadius: 2,
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  musicText: {
    color: 'white',
    fontSize: 13,
    marginLeft: 6,
  },

  // Right Column (Actions)
  rightColumn: {
    alignItems: 'center',
    paddingBottom: 20, // Lift up slightly
    gap: 20,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'black',
    textShadowRadius: 2,
  },
  musicDisc: {
    marginTop: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#333',
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  musicDiscImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },

  // Comments Styles (Keep existing)
  commentsContainer: { flex: 1, backgroundColor: Colors.background },
  commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderColor: '#333' },
  commentsTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  closeButtonText: { color: Colors.primary },
  commentsLoading: { flex: 1, justifyContent: 'center' },
  commentsLoadingText: { textAlign: 'center', marginTop: 10, color: '#888' },
  commentsList: { padding: 15 },
  emptyComments: { padding: 30, alignItems: 'center' },
  emptyCommentsTitle: { color: '#888' },
  emptyCommentsSubtitle: { color: '#666', fontSize: 12 },
  commentRow: { flexDirection: 'row', marginBottom: 15 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  commentBubble: { flex: 1 },
  commentAuthor: { color: '#ccc', fontSize: 12, fontWeight: 'bold' },
  commentBody: { color: 'white', fontSize: 14 },
  commentComposer: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderColor: '#333' },
  commentInput: { flex: 1, backgroundColor: '#222', borderRadius: 20, paddingHorizontal: 15, color: 'white', marginRight: 10, height: 40 },
  commentSendButton: { justifyContent: 'center', paddingHorizontal: 10 },
  commentSendButtonDisabled: { opacity: 0.5 },
  commentSendText: { color: Colors.primary, fontWeight: 'bold' },
});
