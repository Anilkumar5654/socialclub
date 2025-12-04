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
  TouchableWithoutFeedback,
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

// --- FLOATING HEART ANIMATION COMPONENT ---
const FloatingHeart = ({ onComplete }: { onComplete: () => void }) => {
  const anim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => onComplete());
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -200] });
  const opacity = anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] });
  const scale = anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.5, 1.2, 1] });
  const randomX = Math.random() * 40 - 20; // Random spread

  return (
    <Animated.View style={[styles.floatingHeart, { transform: [{ translateY }, { translateX: randomX }, { scale }], opacity }]}>
      <Heart color="#E1306C" fill="#E1306C" size={40} />
    </Animated.View>
  );
};

// --- VIEWERS MODAL ---
function ViewersModal({ visible, onClose, storyId }: { visible: boolean; onClose: () => void; storyId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['story-viewers', storyId],
    queryFn: () => api.stories.getViewers(storyId),
    enabled: visible && !!storyId,
  });

  const viewers = data?.viewers || [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Story Views ({viewers.length})</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeModalBtn}>
              <X color="#000" size={20} />
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
                <View style={styles.viewerItem}>
                  <Image source={{ uri: item.avatar?.startsWith('http') ? item.avatar : `${MEDIA_BASE_URL}/${item.avatar}` }} style={styles.viewerAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.viewerName}>{item.username}</Text>
                    <Text style={styles.viewerTime}>{formatTimeAgo(item.viewed_at)}</Text>
                  </View>
                  {item.reaction_type === 'heart' && <Heart size={16} color="#E1306C" fill="#E1306C" />}
                </View>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// --- MAIN SCREEN ---
