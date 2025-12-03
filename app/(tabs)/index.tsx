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
  Flag,
} from 'lucide-react-native';
import React, { useState, useCallback } from 'react';
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
// 1. GLOBAL CUSTOM ALERT COMPONENT
// ----------------------------------------------------------------
interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: Array<{
    text: string;
    style?: 'cancel' | 'destructive' | 'default';
    onPress: () => void;
  }>;
  onClose: () => void;
}

function CustomAlert({ visible, title, message, buttons, onClose }: CustomAlertProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.alertContainer}>
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          <View style={styles.alertButtonContainer}>
            {buttons.map((btn, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.alertButton,
                  index > 0 && { marginLeft: 10 },
                  btn.style === 'destructive' && { backgroundColor: 'rgba(255, 59, 48, 0.1)' },
                  btn.style === 'cancel' && { backgroundColor: Colors.surface }
                ]}
                onPress={() => {
                  btn.onPress();
                  onClose();
                }}
              >
                <Text style={[
                  styles.alertButtonText,
                  btn.style === 'destructive' && { color: Colors.error },
                  btn.style === 'cancel' && { color: Colors.textSecondary },
                  btn.style === 'default' && { color: Colors.primary }
                ]}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ----------------------------------------------------------------
// 2. PostOptionsModal (Custom Bottom Menu)
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
        <View style={styles.bottomSheetContainer}>
          <View style={styles.bottomSheetHandle} />
          <View style={styles.bottomSheetContent}>
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
// 3. ReportModal
// ----------------------------------------------------------------
function ReportModal({ visible, onClose, onSubmit }: any) {
  const reasons = ['Spam', 'Inappropriate Content', 'Harassment', 'Violence', 'False Information'];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.popupContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Report</Text>
            <TouchableOpacity onPress={onClose}><X color={Colors.text} size={24} /></TouchableOpacity>
          </View>
          <ScrollView>
            {reasons.map((r, i) => (
              <TouchableOpacity key={i} style={styles.modalOptionItem} onPress={() => onSubmit(r)}>
                <Text style={styles.modalOptionText}>{r}</Text>
                <ChevronRight size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ----------------------------------------------------------------
// 4. CommentsModal
// ----------------------------------------------------------------
function CommentsModal({ visible, onClose, postId, showCustomAlert }: any) {
  const { user: currentUser } = useAuth();
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['post-comments', postId],
    queryFn: () => api.posts.getComments(postId, 1),
    enabled: visible
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => api.posts.comment(postId, content),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed-for-you'] });
    },
    onError: (err: any) => showCustomAlert('Error', err.message || 'Failed', [{ text: 'OK', style: 'default', onPress: () => {} }])
  });

  const deleteMutation = useMutation({
    mutationFn: (cid: string) => api.posts.deleteComment(cid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed-for-you'] });
    },
    onError: (err: any) => showCustomAlert('Error', err.message || 'Failed', [{ text: 'OK', style: 'default', onPress: () => {} }])
  });

  const confirmDelete = (cid: string) => {
    showCustomAlert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel', onPress: () => {} },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(cid) }
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.fullScreenModalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Comments</Text>
          <TouchableOpacity onPress={onClose}><X color={Colors.text} size={24} /></TouchableOpacity>
        </View>
        {isLoading ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} /> : (
          <FlatList
            data={data?.comments || []}
            keyExtractor={(i) => i.id.toString()}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <View style={styles.commentItem}>
                <Image source={{ uri: item.user?.avatar?.startsWith('http') ? item.user.avatar : `${MEDIA_BASE_URL}/${item.user.avatar}` }} style={styles.commentAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.commentUsername}>{item.user?.username}</Text>
                  <Text style={styles.commentText}>{item.content}</Text>
                  <Text style={styles.commentTime}>{formatTimeAgo(item.created_at)}</Text>
                </View>
                {(String(currentUser?.id) === String(item.user_id) || String(currentUser?.id) === String(item.user?.id)) && (
                  <TouchableOpacity onPress={() => confirmDelete(item.id)} style={{ padding: 8 }}>
                    <Trash2 size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                <Text style={styles.emptyCommentsText}>No comments yet</Text>
              </View>
            }
          />
        )}
        <View style={styles.commentInputContainer}>
          <TextInput style={styles.commentInput} placeholder="Add a comment..." placeholderTextColor={Colors.textMuted} value={comment} onChangeText={setComment} />
          <TouchableOpacity onPress={() => comment.trim() && commentMutation.mutate(comment)} disabled={commentMutation.isPending}>
            {commentMutation.isPending ? <ActivityIndicator size="small" color={Colors.primary} /> : <Send color={Colors.primary} size={20} />}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ----------------------------------------------------------------
// 5. PostItem
// ----------------------------------------------------------------
function PostItem({ post, showCustomAlert }: any) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likes, setLikes] = useState(post.likes);
  const [isSaved, setIsSaved] = useState(post.isSaved);
  
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const likeMutation = useMutation({
    mutationFn: () => isLiked ? api.posts.unlike(post.id) : api.posts.like(post.id),
    onSuccess: (data) => { setIsLiked(data.isLiked); setLikes(data.likes); }
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.posts.delete(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-for-you'] });
      queryClient.invalidateQueries({ queryKey: ['feed-following'] });
      showCustomAlert('Success', 'Post deleted successfully', [{ text: 'OK', style: 'default', onPress: () => {} }]);
    },
    onError: (err: any) => showCustomAlert('Error', err.message || 'Failed', [{ text: 'OK', style: 'default', onPress: () => {} }])
  });

  const reportMutation = useMutation({
    mutationFn: (reason: string) => api.posts.report(post.id, reason),
    onSuccess: () => {
      setReportOpen(false);
      showCustomAlert('Reported', 'Thanks for reporting.', [{ text: 'OK', style: 'default', onPress: () => {} }]);
    },
    onError: (err: any) => showCustomAlert('Error', err.message, [{ text: 'OK', style: 'default', onPress: () => {} }])
  });

  const handleDelete = () => {
    showCustomAlert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel', onPress: () => {} },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() }
    ]);
  };

  const handleShare = async () => {
    try {
      const shareUrl = `https://socialclub.com/posts/${post.id}`;
      api.posts.share(post.id);
      await RNShare.share({ message: `Check out this post: ${shareUrl}`, url: shareUrl });
    } catch (error) {
      console.error(error);
    }
  };

  const imgUri = (uri: string) => uri ? (uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`) : '';

  return (
    <View style={styles.postContainer}>
      <View style={styles.postHeader}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }} onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: post.user.id } })}>
          <Image source={{ uri: imgUri(post.user.avatar) }} style={styles.postAvatar} />
          <View>
            <Text style={styles.postName}>{post.user.name || post.user.username}</Text>
            {post.location && <Text style={styles.postLocation}>{post.location}</Text>}
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setOptionsOpen(true)} style={{ padding: 8 }}>
          <MoreHorizontal color={Colors.text} size={24} />
        </TouchableOpacity>
      </View>

      {post.content && <Text style={styles.postTextContent}>{post.content}</Text>}
      {post.images?.length > 0 && (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {post.images.map((img: string, i: number) => (
            <Image key={i} source={{ uri: imgUri(img) }} style={styles.postImage} contentFit="cover" />
          ))}
        </ScrollView>
      )}

      <View style={styles.postActions}>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TouchableOpacity onPress={() => likeMutation.mutate()}>
            <Heart color={isLiked ? Colors.primary : Colors.text} fill={isLiked ? Colors.primary : 'transparent'} size={26} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCommentsOpen(true)}>
            <MessageCircle color={Colors.text} size={26} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare}>
            <Share2 color={Colors.text} size={24} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setIsSaved(!isSaved)}>
          <Bookmark color={isSaved ? Colors.primary : Colors.text} fill={isSaved ? Colors.primary : 'transparent'} size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.postStats}>
        <Text style={styles.likesText}>{likes} likes</Text>
        <Text style={styles.postTime}>{formatTimeAgo(post.created_at)}</Text>
      </View>

      <PostOptionsModal 
        visible={optionsOpen} 
        onClose={() => setOptionsOpen(false)} 
        isOwnPost={String(user?.id) === String(post.user.id)} 
        onDelete={handleDelete} 
        onReport={() => setReportOpen(true)} 
      />
      <ReportModal visible={reportOpen} onClose={() => setReportOpen(false)} onSubmit={(r: string) => reportMutation.mutate(r)} />
      <CommentsModal visible={commentsOpen} onClose={() => setCommentsOpen(false)} postId={post.id} showCustomAlert={showCustomAlert} />
    </View>
  );
}

// ----------------------------------------------------------------
// 6. HomeScreen (Main)
// ----------------------------------------------------------------
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'for-you' | 'following'>('for-you');
  
  const [alertConfig, setAlertConfig] = useState<CustomAlertProps>({ 
    visible: false, title: '', message: '', buttons: [], onClose: () => {} 
  });

  const showCustomAlert = useCallback((title: string, message: string, buttons: any[]) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      buttons,
      onClose: () => setAlertConfig(prev => ({ ...prev, visible: false }))
    });
  }, []);

  const { data: feedData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: [`feed-${activeTab}`],
    queryFn: () => api.home.getFeed(1, 10, activeTab),
    enabled: isAuthenticated
  });

  const posts = (feedData?.posts || []).filter((i: any) => i.type === 'text' || i.type === 'photo');

  if (!isAuthenticated) return (
    <View style={styles.centerContent}>
      <Text style={{ color: Colors.text }}>Please login</Text>
      <TouchableOpacity onPress={() => router.push('/auth/login')} style={styles.loginButton}><Text>Login</Text></TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.logo}>SocialHub</Text>
        <View style={styles.headerIcons}>
          <Search color={Colors.text} size={24} />
          <Bell color={Colors.text} size={24} />
          <MessageSquare color={Colors.text} size={24} />
        </View>
      </View>

      <View style={styles.tabsContainer}>
        {['for-you', 'following'].map(tab => (
          <TouchableOpacity key={tab} onPress={() => setActiveTab(tab as any)} style={[styles.tabButton, activeTab === tab && styles.tabActive]}>
            <Text style={[styles.tabText, activeTab === tab && { color: Colors.text }]}>
              {tab === 'for-you' ? 'For You' : 'Following'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} /> : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <PostItem post={item} showCustomAlert={showCustomAlert} />}
          ListHeaderComponent={StoryBar}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No posts found.</Text>}
        />
      )}

      <CustomAlert {...alertConfig} />
    </View>
  );
}

// ----------------------------------------------------------------
// Styles
// ----------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderColor: Colors.border },
  logo: { fontSize: 24, fontWeight: 'bold', color: Colors.text },
  headerIcons: { flexDirection: 'row', gap: 16 },
  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, borderColor: Colors.border },
  tabButton: { flex: 1, padding: 14, alignItems: 'center', borderBottomWidth: 2, borderColor: 'transparent' },
  tabActive: { borderColor: Colors.primary },
  tabText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  
  postContainer: { marginTop: 16 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  postAvatar: { width: 44, height: 44, borderRadius: 22 },
  postName: { color: Colors.text, fontWeight: '600', fontSize: 15 },
  postLocation: { color: Colors.textSecondary, fontSize: 12 },
  postTextContent: { color: Colors.text, paddingHorizontal: 16, marginBottom: 10, fontSize: 15 },
  postImage: { width: width, height: width * 1.25, backgroundColor: Colors.surface },
  postActions: { paddingHorizontal: 16, marginTop: 10 },
  postStats: { paddingHorizontal: 16, marginTop: 8 },
  likesText: { color: Colors.text, fontWeight: '600' },
  postTime: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  
  // Custom Alert Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  alertContainer: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, alignItems: 'center' },
  alertTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
  alertMessage: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  alertButtonContainer: { flexDirection: 'row', width: '100%', justifyContent: 'center' },
  alertButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, minWidth: 100, alignItems: 'center' },
  alertButtonText: { fontWeight: '600', fontSize: 16 },

  // Bottom Sheet Style Menu
  bottomSheetContainer: { flex: 1, justifyContent: 'flex-end' },
  bottomSheetHandle: { flex: 1 },
  bottomSheetContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalOptionItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderColor: Colors.border },
  optionRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  modalOptionText: { color: Colors.text, fontSize: 16 },

  // Popup Style (Report)
  popupContainer: { backgroundColor: Colors.surface, borderRadius: 12, padding: 20, maxHeight: '60%', width: '100%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: 'bold' },

  // Comments
  fullScreenModalContainer: { flex: 1, backgroundColor: Colors.background },
  commentItem: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18 },
  commentUsername: { color: Colors.text, fontWeight: '600', fontSize: 14 },
  commentText: { color: Colors.text, fontSize: 14 },
  commentTime: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  emptyComments: { padding: 48, alignItems: 'center' },
  emptyCommentsText: { fontSize: 15, color: Colors.textSecondary },
  commentInputContainer: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderColor: Colors.border, alignItems: 'center', gap: 10 },
  commentInput: { flex: 1, backgroundColor: Colors.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: Colors.text },
  
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loginButton: { backgroundColor: Colors.primary, padding: 12, borderRadius: 8, marginTop: 10 },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40 }
});
