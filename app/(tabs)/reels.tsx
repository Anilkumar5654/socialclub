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
      console.log('[ReelComments] Comment added');
      setCommentText('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['reels'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to post comment';
      Alert.alert('Error', message);
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
      testID="comments-modal"
    >
      <KeyboardAvoidingView
        style={[styles.commentsContainer, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.commentsHeader}>
          <Text style={styles.commentsTitle}>Comments</Text>
          <TouchableOpacity onPress={onClose} testID="close-comments">
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.commentsLoading}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.commentsLoadingText}>Loading comments...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.commentsList}>
            {comments.length === 0 ? (
              <View style={styles.emptyComments}>
                <Text style={styles.emptyCommentsTitle}>No comments yet</Text>
                <Text style={styles.emptyCommentsSubtitle}>Be the first to comment</Text>
              </View>
            ) : (
              comments.map((comment: CommentData) => (
                <TouchableOpacity
                  key={comment.id}
                  style={styles.commentRow}
                  onPress={() => {
                    if (comment.user?.id) {
                      onClose();
                      router.push({ pathname: '/user/[userId]', params: { userId: comment.user.id } });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ uri: getMediaUri(comment.user?.avatar) }}
                    style={styles.commentAvatar}
                  />
                  <View style={styles.commentBubble}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>{comment.user?.username || 'User'}</Text>
                      <Text style={styles.commentTimestamp}>
                        {formatTimeAgo(comment.created_at || comment.timestamp)}
                      </Text>
                    </View>
                    <Text style={styles.commentBody}>{comment.content}</Text>
                  </View>
                </TouchableOpacity>
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
            editable={!isSubmitting}
            testID="comment-input"
          />
          <TouchableOpacity
            style={[
              styles.commentSendButton,
              (!commentText.trim() || isSubmitting) && styles.commentSendButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!commentText.trim() || isSubmitting}
            testID="comment-submit"
          >
            {isSubmitting ? (
              <ActivityIndicator color={Colors.text} size="small" />
            ) : (
              <Text style={styles.commentSendText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface ReelItemProps {
  reel: Reel;
  isActive: boolean;
}

function ReelItem({ reel, isActive }: ReelItemProps) {
  const queryClient = useQueryClient();
  const videoRef = useRef<ExpoVideo>(null);
  const [isLiked, setIsLiked] = useState(reel.isLiked);
  const [isSaved, setIsSaved] = useState(false);
  const [likes, setLikes] = useState(reel.likes);
  const [isMuted, setIsMuted] = useState(false);
  const [isFollowing, setIsFollowing] = useState(
    Boolean((reel.user as { is_following?: boolean; isFollowing?: boolean })?.is_following ?? 
            (reel.user as { is_following?: boolean; isFollowing?: boolean })?.isFollowing ?? false)
  );
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.playAsync();
    } else if (videoRef.current) {
      videoRef.current.pauseAsync();
    }
  }, [isActive]);

  const { mutate: likeReel } = useMutation({
    mutationFn: () => api.reels.like(reel.id),
    onSuccess: (data) => {
      setIsLiked(data.isLiked);
      setLikes(data.likes);
      queryClient.invalidateQueries({ queryKey: ['reels'] });
    },
  });

  const { mutate: unlikeReel } = useMutation({
    mutationFn: () => api.reels.unlike(reel.id),
    onSuccess: (data) => {
      setIsLiked(data.isLiked);
      setLikes(data.likes);
      queryClient.invalidateQueries({ queryKey: ['reels'] });
    },
  });

  const { mutate: followUser, isPending: isFollowPending } = useMutation({
    mutationFn: () => api.users.follow(reel.user.id),
    onSuccess: (data) => {
      setIsFollowing(data.isFollowing);
      queryClient.invalidateQueries({ queryKey: ['reels'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to follow';
      Alert.alert('Error', message);
    },
  });

  const { mutate: unfollowUser, isPending: isUnfollowPending } = useMutation({
    mutationFn: () => api.users.unfollow(reel.user.id),
    onSuccess: (data) => {
      setIsFollowing(data.isFollowing);
      queryClient.invalidateQueries({ queryKey: ['reels'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to unfollow';
      Alert.alert('Error', message);
    },
  });

  const handleLike = useCallback(() => {
    console.log('[Reel] Like pressed:', reel.id);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    if (isLiked) {
      unlikeReel();
    } else {
      likeReel();
    }
  }, [isLiked, likeReel, unlikeReel, reel.id, scaleAnim]);

  const handleFollow = useCallback(() => {
    if (isFollowing) {
      unfollowUser();
    } else {
      followUser();
    }
  }, [isFollowing, followUser, unfollowUser]);

  const handleShare = useCallback(async () => {
    const shareUrl = `https://www.moviedbr.com/reels/${reel.id}`;
    
    if (Platform.OS === 'ios') {
      try {
        await RNShare.share({ message: `Check out this reel: ${shareUrl}`, url: shareUrl });
        api.reels.share(reel.id).catch(() => {});
      } catch {
        console.log('[Reel] Share cancelled');
      }
    } else {
      Alert.alert('Share reel', 'Choose an option', [
        {
          text: 'Share',
          onPress: async () => {
            try {
              await RNShare.share({ message: `Check out this reel: ${shareUrl}` });
              api.reels.share(reel.id).catch(() => {});
            } catch {
              console.log('[Reel] Share cancelled');
            }
          },
        },
        {
          text: 'Copy link',
          onPress: async () => {
            try {
              await Clipboard.setStringAsync(shareUrl);
              Alert.alert('Link copied', 'Reel link copied to clipboard');
            } catch {
              Alert.alert('Error', 'Unable to copy link');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [reel.id]);

  const handleTogglePlay = useCallback(async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
      setShowPlayIcon(true);
    } else {
      await videoRef.current.playAsync();
      setShowPlayIcon(false);
    }
  }, [isPlaying]);

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
    }
  }, []);

  const getMediaUri = (uri: string) => {
    if (!uri) return '';
    return uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`;
  };

  // --- FIX APPLIED HERE (CRASH FIXED) ---
  const formatCount = (count: number | undefined | null) => {
    if (count === undefined || count === null) return "0";
    
    const num = Number(count);
    if (isNaN(num)) return "0";

    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    
    return num.toString();
  };

  const videoUrl = getMediaUri(reel.videoUrl || (reel as { video_url?: string }).video_url || '');

  return (
    <View style={styles.reelContainer} testID={`reel-${reel.id}`}>
      <Pressable style={styles.videoContainer} onPress={handleTogglePlay}>
        <ExpoVideo
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.reelVideo}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay={isActive}
          isMuted={isMuted}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          onError={(error) => console.error('[Reel] Video error:', error)}
        />
        
        {showPlayIcon && !isPlaying && (
          <View style={styles.playIconOverlay}>
            <Play color={Colors.text} size={60} fill={Colors.text} />
          </View>
        )}
      </Pressable>

      <View style={styles.muteButton}>
        <TouchableOpacity
          style={styles.muteButtonInner}
          onPress={() => setIsMuted(!isMuted)}
          testID={`mute-${reel.id}`}
        >
          {isMuted ? (
            <VolumeX color={Colors.text} size={20} />
          ) : (
            <Volume2 color={Colors.text} size={20} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.reelOverlay} />

      <View style={styles.reelContent}>
        <View style={styles.reelInfo}>
          <TouchableOpacity
            style={styles.userInfoRow}
            onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: reel.user.id } })}
            activeOpacity={0.8}
            testID={`reel-user-${reel.user.id}`}
          >
            <Image source={{ uri: getMediaUri(reel.user.avatar) }} style={styles.userAvatar} />
            <View style={styles.userMeta}>
              <Text style={styles.username}>{reel.user.username}</Text>
              <Text style={styles.viewCount}>
                {formatCount(reel.views)} views · {formatTimeAgo((reel as { created_at?: string }).created_at)}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.followButton, isFollowing && styles.followingButton]}
            onPress={handleFollow}
            disabled={isFollowPending || isUnfollowPending}
            testID={`follow-${reel.user.id}`}
          >
            <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
              {isFollowPending || isUnfollowPending ? '...' : isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.caption} numberOfLines={3}>{reel.caption}</Text>

          {reel.music && (
            <TouchableOpacity style={styles.musicRow} testID={`music-${reel.id}`}>
              <Music color={Colors.text} size={14} />
              <Text style={styles.musicText} numberOfLines={1}>
                {reel.music.title} · {reel.music.artist}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.actionsColumn}>
          <TouchableOpacity style={styles.actionItem} onPress={handleLike} testID={`like-${reel.id}`}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Heart
                color={isLiked ? Colors.error : Colors.text}
                fill={isLiked ? Colors.error : 'transparent'}
                size={30}
              />
            </Animated.View>
            <Text style={styles.actionCount}>{formatCount(likes)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => setCommentsVisible(true)}
            testID={`comment-${reel.id}`}
          >
            <MessageCircle color={Colors.text} size={30} />
            <Text style={styles.actionCount}>{formatCount(reel.comments)}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={handleShare} testID={`share-${reel.id}`}>
            <Share2 color={Colors.text} size={28} />
            <Text style={styles.actionCount}>{formatCount(reel.shares)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => setIsSaved(!isSaved)}
            testID={`save-${reel.id}`}
          >
            <Bookmark color={Colors.text} fill={isSaved ? Colors.text : 'transparent'} size={28} />
          </TouchableOpacity>

          {reel.music && (
            <View style={styles.musicDisc}>
              <Image source={{ uri: getMediaUri(reel.user.avatar) }} style={styles.musicDiscImage} />
            </View>
          )}
        </View>
      </View>

      <CommentsSheet visible={commentsVisible} onClose={() => setCommentsVisible(false)} reelId={reel.id} />
    </View>
  );
}

export default function ReelsScreen() {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: reelsData, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['reels'],
    queryFn: async () => {
      console.log('[Reels] Fetching reels');
      const response = await api.reels.getReels(1, 20);
      console.log('[Reels] Received', response.reels?.length || 0, 'reels');
      return response;
    },
  });

  const reels = reelsData?.reels || [];

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const renderReel = useCallback(
    ({ item, index }: { item: Reel; index: number }) => (
      <ReelItem reel={item} isActive={index === activeIndex} />
    ),
    [activeIndex]
  );

  const keyExtractor = useCallback((item: Reel) => item.id, []);

  return (
    <View style={styles.container} testID="reels-screen">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Reels</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading reels...</Text>
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to load reels</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? (
              <ActivityIndicator size="small" color={Colors.text} />
            ) : (
              <Text style={styles.retryButtonText}>Try again</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : reels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No reels available</Text>
        </View>
      ) : (
        <FlatList
          data={reels}
          keyExtractor={keyExtractor}
          renderItem={renderReel}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={SCREEN_HEIGHT}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          removeClippedSubviews
          maxToRenderPerBatch={3}
          windowSize={5}
          testID="reels-list"
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 140,
    alignItems: 'center',
  },
  retryButtonText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  reelContainer: {
    height: SCREEN_HEIGHT,
    width: SCREEN_WIDTH,
    position: 'relative',
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
  },
  reelVideo: {
    width: '100%',
    height: '100%',
  },
  playIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  muteButton: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 5,
  },
  muteButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    pointerEvents: 'none',
  },
  reelContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  reelInfo: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 100,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.text,
  },
  userMeta: {
    flex: 1,
  },
  username: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  viewCount: {
    color: Colors.text,
    fontSize: 13,
    opacity: 0.85,
  },
  followButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    marginBottom: 12,
  },
  followingButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: Colors.text,
  },
  followButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  followingButtonText: {
    color: Colors.text,
  },
  caption: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  musicText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
    flex: 1,
  },
  actionsColumn: {
    paddingBottom: 100,
    paddingRight: 12,
    alignItems: 'center',
    gap: 20,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionCount: {
    color: Colors.text,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '700' as const,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  musicDisc: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.text,
    marginTop: 8,
  },
  musicDiscImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  commentsContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  closeButtonText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  commentsLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  commentsLoadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  commentsList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '700' as const,
  },
  commentTimestamp: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  commentBody: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 18,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 6,
  },
  emptyCommentsTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  emptyCommentsSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  commentComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  commentInput: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
  },
  commentSendButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    minWidth: 70,
    alignItems: 'center',
  },
  commentSendButtonDisabled: {
    opacity: 0.5,
  },
  commentSendText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
  },
});