export default function StoryViewerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const [activeUserIndex, setActiveUserIndex] = useState(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [showViewers, setShowViewers] = useState(false);
  const [hearts, setHearts] = useState<number[]>([]); // For Animation

  const progressAnim = useRef(new Animated.Value(0)).current;
  const videoRef = useRef<Video>(null);

  // FETCH STORIES
  const { data: storiesData, isLoading } = useQuery({
    queryKey: ['stories'],
    queryFn: () => api.stories.getStories(),
  });

  const storyGroups = useMemo(() => {
    if (!storiesData?.stories) return [];
    const groups: any[] = [];
    const map = new Map();
    storiesData.stories.forEach((story: any) => {
      const uid = story.user?.id || story.user_id;
      if (!map.has(uid)) {
        map.set(uid, { userId: uid, user: story.user, stories: [] });
        groups.push(map.get(uid));
      }
      map.get(uid).stories.push(story);
    });
    return groups;
  }, [storiesData]);

  useEffect(() => {
    if (storyGroups.length > 0 && userId) {
      const index = storyGroups.findIndex(g => String(g.userId) === String(userId));
      if (index !== -1) setActiveUserIndex(index);
    }
  }, [userId, storyGroups.length]);

  const currentGroup = storyGroups[activeUserIndex];
  const currentStory = currentGroup?.stories[currentStoryIndex];
  // FIX: Robust Ownership Check
  const isOwnStory = String(currentGroup?.userId) === String(currentUser?.id);

  // --- ACTIONS ---
  const viewMutation = useMutation({
    mutationFn: (id: string) => api.stories.view(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stories'] })
  });

  const reactMutation = useMutation({
    mutationFn: (id: string) => api.stories.react(id, 'heart'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.stories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      if (currentGroup.stories.length === 1) closeViewer();
      else advanceStory();
    }
  });

  // --- NAVIGATION ---
  const closeViewer = () => router.back();

  const advanceStory = useCallback(() => {
    progressAnim.setValue(0);
    setIsLoaded(false);
    if (currentStoryIndex < currentGroup.stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else {
      if (activeUserIndex < storyGroups.length - 1) {
        setActiveUserIndex(prev => prev + 1);
        setCurrentStoryIndex(0);
      } else {
        closeViewer();
      }
    }
  }, [currentStoryIndex, currentGroup, activeUserIndex, storyGroups]);

  const previousStory = () => {
    progressAnim.setValue(0);
    setIsLoaded(false);
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    } else {
      if (activeUserIndex > 0) {
        setActiveUserIndex(prev => prev - 1);
        setCurrentStoryIndex(storyGroups[activeUserIndex - 1].stories.length - 1);
      } else {
        setCurrentStoryIndex(0);
      }
    }
  };

  // --- PROGRESS & VIEW TRACKING ---
  useEffect(() => {
    if (!currentStory || isPaused || !isLoaded) return;

    // FIX: Track View for EVERYONE (except owner locally, but api usually handles it)
    if (!currentStory.is_viewed && !isOwnStory) {
      viewMutation.mutate(currentStory.id);
    }

    const duration = currentStory.media_type === 'video' 
      ? (currentStory.duration ? currentStory.duration * 1000 : 15000) 
      : 5000;

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) advanceStory();
    });

    return () => progressAnim.stopAnimation();
  }, [currentStoryIndex, activeUserIndex, isPaused, isLoaded, currentStory]);

  // --- ANIMATION HANDLER ---
  const handleReaction = () => {
    // 1. Add Heart to State
    setHearts(prev => [...prev, Date.now()]);
    // 2. Call API
    reactMutation.mutate(currentStory.id);
  };

  const removeHeart = (id: number) => {
    setHearts(prev => prev.filter(h => h !== id));
  };

  const getUrl = (path: string) => path?.startsWith('http') ? path : `${MEDIA_BASE_URL}/${path}`;

  if (isLoading || !currentStory) {
    return (
      <View style={styles.blackBg}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* MEDIA */}
      <TouchableWithoutFeedback
        onPressIn={() => setIsPaused(true)}
        onPressOut={() => setIsPaused(false)}
        onPress={(evt) => {
          if (evt.nativeEvent.locationX < SCREEN_WIDTH * 0.3) previousStory();
          else advanceStory();
        }}
      >
        <View style={styles.mediaContainer}>
          {!isLoaded && <ActivityIndicator size="large" color="#fff" style={styles.loader} />}
          {currentStory.media_type === 'video' ? (
            <Video
              ref={videoRef}
              source={{ uri: getUrl(currentStory.media_url) }}
              style={styles.media}
              resizeMode={ResizeMode.COVER}
              shouldPlay={!isPaused && isLoaded}
              isMuted={isMuted}
              onLoad={() => setIsLoaded(true)}
            />
          ) : (
            <Image
              source={{ uri: getUrl(currentStory.media_url) }}
              style={styles.media}
              contentFit="cover"
              onLoad={() => setIsLoaded(true)}
            />
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.bottomGradient} />
        </View>
      </TouchableWithoutFeedback>

      {/* OVERLAY */}
      {!isPaused && (
        <View style={[styles.overlay, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}>
          
          <View style={styles.topSection}>
            {/* Progress */}
            <View style={styles.progressContainer}>
              {currentGroup.stories.map((story: any, index: number) => (
                <View key={story.id} style={styles.progressBarBg}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      {
                        width: index === currentStoryIndex 
                          ? progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                          : index < currentStoryIndex ? '100%' : '0%'
                      }
                    ]}
                  />
                </View>
              ))}
            </View>

            {/* Header */}
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
                  <TouchableOpacity onPress={() => { setIsPaused(true); Alert.alert('Delete', 'Sure?', [{text:'Cancel', onPress:()=>setIsPaused(false)},{text:'Delete', onPress:()=>deleteMutation.mutate(currentStory.id)}])}} style={styles.iconBtn}>
                    <Trash2 color="#fff" size={20} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={closeViewer} style={styles.iconBtn}>
                  <X color="#fff" size={24} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {/* Floating Hearts Animation Container */}
            <View style={styles.heartsContainer} pointerEvents="none">
               {hearts.map(id => <FloatingHeart key={id} onComplete={() => removeHeart(id)} />)}
            </View>

            {currentStory.caption ? (
                <View style={styles.captionContainer}><Text style={styles.captionText}>{currentStory.caption}</Text></View>
            ) : null}

            {isOwnStory ? (
                <TouchableOpacity style={styles.viewsPill} onPress={() => { setIsPaused(true); setShowViewers(true); }}>
                    <Eye color="#fff" size={18} />
                    <Text style={styles.viewsText}>{currentStory.views_count || 0} Views</Text>
                </TouchableOpacity>
            ) : (
                <View style={styles.replyRow}>
                    <View style={styles.inputPill}>
                        <TextInput placeholder="Send message..." placeholderTextColor="rgba(255,255,255,0.7)" style={styles.input} value={message} onChangeText={setMessage} onFocus={() => setIsPaused(true)} onBlur={() => setIsPaused(false)} />
                        {message.length > 0 && <TouchableOpacity><Send color="#3B82F6" size={20} /></TouchableOpacity>}
                    </View>
                    <TouchableOpacity style={styles.heartBtn} onPress={handleReaction}>
                        <Heart color="#fff" size={24} />
                    </TouchableOpacity>
                </View>
            )}
          </View>
        </View>
      )}

      <ViewersModal visible={showViewers} storyId={currentStory.id} onClose={() => { setShowViewers(false); setIsPaused(false); }} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  blackBg: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#000' },
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
});
