import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Animated,
  ActivityIndicator,
  Modal,
  FlatList,
  StatusBar,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  PanResponder,
  Easing
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Heart, Send, MoreVertical, Volume2, VolumeX, Eye, Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import Colors from '@/constants/colors';
import { formatTimeAgo } from '@/constants/timeFormat';
import { useAuth } from '@/contexts/AuthContext';
import { api, MEDIA_BASE_URL } from '@/services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- 1. CUSTOM DARK ALERT COMPONENT ---
interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  isDestructive?: boolean;
}

const CustomAlert = ({ visible, title, message, onCancel, onConfirm, confirmText = 'Confirm', isDestructive = false }: CustomAlertProps) => {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.alertOverlay}>
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          <View style={styles.alertButtons}>
            <TouchableOpacity onPress={onCancel} style={styles.alertBtnCancel}>
              <Text style={styles.alertBtnTextCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={styles.alertBtnConfirm}>
              <Text style={[styles.alertBtnTextConfirm, isDestructive && { color: '#FF4444' }]}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// --- 2. FLOATING HEART ANIMATION ---
const FloatingHeart = ({ onComplete }: { onComplete: () => void }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 1000, easing: Easing.out(Easing.ease), useNativeDriver: true,
    }).start(() => onComplete());
  }, []);
  
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -200] });
  const opacity = anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] });
  const scale = anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.5, 1.2, 1] });
  const randomX = Math.random() * 40 - 20;

  return (
    <Animated.View style={[styles.floatingHeart, { transform: [{ translateY }, { translateX: randomX }, { scale }], opacity }]}>
      <Heart color="#E1306C" fill="#E1306C" size={40} />
    </Animated.View>
  );
};

