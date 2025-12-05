import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity,
  StatusBar, ActivityIndicator, TouchableWithoutFeedback, Animated, Platform, Modal, TextInput, Share, Alert, RefreshControl, AppState
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useIsFocused, router } from 'expo-router';
import { Heart, MessageCircle, Share2, MoreVertical, Music2, Camera, X, Send, Trash2, Flag } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import Colors from '@/constants/colors';
import { api, MEDIA_BASE_URL } from '@/services/api';
import { formatTimeAgo } from '@/constants/timeFormat';
import { useAuth } from '@/contexts/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_TAB_HEIGHT = Platform.OS === 'ios' ? 80 : 50; 
const ACTUAL_HEIGHT = SCREEN_HEIGHT - BOTTOM_TAB_HEIGHT;

// --- COMMENTS MODAL ---
function CommentsModal({ visible, onClose, reelId }: { visible: boolean; onClose: () => void; reelId: string }) {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['reel-comments', reelId],
    queryFn: () => api.reels.getComments(reelId),
    enabled: visible,
  });

  const postMutation = useMutation({
    mutationFn: (content: string) => api.reels.comment(reelId, content),
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey: ['reel-comments', reelId] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => api.reels.deleteComment(commentId),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['reel-comments', reelId] });
    }
  });

  const comments = data?.comments || [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Comments ({comments.length})</Text>
            <TouchableOpacity onPress={onClose}><X color="#fff" size={24} /></TouchableOpacity>
          </View>

          {isLoading ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} /> : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
              renderItem={({ item }) => (
                <View style={styles.commentItem}>
                  <Image source={{ uri: item.user.avatar ? (item.user.avatar.startsWith('http') ? item.user.avatar : `${MEDIA_BASE_URL}/${item.user.avatar}`) : '' }} style={styles.commentAvatar} />
                  <View style={{ flex: 1 }}>
                    <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                        <Text style={styles.commentUser}>{item.user.username}</Text>
                        <Text style={styles.commentTime}>{formatTimeAgo(item.created_at)}</Text>
                    </View>
                    <Text style={styles.commentText}>{item.content}</Text>
                  </View>
                  {/* Delete Button for Owner */}
                  {String(currentUser?.id) === String(item.user_id) && (
                      <TouchableOpacity onPress={() => Alert.alert('Delete', 'Delete this comment?', [{text:'Cancel'},{text:'Delete', style:'destructive', onPress:()=>deleteMutation.mutate(item.id)}])}>
                          <Trash2 size={16} color="#666" />
                      </TouchableOpacity>
                  )}
                </View>
              )}
              ListEmptyComponent={<Text style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>No comments yet.</Text>}
            />
          )}

          <View style={styles.inputContainer}>
            <TextInput 
                style={styles.input} 
                placeholder="Add a comment..." 
                placeholderTextColor="#999" 
                value={text}
                onChangeText={setText}
            />
            <TouchableOpacity onPress={() => text.trim() && postMutation.mutate(text)} disabled={!text.trim()}>
                <Send color={text.trim() ? Colors.primary : "#666"} size={24} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// --- OPTIONS MENU MODAL ---
