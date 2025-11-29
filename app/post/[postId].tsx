import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  ArrowLeft,
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
  Dimensions,
  ActivityIndicator,
  Alert,
  TextInput,
  FlatList,
  Modal,
  Share as RNShare,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { api, MEDIA_BASE_URL } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

const { width } = Dimensions.get('window');

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
      queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
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
              <View style={styles.commentItem}>
                <Image
                  source={{ uri: item.user?.avatar || '' }}
                  style={styles.commentAvatar}
                />
                <View style={styles.commentContent}>
                  <Text style={styles.commentUsername}>
                    {item.user?.username || 'Unknown'}
                  </Text>
                  <Text style={styles.commentText}>{item.content}</Text>
                  <Text style={styles.commentTime}>
                    {item.created_at || item.timestamp || 'Just now'}
                  </Text>
                </View>
              </View>
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
                color={comment.trim() ? Colors.primary : Colors.textMuted}
                size={20}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likes, setLikes] = useState(0);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);

  const { data: postData, isLoading, isError } = useQuery({
    queryKey: ['post-detail', postId],
    queryFn: () => api.posts.getPost(postId!),
    enabled: !!postId,
  });

  const likeMutation = useMutation({
    mutationFn: (postId: string) => api.posts.like(postId),
    onSuccess: (data) => {
      setIsLiked(data.isLiked);
      setLikes(data.likes);
      queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: (postId: string) => api.posts.unlike(postId),
    onSuccess: (data) => {
      setIsLiked(data.isLiked);
      setLikes(data.likes);
      queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => api.posts.delete(postId),
    onSuccess: () => {
      Alert.alert('Success', 'Post deleted successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to delete post');
    },
  });

  const shareMutation = useMutation({
    mutationFn: (postId: string) => api.posts.share(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-detail', postId] });
    },
  });

  const handleLike = () => {
    if (!postId) return;
    if (isLiked) {
      unlikeMutation.mutate(postId);
    } else {
      likeMutation.mutate(postId);
    }
  };

  const handleShare = async () => {
    if (!postId) return;
    try {
      const shareUrl = `https://moviedbr.com/posts/${postId}`;
      shareMutation.mutate(postId);

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
    if (!post) return;
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
                    onPress: () => deleteMutation.mutate(postId!),
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
                        onPress: () => deleteMutation.mutate(postId!),
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

  const getImageUri = (uri: string) => {
    if (!uri) return '';
    return uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`;
  };

  const post = postData?.post;

  React.useEffect(() => {
    if (post) {
      setIsLiked(post.isLiked || post.is_liked || false);
      setLikes(post.likes || 0);
    }
  }, [post]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Post',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                <ArrowLeft color={Colors.text} size={24} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading post...</Text>
        </View>
      </View>
    );
  }

  if (isError || !post) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Post',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                <ArrowLeft color={Colors.text} size={24} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load post</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => queryClient.invalidateQueries({ queryKey: ['post-detail', postId] })}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Post',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <ArrowLeft color={Colors.text} size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={styles.postUserInfo}
            onPress={() =>
              router.push({
                pathname: '/user/[userId]',
                params: { userId: post.user.id },
              })
            }
          >
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
          </TouchableOpacity>
          <TouchableOpacity onPress={showPostActions}>
            <MoreHorizontal color={Colors.text} size={24} />
          </TouchableOpacity>
        </View>

        {post.type === 'text' && (
          <Text style={styles.postTextContent}>{post.content}</Text>
        )}

        {post.images && post.images.length > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.postImagesContainer}
          >
            {post.images.map((image: string, index: number) => (
              <Image
                key={index}
                source={{ uri: getImageUri(image) }}
                style={styles.postImage}
                contentFit="cover"
              />
            ))}
          </ScrollView>
        )}

        {post.type === 'video' && post.thumbnailUrl && (
          <View style={styles.videoContainer}>
            <Image
              source={{ uri: getImageUri(post.thumbnailUrl) }}
              style={styles.postImage}
              contentFit="cover"
            />
          </View>
        )}

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
          {post.content && (
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
          <Text style={styles.postTime}>{post.timestamp || post.created_at}</Text>
        </View>
      </ScrollView>

      <CommentsModal
        visible={commentsModalVisible}
        onClose={() => setCommentsModalVisible(false)}
        postId={postId!}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
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
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    paddingVertical: 16,
  },
  postImagesContainer: {
    marginBottom: 8,
  },
  postImage: {
    width: width,
    height: width * 1.25,
    backgroundColor: Colors.surface,
  },
  videoContainer: {
    marginBottom: 8,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
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
    paddingTop: 8,
    paddingBottom: 16,
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