// --- 3. VIEWERS MODAL (WITH HEART & PROFILE NAV) ---
function ViewersModal({ visible, onClose, storyId }: { visible: boolean; onClose: () => void; storyId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['story-viewers', storyId],
    queryFn: () => api.stories.getViewers(storyId),
    enabled: visible && !!storyId,
  });
  const viewers = data?.viewers || [];
  
  const getImageUri = (uri: string) => uri?.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Story Views ({viewers.length})</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeModalBtn}>
              <X color="#fff" size={20} />
            </TouchableOpacity>
          </View>
          
          {isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={viewers}
              keyExtractor={(item) => item.user_id.toString()}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={<Text style={styles.emptyText}>No views yet.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.viewerItem} 
                  onPress={() => {
                    onClose();
                    router.push({ pathname: '/user/[userId]', params: { userId: item.user_id } });
                  }}
                >
                  <Image source={{ uri: getImageUri(item.avatar) }} style={styles.viewerAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.viewerName}>{item.username}</Text>
                    <Text style={styles.viewerTime}>{formatTimeAgo(item.viewed_at)}</Text>
                  </View>
                  {/* Show Filled Heart if user reacted */}
                  {item.reaction_type === 'heart' && <Heart size={18} color="#E1306C" fill="#E1306C" />}
                </TouchableOpacity>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// --- 4. MAIN VIEWER SCREEN ---
export default function StoryViewerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // State Management
  const [activeUserIndex, setActiveUserIndex] = useState(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [showViewers, setShowViewers] = useState(false);
  
  const [hearts, setHearts] = useState<number[]>([]);
  const [hasLiked, setHasLiked] = useState(false);
  
  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', onConfirm: () => {}, isDestructive: false });

  const progressAnim = useRef(new Animated.Value(0)).current;
  const videoRef = useRef<Video>(null);

  // Fetch Stories
  const { data: storiesData, isLoading } = useQuery({ 
    queryKey: ['stories'], 
    queryFn: () => api.stories.getStories() 
  });

  // Group Stories Logic
  const storyGroups = useMemo(() => {
    if (!storiesData?.stories) return [];
    const groups: any[] = [];
    const map = new Map();
    storiesData.stories.forEach((story: any) => {
      const uid = story.user?.id || story.user_id;
      if (!map.has(uid)) { map.set(uid, { userId: uid, user: story.user, stories: [] }); groups.push(map.get(uid)); }
      map.get(uid).stories.push(story);
    });
    return groups;
  }, [storiesData]);

  // Set Initial User
  useEffect(() => {
    if (storyGroups.length > 0 && userId) {
      const index = storyGroups.findIndex(g => String(g.userId) === String(userId));
      if (index !== -1) setActiveUserIndex(index);
    }
  }, [userId, storyGroups.length]);

  const currentGroup = storyGroups[activeUserIndex];
  const currentStory = currentGroup?.stories[currentStoryIndex];
  const isOwnStory = String(currentGroup?.userId) === String(currentUser?.id);

  // Sync Like Status when Story Changes
  useEffect(() => {
    if (currentStory) {
        // is_liked (1 or 0) comes from index.php
        setHasLiked(!!currentStory.is_liked);
        setIsLoaded(false); 
        progressAnim.setValue(0);
    }
  }, [currentStory?.id, currentStory?.is_liked]);

  // --- MUTATIONS ---
  const viewMutation = useMutation({ 
    mutationFn: (id: string) => api.stories.view(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stories'] }) 
  });

  const reactMutation = useMutation({ 
    mutationFn: (id: string) => api.stories.react(id, 'heart'),
    onSuccess: (data: any) => {
        // Toggle Logic from Backend Response
        if (data.action === 'added') setHasLiked(true);
        else setHasLiked(false);
        queryClient.invalidateQueries({ queryKey: ['stories'] });
    }
  });

  const deleteMutation = useMutation({ 
    mutationFn: (id: string) => api.stories.delete(id), 
    onSuccess: () => { 
        queryClient.invalidateQueries({ queryKey: ['stories'] }); 
        setAlertConfig(prev => ({ ...prev, visible: false }));
        // Logic: If last story deleted, close viewer, else go next
        if (currentGroup.stories.length === 1) closeViewer(); else advanceStory(); 
    } 
  });

  // Navigation Logic
  const closeViewer = () => router.back();

  const advanceStory = useCallback(() => {
    progressAnim.setValue(0); setIsLoaded(false);
    if (currentStoryIndex < currentGroup.stories.length - 1) setCurrentStoryIndex(prev => prev + 1);
    else if (activeUserIndex < storyGroups.length - 1) { setActiveUserIndex(prev => prev + 1); setCurrentStoryIndex(0); }
    else closeViewer();
  }, [currentStoryIndex, currentGroup, activeUserIndex, storyGroups]);

  const previousStory = () => {
    progressAnim.setValue(0); setIsLoaded(false);
    if (currentStoryIndex > 0) setCurrentStoryIndex(prev => prev - 1);
    else if (activeUserIndex > 0) { setActiveUserIndex(prev => prev - 1); setCurrentStoryIndex(storyGroups[activeUserIndex - 1].stories.length - 1); }
    else setCurrentStoryIndex(0);
  };

  // --- GESTURE CONTROL ---
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10,
      onPanResponderGrant: () => setIsPaused(true),
      onPanResponderRelease: (_, gestureState) => {
        setIsPaused(false);
        const { dx, dy } = gestureState;

        // Vertical Swipe (Up/Down)
        if (Math.abs(dy) > Math.abs(dx)) { 
            if (dy > 50) { 
                // SWIPE DOWN -> CLOSE
                closeViewer(); 
            } else if (dy < -50 && isOwnStory) { 
                // SWIPE UP -> OPEN VIEWERS (Owner only)
                setShowViewers(true);
            }
        } 
        // Horizontal Tap (Navigation)
        else {
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) { 
                const touchX = gestureState.x0;
                if (touchX < SCREEN_WIDTH * 0.3) previousStory();
                else advanceStory();
            }
        }
      }
    })
  ).current;

  // Timer & View Tracking
  useEffect(() => {
    if (!currentStory || isPaused || !isLoaded || alertConfig.visible || showViewers) return;
    
    // View Logic
    if (!currentStory.is_viewed && !isOwnStory) {
        viewMutation.mutate(currentStory.id);
    }
    
    // Progress Logic
    const duration = currentStory.media_type === 'video' ? (currentStory.duration ? currentStory.duration * 1000 : 15000) : 5000;
    Animated.timing(progressAnim, { toValue: 1, duration: duration, useNativeDriver: false }).start(({ finished }) => { if (finished) advanceStory(); });
    
    return () => progressAnim.stopAnimation();
  }, [currentStoryIndex, activeUserIndex, isPaused, isLoaded, currentStory, alertConfig.visible, showViewers]);

  // Handlers
  const handleReaction = () => {
    // Optimistic UI
    const willLike = !hasLiked;
    setHasLiked(willLike);
    if (willLike) setHearts(prev => [...prev, Date.now()]); // Bubble only on Like
    reactMutation.mutate(currentStory.id);
  };

  const confirmDelete = () => {
    setIsPaused(true);
    setAlertConfig({
        visible: true,
        title: 'Delete Story',
        message: 'Are you sure you want to delete this story? It cannot be undone.',
        confirmText: 'Delete',
        isDestructive: true,
        onConfirm: () => deleteMutation.mutate(currentStory.id),
        onCancel: () => { setAlertConfig(prev => ({...prev, visible: false})); setIsPaused(false); }
    });
  };

  const getUrl = (path: string) => path?.startsWith('http') ? path : `${MEDIA_BASE_URL}/${path}`;

  if (isLoading || !currentStory) return <View style={styles.blackBg}><ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} /></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* GESTURE AREA */}
      <View style={styles.gestureArea} {...panResponder.panHandlers}>
        <View style={styles.mediaContainer}>
          {!isLoaded && <ActivityIndicator size="large" color="#fff" style={styles.loader} />}
          {currentStory.media_type === 'video' ? (
            <Video ref={videoRef} source={{ uri: getUrl(currentStory.media_url) }} style={styles.media} resizeMode={ResizeMode.COVER} shouldPlay={!isPaused && isLoaded && !alertConfig.visible && !showViewers} isMuted={isMuted} onLoad={() => setIsLoaded(true)} />
          ) : (
            <Image source={{ uri: getUrl(currentStory.media_url) }} style={styles.media} contentFit="cover" onLoad={() => setIsLoaded(true)} />
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.bottomGradient} />
        </View>

        {!isPaused && !alertConfig.visible && !showViewers && (
          <View style={[styles.overlay, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}>
            <View style={styles.topSection}>
              <View style={styles.progressContainer}>
                {currentGroup.stories.map((story: any, index: number) => (
                  <View key={story.id} style={styles.progressBarBg}>
                    <Animated.View style={[styles.progressBarFill, { width: index === currentStoryIndex ? progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : index < currentStoryIndex ? '100%' : '0%' }]} />
                  </View>
                ))}
              </View>
              <View style={styles.headerRow}>
                <TouchableOpacity style={styles.userInfo} onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: currentGroup.userId } })}>
                  <Image source={{ uri: getUrl(currentGroup.user?.avatar) }} style={styles.avatar} />
                  <View>
                    <Text style={styles.username}>{currentGroup.user?.username}</Text>
                    <Text style={styles.timeAgo}>{formatTimeAgo(currentStory.created_at)}</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.headerRight}>
                  {isOwnStory && (
                    <TouchableOpacity onPress={confirmDelete} style={styles.iconBtn}><Trash2 color="#fff" size={20} /></TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={closeViewer} style={styles.iconBtn}><X color="#fff" size={24} /></TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.footer}>
              <View style={styles.heartsContainer} pointerEvents="none">
                 {hearts.map(id => <FloatingHeart key={id} onComplete={() => setHearts(prev => prev.filter(h => h !== id))} />)}
              </View>
              
              {currentStory.caption ? (<View style={styles.captionContainer}><Text style={styles.captionText}>{currentStory.caption}</Text></View>) : null}
              
              {isOwnStory ? (
                  <TouchableOpacity style={styles.viewsPill} onPress={() => { setIsPaused(true); setShowViewers(true); }}>
                      <Eye color="#fff" size={18} />
                      <Text style={styles.viewsText}>{currentStory.views_count || 0} Views (Swipe Up)</Text>
                  </TouchableOpacity>
              ) : (
                  <View style={styles.replyRow}>
                      <View style={styles.inputPill}>
                          <TextInput placeholder="Send message..." placeholderTextColor="rgba(255,255,255,0.7)" style={styles.input} value={message} onChangeText={setMessage} onFocus={() => setIsPaused(true)} onBlur={() => setIsPaused(false)} />
                          {message.length > 0 && <TouchableOpacity><Send color="#3B82F6" size={20} /></TouchableOpacity>}
                      </View>
                      <TouchableOpacity style={styles.heartBtn} onPress={handleReaction}>
                          {/* FILL HEART LOGIC */}
                          <Heart color={hasLiked ? "#E1306C" : "#fff"} fill={hasLiked ? "#E1306C" : "transparent"} size={28} />
                      </TouchableOpacity>
                  </View>
              )}
            </View>
          </View>
        )}
      </View>

      <ViewersModal visible={showViewers} storyId={currentStory.id} onClose={() => { setShowViewers(false); setIsPaused(false); }} />
      <CustomAlert visible={alertConfig.visible} title={alertConfig.title} message={alertConfig.message} confirmText={alertConfig.confirmText} isDestructive={alertConfig.isDestructive} onConfirm={alertConfig.onConfirm} onCancel={alertConfig.onCancel} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  blackBg: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#000' },
  gestureArea: { flex: 1 },
  mediaContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', justifyContent: 'center' },
  media: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  loader: { position: 'absolute', alignSelf: 'center', zIndex: 1 },
  bottomGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  topSection: { paddingHorizontal: 12 },
  progressContainer: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  progressBarBg: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  username: { color: '#fff', fontWeight: '700', fontSize: 13, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  timeAgo: { color: 'rgba(255,255,255,0.8)', fontSize: 11, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBtn: { padding: 4 },
  footer: { paddingHorizontal: 16, gap: 16, position: 'relative' },
  captionContainer: { alignSelf: 'center', marginBottom: 10, maxWidth: '90%' },
  captionText: { color: '#fff', fontSize: 16, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  viewsPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, gap: 8 },
  viewsText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inputPill: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.3)' },
  input: { flex: 1, color: '#fff', fontSize: 15 },
  heartBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#121212', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '50%' },
  modalHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  closeModalBtn: { backgroundColor: '#333', padding: 4, borderRadius: 12 },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 20 },
  viewerItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  viewerAvatar: { width: 40, height: 40, borderRadius: 20 },
  viewerName: { color: '#fff', fontWeight: '600' },
  viewerTime: { color: '#888', fontSize: 12 },
  heartsContainer: { position: 'absolute', bottom: 60, right: 20, width: 50, height: 300, zIndex: 99 },
  floatingHeart: { position: 'absolute', bottom: 0 },
  
  // Custom Alert Styles
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  alertBox: { width: '80%', backgroundColor: '#1E1E1E', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  alertTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  alertMessage: { color: '#AAA', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  alertButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  alertBtnCancel: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#333', alignItems: 'center' },
  alertBtnConfirm: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#333', alignItems: 'center' },
  alertBtnTextCancel: { color: '#fff', fontWeight: '600' },
  alertBtnTextConfirm: { color: '#E1306C', fontWeight: '600' } // Theme Pink
});