function ReelOptionsModal({ visible, onClose, isOwner, onDelete, onReport }: any) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.optionsOverlay} activeOpacity={1} onPress={onClose}>
                <View style={styles.optionsBox}>
                    {isOwner ? (
                        <TouchableOpacity style={styles.optionItem} onPress={onDelete}>
                            <Trash2 size={20} color="#FF4444" />
                            <Text style={[styles.optionText, { color: '#FF4444' }]}>Delete Reel</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.optionItem} onPress={onReport}>
                            <Flag size={20} color="#fff" />
                            <Text style={styles.optionText}>Report Reel</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.optionItem} onPress={onClose}>
                        <X size={20} color="#fff" />
                        <Text style={styles.optionText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

// --- SINGLE REEL ITEM ---
const ReelItem = React.memo(({ item, isActive, index, toggleLike, toggleSubscribe, onDurationUpdate, openComments, openOptions }: any) => {
  const insets = useSafeAreaInsets();
  const videoRef = useRef<Video>(null);
  const heartScale = useRef(new Animated.Value(0)).current;
  const lastTap = useRef<number | null>(null);
  
  // App State Logic (Pause on Minimize)
  const appState = useRef(AppState.currentState);
  const [appActive, setAppActive] = useState(appState.current === 'active');
  const isFocused = useIsFocused(); 

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      appState.current = nextAppState;
      setAppActive(nextAppState === 'active');
    });
    return () => subscription.remove();
  }, []);

  // Play Logic: Only play if (Index Active) AND (Screen Focused) AND (App Foreground)
  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive && isFocused && appActive) {
      videoRef.current.playAsync();
    } else {
      videoRef.current.pauseAsync();
      // Only reset position if we left the screen entirely (not just minimized)
      if (!isFocused) videoRef.current.setPositionAsync(0); 
    }
  }, [isActive, isFocused, appActive]);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (lastTap.current && (now - lastTap.current) < 300) {
      if (!item.is_liked) toggleLike(item.id);
      animateHeart();
    } else {
      lastTap.current = now;
    }
  };

  const animateHeart = () => {
    heartScale.setValue(0);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, friction: 5 }),
      Animated.timing(heartScale, { toValue: 0, duration: 250, delay: 500, useNativeDriver: true })
    ]).start();
  };

  const handleShare = async () => {
      api.reels.share(item.id); // Track in DB
      try {
          await Share.share({
              message: `Check out this reel: https://moviedbr.com/reels/${item.id}`,
              url: `https://moviedbr.com/reels/${item.id}`
          });
      } catch (error) {}
  };

  const getUrl = (path: string) => path?.startsWith('http') ? path : `${MEDIA_BASE_URL}/${path}`;
  const channelAvatar = item.channel_avatar ? getUrl(item.channel_avatar) : 'https://via.placeholder.com/100';

  return (
    <View style={[styles.reelContainer, { height: ACTUAL_HEIGHT }]}>
      <TouchableWithoutFeedback onPress={handleDoubleTap}>
        <View style={styles.videoWrapper}>
          <Video
            ref={videoRef}
            source={{ uri: getUrl(item.video_url) }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={isActive && isFocused && appActive}
            onPlaybackStatusUpdate={(s: any) => {
                if (s.isLoaded && s.durationMillis && isActive) onDurationUpdate(item.id, s.durationMillis / 1000);
            }}
            posterSource={{ uri: getUrl(item.thumbnail_url) }}
            posterStyle={{ resizeMode: 'cover' }}
          />

          <View style={styles.centerHeart}>
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Heart size={100} color="white" fill="white" style={{ opacity: 0.8 }} />
            </Animated.View>
          </View>

          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.9)']} style={styles.gradient} />

          {/* Actions */}
          <View style={[styles.rightActions, { bottom: insets.bottom + 40 }]}>
            <TouchableOpacity onPress={() => toggleLike(item.id)} style={styles.actionBtn}>
              <Heart size={32} color={item.is_liked ? "#E1306C" : "#fff"} fill={item.is_liked ? "#E1306C" : "transparent"} />
              <Text style={styles.actionText}>{item.likes_count}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBtn} onPress={() => openComments(item.id)}>
              <MessageCircle size={32} color="#fff" />
              <Text style={styles.actionText}>{item.comments_count}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
              <Share2 size={30} color="#fff" />
              <Text style={styles.actionText}>{item.shares_count}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => openOptions(item)}>
              <MoreVertical size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Info */}
          <View style={[styles.bottomInfo, { bottom: insets.bottom + 10 }]}>
            <View style={styles.channelRow}>
                <TouchableOpacity style={styles.channelInfo} onPress={() => router.push({ pathname: '/channel/[channelId]', params: { channelId: item.channel_id } })}>
                  <Image source={{ uri: channelAvatar }} style={styles.avatar} />
                  <Text style={styles.channelName}>{item.channel_name || 'Channel'}</Text>
                  {item.channel_verified && <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.subscribeBtn, item.is_subscribed && styles.subscribedBtn]} onPress={() => toggleSubscribe(item.channel_id)}>
                    <Text style={[styles.subscribeText, item.is_subscribed && styles.subscribedText]}>{item.is_subscribed ? 'Subscribed' : 'Subscribe'}</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.caption} numberOfLines={2}>{item.caption}</Text>
            <View style={styles.musicRow}><Music2 size={14} color="#fff" /><Text style={styles.musicText}>Original Audio</Text></View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
});

