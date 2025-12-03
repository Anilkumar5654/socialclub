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
  ShieldAlert,
  Trash2,
  ChevronRight,
  Flag
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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import StoryBar from '@/components/StoryBar';
import Colors from '@/constants/colors';
import { formatTimeAgo } from '@/constants/timeFormat';
import { useAuth } from '@/contexts/AuthContext';
import { api, MEDIA_BASE_URL } from '@/services/api';
import { Post } from '@/types';

const { width } = Dimensions.get('window');

// ----------------------------------------------------------------
// 1. PostOptionsModal (New Custom Menu UI)
// ----------------------------------------------------------------
function PostOptionsModal({
  visible,
  onClose,
  isOwnPost,
  onDelete,
  onReport,
}: {
  visible: boolean;
  onClose: () => void;
  isOwnPost: boolean;
  onDelete: () => void;
  onReport: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContentContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Post Options</Text>
            <TouchableOpacity onPress={onClose}>
              <X color={Colors.text} size={24} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalBody}>
            {isOwnPost ? (
              <TouchableOpacity style={styles.modalOptionItem} onPress={() => { onClose(); onDelete(); }}>
                <View style={styles.optionRow}>
                  <Trash2 size={20} color={Colors.error} />
                  <Text style={[styles.modalOptionText, { color: Colors.error }]}>Delete Post</Text>
                </View>
                <ChevronRight size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.modalOptionItem} onPress={() => { onClose(); onReport(); }}>
                <View style={styles.optionRow}>
                  <Flag size={20} color={Colors.text} />
                  <Text style={styles.modalOptionText}>Report Post</Text>
                </View>
                <ChevronRight size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ----------------------------------------------------------------
// 2. ReportModal Component
// ----------------------------------------------------------------
function ReportModal({
  visible,
  onClose,
  postId,
}: {
  visible: boolean;
  onClose: () => void;
  postId: string;
}) {
  const [description, setDescription] = useState('');
  
  const reportReasons = [
    'Spam or Scam',
    'Inappropriate Content',
    'Harassment or Bullying',
    'Violence',
    'False Information',
    'Other'
  ];

  const reportMutation = useMutation({
    mutationFn: (data: { reason: string; desc: string }) => 
      api.posts.report(postId, data.reason, data.desc),
    onSuccess: () => {
      Alert.alert('Report Submitted', 'Thank you for reporting. We will review this post.');
      onClose();
      setDescription('');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to submit report');
    },
  });

  const handleReport = (reason: string) => {
    reportMutation.mutate({ reason, desc: description });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContentContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Report Reason</Text>
            <TouchableOpacity onPress={onClose}>
              <X color={Colors.text} size={24} />
            </TouchableOpacity>
          </View>
          
          {reportMutation.isPending ? (
            <View style={styles.modalLoadingContainer}>
              <ActivityIndicator color={Colors.primary} size="large" />
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 400 }}>
              {reportReasons.map((reason, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.modalOptionItem}
                  onPress={() => handleReport(reason)}
                >
                  <Text style={styles.modalOptionText}>{reason}</Text>
                  <ChevronRight size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ----------------------------------------------------------------
// 3. CommentsModal Component (With Delete Icon)
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
  const { user: currentUser } = useAuth();
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
    onError: (error: any) => Alert.alert('Error', error.message),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.posts.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed-for-you'] });
      queryClient.invalidateQueries({ queryKey: ['feed-following'] });
    },
    onError: (error: any) => Alert.alert('Error', error.message),
  });

  const handleDelete = (commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCommentMutation.mutate(commentId) }
    ]);
  };

  const comments = commentsData?.comments || [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.fullScreenModalContainer}>
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
            contentContainerStyle={styles.commentsList}
            renderItem={({ item }) => {
              // Logic to check ownership (Safe string comparison)
              const isOwner = String(currentUser?.id) === String(item.user_id) || 
                              String(currentUser?.id) === String(item.user?.id);
              
              return (
                <View style={styles.commentItem}>
                  <Image source={{ uri: item.user?.avatar ? (item.user.avatar.startsWith('http') ? item.user.avatar : `${MEDIA_BASE_URL}/${item.user.avatar}`) : '' }} style={styles.commentAvatar} />
                  <View style={styles.commentContent}>
                    <View style={styles.commentHeaderRow}>
                      <Text style={styles.commentUsername}>{item.user?.username || 'Unknown'}</Text>
                      <Text style={styles.commentTime}>{formatTimeAgo(item.created_at || item.timestamp)}</Text>
                    </View>
                    <Text style={styles.commentText}>{item.content}</Text>
                  </View>
                  
                  {/* DELETE ICON (Only visible to owner) */}
                  {isOwner && (
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteIconContainer}>
                      <Trash2 size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
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
            style={[styles.sendButton, (!comment.trim() || commentMutation.isPending) && styles.sendButtonDisabled]}
            onPress={() => comment.trim() && commentMutation.mutate(comment)}
            disabled={!comment.trim() || commentMutation.isPending}
          >
            {commentMutation.isPending ? <ActivityIndicator size="small" color={Colors.primary} /> : <Send color={comment.trim() ? Colors.primary : Colors.textMuted} size={20} />}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ----------------------------------------------------------------
// 4. PostItem Component
// ----------------------------------------------------------------
function PostItem({ post }: { post: Post }) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [isSaved, setIsSaved] = useState(post.isSaved);
  const [likes, setLikes] = useState(post.likes);
  
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  
  const [isFollowing, setIsFollowing] = useState(Boolean((post.user as any)?.is_following));

  // Mutations
  const likeMutation = useMutation({
    mutationFn: () => isLiked ? api.posts.unlike(post.id) : api.posts.like(post.id),
    onSuccess: (data) => { setIsLiked(data.isLiked); setLikes(data.likes); }
  });

  const followMutation = useMutation({
    mutationFn: () => isFollowing ? api.users.unfollow(post.user.id) : api.users.follow(post.user.id),
    onSuccess: (data) => setIsFollowing(data.isFollowing)
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.posts.delete(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-for-you'] });
      queryClient.invalidateQueries({ queryKey: ['feed-following'] });
      Alert.alert('Success', 'Post deleted.');
    },
    onError: (err: any) => Alert.alert('Error', err.message)
  });

  const shareMutation = useMutation({ mutationFn: () => api.posts.share(post.id) });

  const handleShare = async () => {
    const url = `https://socialclub.com/posts/${post.id}`;
    shareMutation.mutate();
    await RNShare.share({ message: `Check this: ${url}`, url });
  };

  const isOwnPost = String(currentUser?.id) === String(post.user.id);
  const getImageUri = (uri: string) => uri ? (uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`) : '';

  return (
    <View style={styles.postContainer}>
      <View style={styles.postHeader}>
        <TouchableOpacity style={styles.postUserInfo} onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: post.user.id } })}>
          <Image source={{ uri: getImageUri(post.user.avatar) }} style={styles.postAvatar} />
          <View style={styles.postUserDetails}>
            <View style={styles.userNameRow}>
              <Text style={styles.postName}>{post.user.name || post.user.username}</Text>
              {post.user.isVerified && <Text style={styles.verifiedBadge}>✓</Text>}
            </View>
            {post.location && <Text style={styles.postLocation}>{post.location}</Text>}
          </View>
          {!isOwnPost && (
            <TouchableOpacity style={[styles.followButton, isFollowing && styles.followingButton]} onPress={() => followMutation.mutate()}>
              <Text style={[styles.followText, isFollowing && styles.followingText]}>{isFollowing ? 'Following' : 'Follow'}</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
        
        {/* CUSTOM MENU TRIGGER */}
        <TouchableOpacity onPress={() => setOptionsVisible(true)} style={styles.moreButton}>
          <MoreHorizontal color={Colors.text} size={24} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {post.type === 'text' && post.content && <Text style={styles.postTextContent}>{post.content}</Text>}
      {post.images?.length > 0 && (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {post.images.map((img, i) => (
            <Image key={i} source={{ uri: getImageUri(img) }} style={styles.postImage} contentFit="cover" />
          ))}
        </ScrollView>
      )}

      {/* Actions */}
      <View style={styles.postActions}>
        <View style={styles.postActionsLeft}>
          <TouchableOpacity onPress={() => likeMutation.mutate()} style={styles.actionButton}>
            <Heart color={isLiked ? Colors.primary : Colors.text} fill={isLiked ? Colors.primary : 'transparent'} size={26} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCommentsVisible(true)} style={styles.actionButton}>
            <MessageCircle color={Colors.text} size={26} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
            <Share2 color={Colors.text} size={24} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setIsSaved(!isSaved)}>
          <Bookmark color={isSaved ? Colors.primary : Colors.text} fill={isSaved ? Colors.primary : 'transparent'} size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.postStats}>
        <Text style={styles.likesText}>{likes.toLocaleString()} likes</Text>
        {(post.type === 'photo' || post.type === 'text') && post.content && (
          <Text style={styles.postCaption}>
            <Text style={styles.postCaptionUsername}>{post.user.name || post.user.username} </Text>
            {post.content}
          </Text>
        )}
        {post.comments > 0 && (
          <TouchableOpacity onPress={() => setCommentsVisible(true)}>
            <Text style={styles.viewComments}>View all {post.comments} comments</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.postTime}>{formatTimeAgo(post.created_at || post.timestamp)}</Text>
      </View>

      {/* MODALS */}
      <PostOptionsModal 
        visible={optionsVisible} 
        onClose={() => setOptionsVisible(false)} 
        isOwnPost={isOwnPost} 
        onDelete={() => {
           Alert.alert('Delete', 'Are you sure?', [{text:'Cancel'}, {text:'Delete', style:'destructive', onPress: () => deleteMutation.mutate()}]);
        }}
        onReport={() => setReportVisible(true)}
      />
      <ReportModal visible={reportVisible} onClose={() => setReportVisible(false)} postId={post.id} />
      <CommentsModal visible={commentsVisible} onClose={() => setCommentsVisible(false)} postId={post.id} />
    </View>
  );
}

// ----------------------------------------------------------------
// 5. HomeScreen
// ----------------------------------------------------------------
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'for-you' | 'following'>('for-you');

  const { data: forYouData, refetch: refetchForYou, isRefetching: isRefetchingForYou, isLoading: isLoadingForYou } = useQuery({
    queryKey: ['feed-for-you'], queryFn: () => api.home.getFeed(1, 10, 'for-you'), enabled: isAuthenticated && activeTab === 'for-you',
  });
  const { data: followingData, refetch: refetchFollowing, isRefetching: isRefetchingFollowing, isLoading: isLoadingFollowing } = useQuery({
    queryKey: ['feed-following'], queryFn: () => api.home.getFeed(1, 10, 'following'), enabled: isAuthenticated && activeTab === 'following',
  });

  const isLoading = activeTab === 'for-you' ? isLoadingForYou : isLoadingFollowing;
  const refetch = activeTab === 'for-you' ? refetchForYou : refetchFollowing;
  const isRefetching = activeTab === 'for-you' ? isRefetchingForYou : isRefetchingFollowing;
  const feedData = activeTab === 'for-you' ? forYouData : followingData;
  const posts = (feedData?.posts || []).filter(item => item.type === 'text' || item.type === 'photo');

  if (!isAuthenticated) return (
    <View style={styles.centerContent}>
      <Text style={styles.notAuthText}>Please log in</Text>
      <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/auth/login')}><Text style={styles.loginButtonText}>Log In</Text></TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.logo}>SocialHub</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => router.push('/search')} style={styles.headerIcon}><Search color={Colors.text} size={24} /></TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.headerIcon}><Bell color={Colors.text} size={24} /></TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/messages')} style={styles.headerIcon}><MessageSquare color={Colors.text} size={24} /></TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'for-you' && styles.tabButtonActive]} onPress={() => setActiveTab('for-you')}>
          <Text style={[styles.tabButtonText, activeTab === 'for-you' && styles.tabButtonTextActive]}>For You</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'following' && styles.tabButtonActive]} onPress={() => setActiveTab('following')}>
          <Text style={[styles.tabButtonText, activeTab === 'following' && styles.tabButtonTextActive]}>Following</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? <ActivityIndicator size="large" color={Colors.primary} style={styles.loadingContainer} /> : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <PostItem post={item} />}
          ListHeaderComponent={StoryBar}
          contentContainerStyle={styles.feedContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No posts found.</Text></View>}
        />
      )}
    </View>
  );
}

// ----------------------------------------------------------------
// Styles
// ----------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  logo: { fontSize: 26, fontWeight: '700', color: Colors.text, letterSpacing: -0.5 },
  headerIcons: { flexDirection: 'row', gap: 16 },
  headerIcon: { padding: 4 },
  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.background },
  tabButton: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabButtonActive: { borderBottomColor: Colors.primary },
  tabButtonText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  tabButtonTextActive: { color: Colors.text },
  feedContent: { paddingBottom: 20 },
  
  // Post Styles
  postContainer: { marginTop: 16 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  postUserInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 12 },
  postAvatar: { width: 44, height: 44, borderRadius: 22 },
  postUserDetails: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postName: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  verifiedBadge: { color: Colors.info, fontSize: 14 },
  postLocation: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  followButton: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.primary, minWidth: 80, alignItems: 'center' },
  followingButton: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  followText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  followingText: { color: Colors.textSecondary },
  moreButton: { padding: 4 },
  postTextContent: { color: Colors.text, fontSize: 15, lineHeight: 20, paddingHorizontal: 16, marginBottom: 12 },
  postImagesContainer: { marginBottom: 8 },
  postImage: { width: width, height: width * 1.25, backgroundColor: Colors.surface },
  postActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 8 },
  postActionsLeft: { flexDirection: 'row', gap: 16 },
  actionButton: { padding: 4 },
  postStats: { paddingHorizontal: 16, marginTop: 8 },
  likesText: { color: Colors.text, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  postCaption: { color: Colors.text, fontSize: 14, lineHeight: 18, marginBottom: 4 },
  postCaptionUsername: { fontWeight: '600' },
  viewComments: { color: Colors.textSecondary, fontSize: 14, marginTop: 4, marginBottom: 4 },
  postTime: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },

  // Center/Loading
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notAuthText: { fontSize: 16, color: Colors.textSecondary, marginBottom: 20 },
  loginButton: { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 },
  loginButtonText: { fontSize: 16, fontWeight: '600', color: Colors.text },
  emptyContainer: { padding: 48, alignItems: 'center' },
  emptyText: { fontSize: 16, color: Colors.textSecondary },

  // --- MODAL STYLES (MATCHING REPORT UI) ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContentContainer: { backgroundColor: Colors.background, borderRadius: 12, maxHeight: '80%', paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  modalOptionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalOptionText: { fontSize: 16, color: Colors.text },
  modalLoadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 150 },

  // --- COMMENT MODAL (FULL SCREEN) ---
  fullScreenModalContainer: { flex: 1, backgroundColor: Colors.background },
  commentsList: { padding: 16 },
  commentItem: { flexDirection: 'row', marginBottom: 20, gap: 12, alignItems: 'flex-start' },
  commentAvatar: { width: 36, height: 36, borderRadius: 18 },
  commentContent: { flex: 1, backgroundColor: Colors.surface, padding: 10, borderRadius: 12, borderTopLeftRadius: 2 },
  commentHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentUsername: { fontSize: 14, fontWeight: '600', color: Colors.text },
  commentText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  commentTime: { fontSize: 12, color: Colors.textMuted },
  deleteIconContainer: { padding: 8, alignSelf: 'center' },
  emptyComments: { padding: 48, alignItems: 'center' },
  emptyCommentsText: { fontSize: 15, color: Colors.textSecondary },
  commentInputContainer: { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: Colors.border, gap: 12 },
  commentInput: { flex: 1, backgroundColor: Colors.surface, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: Colors.text, maxHeight: 100 },
  sendButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
});
