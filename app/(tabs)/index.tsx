import { Image } from 'expo-image'; 
import { router } from 'expo-router';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Search,
  Bell,
  MessageSquare,
  Send,
  X,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Share as RNShare,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// 🔥 IMPORT StoryBar from the new location (Components/StoryBar.tsx)
import StoryBar from '@/components/StoryBar';
import Colors from '@/constants/colors';
import { formatTimeAgo } from '@/constants/timeFormat';
import { useAuth } from '@/contexts/AuthContext';
import { api, MEDIA_BASE_URL } from '@/services/api';
import { Post } from '@/types';

const { width } = Dimensions.get('window');

// ----------------------------------------------------------------
// CommentsModal Component (Tightly coupled with PostItem)
// ----------------------------------------------------------------

function CommentsModal({
  visible,
  onClose,
  postId,
}: {
  visible: boolean;
  onClose: () => void;
  postId: string;
}) {
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();

  const { data: commentsData, isLoading } = useQuery({
    queryKey: ['post-comments', postId],
    queryFn: () => api.posts.getComments(postId, 1),
    enabled: visible,
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => api.posts.comment(postId, content),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed-for-you'] });
      queryClient.invalidateQueries({ queryKey: ['feed-following'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to post comment');
    },
  });

  const handleSubmit = () => {
    if (!comment.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }
    commentMutation.mutate(comment);
  };

  const comments = commentsData?.comments || [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Comments</Text>
          <TouchableOpacity onPress={onClose}>
            <X color={Colors.text} size={24} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.modalLoadingContainer}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.commentItem}
                onPress={() => {
                  if (item.user?.id) {
                    onClose();
                    router.push({
                      pathname: '/user/[userId]',
                      params: { userId: item.user.id },
                    });
                  }
                }}
              >
                <Image
                  source={{
                    uri: item.user?.avatar
                      ? item.user.avatar.startsWith('http')
                        ? item.user.avatar
                        : `${MEDIA_BASE_URL}/${item.user.avatar}`
                      : '',
                  }}
                  style={styles.commentAvatar}
                />
                <View style={styles.commentContent}>
                  <Text style={styles.commentUsername}>
                    {item.user?.username || 'Unknown'}
                  </Text>
                  <Text style={styles.commentText}>{item.content}</Text>
                  <Text style={styles.commentTime}>
                    {formatTimeAgo(item.created_at || item.timestamp)}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.commentsList}
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                <Text style={styles.emptyCommentsText}>No comments yet</Text>
              </View>
            }
          />
        )}

        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            placeholderTextColor={Colors.textMuted}
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!comment.trim() || commentMutation.isPending) &&
                styles.sendButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!comment.trim() || commentMutation.isPending}
          >
            {commentMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Send
                color={
                  comment.trim() ? Colors.primary : Colors.textMuted
                }
                size={20}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ----------------------------------------------------------------
// PostItem Component (Tightly coupled with Home Feed)
// ----------------------------------------------------------------

function PostItem({ post }: { post: Post }) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [isSaved, setIsSaved] = useState(post.isSaved);
  const [likes, setLikes] = useState(post.likes);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [isFollowing, setIsFollowing] = useState(
    Boolean((post.user as any)?.is_following ?? (post.user as any)?.isFollowing ?? false)
  );

  const likeMutation = useMutation({
    mutationFn: (postId: string) => api.posts.like(postId),
    onSuccess: (data) => {
      setIsLiked(data.isLiked);
      setLikes(data.likes);
      queryClient.invalidateQueries({ queryKey: ['feed-for-you'] });
      queryClient.invalidateQueries({ queryKey: ['feed-following'] });
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: (postId: string) => api.posts.unlike(postId),
    onSuccess: (data) => {
      setIsLiked(data.isLiked);
      setLikes(data.likes);
      queryClient.invalidateQueries({ queryKey: ['feed-for-you'] });
      queryClient.invalidateQueries({ queryKey: ['feed-following'] });
    },
  });

  const followMutation = useMutation({
    mutationFn: (userId: string) => api.users.follow(userId),
    onSuccess: (data) => {
      setIsFollowing(data.isFollowing);
      queryClient.invalidateQueries({ queryKey: ['feed-for-you'] });
      queryClient.invalidateQueries({ queryKey: ['feed-following'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to follow user');
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: (userId: string) => api.users.unfollow(userId),
    onSuccess: (data) => {
      setIsFollowing(data.isFollowing);
      queryClient.invalidateQueries({ queryKey: ['feed-for-you'] });
      queryClient.invalidateQueries({ queryKey: ['feed-following'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to unfollow user');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => api.posts.delete(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-for-you'] });
      queryClient.invalidateQueries({ queryKey: ['feed-following'] });
      Alert.alert('Success', 'Post deleted successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to delete post');
    },
  });

  const shareMutation = useMutation({
    mutationFn: (postId: string) => api.posts.share(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-for-you'] });
      queryClient.invalidateQueries({ queryKey: ['feed-following'] });
    },
  });

  const handleLike = () => {
    if (isLiked) {
      unlikeMutation.mutate(post.id);
    } else {
      likeMutation.mutate(post.id);
    }
  };

  const handleFollow = () => {
    if (isFollowing) {
      unfollowMutation.mutate(post.user.id);
    } else {
      followMutation.mutate(post.user.id);
    }
  };

  const handleShare = async () => {
    try {
      const shareUrl = `https://moviedbr.com/posts/${post.id}`;
      shareMutation.mutate(post.id);

      await RNShare.share({
        message: `Check out this post: ${shareUrl}`,
        url: shareUrl,
      });
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        console.error('Share error:', error);
      }
    }
  };

  const showPostActions = () => {
    const isOwnPost = currentUser?.id === post.user.id;

    const options = isOwnPost
      ? ['Delete', 'Cancel']
      : ['Report', 'Mute', 'Cancel'];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex: 0,
          cancelButtonIndex: options.length - 1,
        },
        (buttonIndex) => {
          if (isOwnPost) {
            if (buttonIndex === 0) {
              Alert.alert(
                'Delete Post',
                'Are you sure you want to delete this post?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteMutation.mutate(post.id),
                  },
                ]
              );
            }
          } else {
            if (buttonIndex === 0) {
              Alert.alert('Report', 'Report functionality coming soon');
            } else if (buttonIndex === 1) {
              Alert.alert('Mute', 'Mute functionality coming soon');
            }
          }
        }
      );
    } else {
      Alert.alert(
        'Post Actions',
        'Choose an action',
        isOwnPost
          ? [
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  Alert.alert(
                    'Delete Post',
                    'Are you sure you want to delete this post?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => deleteMutation.mutate(post.id),
                      },
                    ]
                  );
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          : [
              {
                text: 'Report',
                onPress: () =>
                  Alert.alert('Report', 'Report functionality coming soon'),
              },
              {
                text: 'Mute',
                onPress: () =>
                  Alert.alert('Mute', 'Mute functionality coming soon'),
              },
              { text: 'Cancel', style: 'cancel' },
            ]
      );
    }
  };

  const handleUserPress = () => {
    router.push({ pathname: '/user/[userId]', params: { userId: post.user.id } });
  };
  
  // Reels/Videos are handled in separate tabs, so no tap logic needed here

  const getImageUri = (uri: string) => {
    if (!uri) return '';
    return uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`;
  };

  return (
    <View style={styles.postContainer}>
      <View style={styles.postHeader}>
        <TouchableOpacity style={styles.postUserInfo} onPress={handleUserPress}>
          <Image 
            source={{ uri: getImageUri(post.user.avatar) }} 
            style={styles.postAvatar} 
          />
          <View style={styles.postUserDetails}>
            <View style={styles.userNameRow}>
              <Text style={styles.postUsername}>{post.user.username}</Text>
              {post.user.isVerified && (
                <Text style={styles.verifiedBadge}>✓</Text>
              )}
            </View>
            {post.location && (
              <Text style={styles.postLocation}>{post.location}</Text>
            )}
          </View>
          {currentUser?.id !== post.user.id && (
            <TouchableOpacity
              style={[
                styles.followButtonSmall,
                isFollowing && styles.followingButtonSmall,
              ]}
              onPress={handleFollow}
              disabled={followMutation.isPending || unfollowMutation.isPending}
            >
              <Text style={[
                styles.followButtonSmallText,
                isFollowing && styles.followingButtonSmallText,
              ]}>
                {followMutation.isPending || unfollowMutation.isPending
                  ? '...'
                  : isFollowing
                    ? 'Following'
                    : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={showPostActions}>
          <MoreHorizontal color={Colors.text} size={24} />
        </TouchableOpacity>
      </View>

      {/* Post Type: TEXT */}
      {post.type === 'text' && post.content && (
        <Text style={styles.postTextContent}>{post.content}</Text>
      )}

      {/* Post Type: PHOTO (Image Carousel/Single Image) */}
      {post.images && post.images.length > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.postImagesContainer}
        >
          {post.images.map((image, index) => (
            <Image
              key={index}
              source={{ uri: getImageUri(image) }}
              style={styles.postImage}
              contentFit="cover"
            />
          ))}
        </ScrollView>
      )}
      
      {/* Short/Video content rendering logic removed as per user request */}

      <View style={styles.postActions}>
        <View style={styles.postActionsLeft}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handleLike}
            disabled={likeMutation.isPending || unlikeMutation.isPending}
          >
            <Heart
              color={isLiked ? Colors.primary : Colors.text}
              fill={isLiked ? Colors.primary : 'transparent'}
              size={26}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setCommentsModalVisible(true)}
          >
            <MessageCircle color={Colors.text} size={26} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Share2 color={Colors.text} size={24} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setIsSaved(!isSaved)}>
          <Bookmark
            color={isSaved ? Colors.primary : Colors.text}
            fill={isSaved ? Colors.primary : 'transparent'}
            size={24}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.postStats}>
        <Text style={styles.likesText}>{likes.toLocaleString()} likes</Text>
        
        {/* Post Caption for Text/Photo (Showing caption if content exists) */}
        {(post.type === 'photo' || post.type === 'text') &&
          post.content && (
            <Text style={styles.postCaption}>
              <Text style={styles.postCaptionUsername}>
                {post.user.username}{' '}
              </Text>
              {post.content}
            </Text>
          )}
          
        {post.comments > 0 && (
          <TouchableOpacity onPress={() => setCommentsModalVisible(true)}>
            <Text style={styles.viewComments}>
              View all {post.comments} comments
            </Text>
          </TouchableOpacity>
        )}
        <Text style={styles.postTime}>
          {formatTimeAgo(post.created_at || post.timestamp)}
        </Text>
      </View>

      <CommentsModal
        visible={commentsModalVisible}
        onClose={() => setCommentsModalVisible(false)}
        postId={post.id}
      />
    </View>
  );
}

// ----------------------------------------------------------------
// HomeScreen Component (Main Export)
// ----------------------------------------------------------------

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'for-you' | 'following'>('for-you');

  // useQuery for For You Feed
  const { 
    data: forYouData, 
    isLoading: isLoadingForYou, 
    isError: isErrorForYou,
    refetch: refetchForYou,
    isRefetching: isRefetchingForYou,
  } = useQuery({
    queryKey: ['feed-for-you'],
    queryFn: () => api.home.getFeed(1, 10, 'for-you'),
    enabled: isAuthenticated && activeTab === 'for-you',
  });

  // useQuery for Following Feed
  const { 
    data: followingData, 
    isLoading: isLoadingFollowing, 
    isError: isErrorFollowing,
    refetch: refetchFollowing,
    isRefetching: isRefetchingFollowing,
  } = useQuery({
    queryKey: ['feed-following'],
    queryFn: () => api.home.getFeed(1, 10, 'following'),
    enabled: isAuthenticated && activeTab === 'following',
  });

  const isLoading = activeTab === 'for-you' ? isLoadingForYou : isLoadingFollowing;
  const isError = activeTab === 'for-you' ? isErrorForYou : isErrorFollowing;
  const isRefetching = activeTab === 'for-you' ? isRefetchingForYou : isRefetchingFollowing;
  const refetch = activeTab === 'for-you' ? refetchForYou : refetchFollowing;
  
  const feedData = activeTab === 'for-you' ? forYouData : followingData;
  const allFeedItems = feedData?.posts || [];

  // 🔥 FINAL FILTER: केवल 'text' और 'photo' types को होम फीड में रखें
  const posts = allFeedItems.filter(item => 
    item.type === 'text' || item.type === 'photo'
  ); 

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.logo}>SocialHub</Text>
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.notAuthText}>Please log in to see your feed</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.loginButtonText}>Log In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.logo}>SocialHub</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.push('/search')}
          >
            <Search color={Colors.text} size={24} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.push('/notifications')}
          >
            <Bell color={Colors.text} size={24} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.push('/messages')}
          >
            <MessageSquare color={Colors.text} size={24} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'for-you' && styles.tabButtonActive]}
          onPress={() => setActiveTab('for-you')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'for-you' && styles.tabButtonTextActive]}>
            For You
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'following' && styles.tabButtonActive]}
          onPress={() => setActiveTab('following')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'following' && styles.tabButtonTextActive]}>
            Following
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading your feed...</Text>
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load feed</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PostItem post={item} />}
          ListHeaderComponent={StoryBar}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.feedContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {activeTab === 'following'
                    ? 'Follow users to see their latest posts here.'
                    : 'No viral posts found for you.'
                }
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ----------------------------------------------------------------
// Styles
// ----------------------------------------------------------------

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
  logo: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 16,
  },
  headerIcon: {
    padding: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: Colors.primary,
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabButtonTextActive: {
    color: Colors.text,
  },
  feedContent: {
    paddingBottom: 20,
  },
  postContainer: {
    marginTop: 16,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  postUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  postUserDetails: {
    flex: 1,
  },
  postAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postUsername: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  verifiedBadge: {
    color: Colors.info,
    fontSize: 14,
  },
  postLocation: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  postTextContent: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  postImagesContainer: {
    marginBottom: 8,
  },
  postImage: {
    width: width,
    height: width * 1.25,
    backgroundColor: Colors.surface,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  postActionsLeft: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    padding: 4,
  },
  postStats: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  likesText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 6,
  },
  postCaption: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
  },
  postCaptionUsername: {
    fontWeight: '600' as const,
  },
  viewComments: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 4,
  },
  postTime: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  notAuthText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
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
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  followButtonSmall: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingButtonSmall: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followButtonSmallText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  followingButtonSmallText: {
    color: Colors.textSecondary,
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
  modalLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsList: {
    padding: 16,
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
  },
  commentContent: {
    flex: 1,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 18,
    marginBottom: 4,
  },
  commentTime: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  emptyComments: {
    padding: 48,
    alignItems: 'center',
  },
  emptyCommentsText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