// --- MAIN SCREEN ---
export default function ReelsScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [activeReelId, setActiveReelId] = useState<string | null>(null);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [selectedReel, setSelectedReel] = useState<any>(null);
  
  const startTimeRef = useRef<number>(Date.now());
  const durationsRef = useRef<{[key: string]: number}>({});
  
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['reels-feed', page],
    queryFn: () => api.reels.getReels(page, 5),
    staleTime: 5 * 60 * 1000, 
  });

  const reels = data?.reels || [];

  const trackCurrentView = useCallback((index: number, reelList: any[]) => {
    const reel = reelList[index];
    if (!reel) return;
    const endTime = Date.now();
    const watchDuration = (endTime - startTimeRef.current) / 1000; 
    const totalDuration = durationsRef.current[reel.id] || 0; 
    if (watchDuration > 1) api.reels.trackView(reel.id, watchDuration, totalDuration);
    startTimeRef.current = Date.now();
  }, []);

  useFocusEffect(useCallback(() => {
      startTimeRef.current = Date.now();
      return () => trackCurrentView(activeIndex, reels);
  }, [activeIndex, reels, trackCurrentView]));

  const likeMutation = useMutation({
    mutationFn: (reelId: string) => {
      const reel = reels.find((r: any) => r.id === reelId);
      return reel?.is_liked ? api.reels.unlike(reelId) : api.reels.like(reelId);
    },
    onSuccess: (data, reelId) => {
      queryClient.setQueryData(['reels-feed', page], (oldData: any) => {
        if (!oldData) return oldData;
        return { ...oldData, reels: oldData.reels.map((r: any) => r.id === reelId ? { ...r, is_liked: !r.is_liked, likes_count: r.is_liked ? r.likes_count - 1 : r.likes_count + 1 } : r) };
      });
    }
  });

  const subscribeMutation = useMutation({
    mutationFn: (channelId: string) => {
        const reel = reels.find((r: any) => r.channel_id === channelId);
        return reel?.is_subscribed ? api.channels.unsubscribe(channelId) : api.channels.subscribe(channelId);
    },
    onSuccess: (data, channelId) => {
       queryClient.setQueryData(['reels-feed', page], (oldData: any) => {
        if (!oldData) return oldData;
        return { ...oldData, reels: oldData.reels.map((r: any) => r.channel_id === channelId ? { ...r, is_subscribed: !r.is_subscribed } : r) };
      });
    }
  });

  const deleteMutation = useMutation({
      mutationFn: (id: string) => api.reels.delete(id), 
      onSuccess: () => { setOptionsVisible(false); refetch(); }
  });

  const reportMutation = useMutation({
      mutationFn: (data: any) => api.reels.report(data.id, 'Inappropriate'), 
      onSuccess: () => { setOptionsVisible(false); Alert.alert('Reported', 'Thank you for reporting.'); }
  });

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index ?? 0;
      if (newIndex !== activeIndex) trackCurrentView(activeIndex, reels);
      setActiveIndex(newIndex);
    }
  }).current;

  const handleDurationUpdate = useCallback((id: string, duration: number) => { durationsRef.current[id] = duration; }, []);

  if (isLoading && page === 1) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.header, { top: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>Reels</Text>
        <TouchableOpacity><Camera size={26} color="#fff" /></TouchableOpacity>
      </View>

      <FlatList
        data={reels}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, index }) => (
          <ReelItem 
            item={item} 
            index={index} 
            isActive={index === activeIndex} 
            toggleLike={(id: string) => likeMutation.mutate(id)}
            toggleSubscribe={(cid: string) => subscribeMutation.mutate(cid)}
            onDurationUpdate={handleDurationUpdate}
            openComments={(id: string) => { setActiveReelId(id); setCommentsVisible(true); }}
            openOptions={(reel: any) => { setSelectedReel(reel); setOptionsVisible(true); }}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ACTUAL_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        getItemLayout={(data, index) => ({ length: ACTUAL_HEIGHT, offset: ACTUAL_HEIGHT * index, index })}
        onEndReached={() => { if (data?.hasMore) setPage(p => p + 1); }}
        onEndReachedThreshold={2}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        ListEmptyComponent={<View style={[styles.loadingContainer, { height: ACTUAL_HEIGHT }]}><Text style={{ color: '#fff' }}>No Reels found</Text></View>}
      />

      <CommentsModal 
        visible={commentsVisible} 
        onClose={() => setCommentsVisible(false)} 
        reelId={activeReelId || ''} 
      />

      <ReelOptionsModal 
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        isOwner={String(selectedReel?.user_id) === String(currentUser?.id)}
        onDelete={() => {
            Alert.alert('Delete Reel', 'Are you sure?', [
                { text: 'Cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(selectedReel.id) } 
            ]);
        }}
        onReport={() => reportMutation.mutate({ id: selectedReel.id })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  header: { position: 'absolute', left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  reelContainer: { width: SCREEN_WIDTH, backgroundColor: '#000', position: 'relative' },
  videoWrapper: { flex: 1, backgroundColor: '#121212' },
  video: { width: '100%', height: '100%' },
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 350 },
  centerHeart: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  rightActions: { position: 'absolute', right: 10, zIndex: 20, alignItems: 'center', gap: 20 },
  actionBtn: { alignItems: 'center' },
  actionText: { color: '#fff', marginTop: 6, fontSize: 13, fontWeight: '600' },
  bottomInfo: { position: 'absolute', left: 16, right: 80, zIndex: 20 },
  channelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  channelInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#fff', marginRight: 10 },
  channelName: { color: '#fff', fontWeight: '700', fontSize: 16, marginRight: 6 },
  verifiedBadge: { backgroundColor: Colors.primary, borderRadius: 10, width: 14, height: 14, justifyContent: 'center', alignItems: 'center' },
  verifiedText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  subscribeBtn: { backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 10 },
  subscribedBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  subscribeText: { color: '#000', fontSize: 13, fontWeight: '700' },
  subscribedText: { color: '#fff' },
  caption: { color: '#fff', fontSize: 14, lineHeight: 20, marginBottom: 10 },
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  musicText: { color: '#fff', fontSize: 13 },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#121212', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '70%' },
  modalHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  commentItem: { flexDirection: 'row', marginBottom: 20, paddingHorizontal: 4 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
  commentUser: { color: '#fff', fontWeight: '700', fontSize: 13 },
  commentTime: { color: '#888', fontSize: 11 },
  commentText: { color: '#ddd', marginTop: 2 },
  inputContainer: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#333', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#333', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', marginRight: 10 },
  // Options Modal
  optionsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  optionsBox: { width: '80%', backgroundColor: '#1E1E1E', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#333' },
  optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16 },
  optionText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});
