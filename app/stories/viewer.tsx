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
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Heart, Send, MoreVertical, Pause, Play, Volume2, VolumeX, Eye, Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import Colors from '@/constants/colors';
import { formatTimeAgo } from '@/constants/timeFormat';
import { useAuth } from '@/contexts/AuthContext';
import { api, MEDIA_BASE_URL } from '@/services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- HELPER: VIEWERS MODAL ---
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

  // --- STATE ---
  const [activeUserIndex, setActiveUserIndex] = useState(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [showViewers, setShowViewers] = useState(false);
  
  // Animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  const videoRef = useRef<Video>(null);

  // --- DATA FETCHING ---
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
        map.set(uid, {
          userId: uid,
          user: story.user,
          stories: []
        });
        groups.push(map.get(uid));
      }
      map.get(uid).stories.push(story);
    });
    return groups;
  }, [storiesData]);

  // Initial User Set
  useEffect(() => {
    if (storyGroups.length > 0 && userId) {
      const index = storyGroups.findIndex(g => g.userId.toString() === userId.toString());
      if (index !== -1) setActiveUserIndex(index);
    }
  }, [userId, storyGroups.length]);

  const currentGroup = storyGroups[activeUserIndex];
  const currentStory = currentGroup?.stories[currentStoryIndex];
  const isOwnStory = currentGroup?.userId === currentUser?.id;

  // --- MUTATIONS ---
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

  // --- PROGRESS ---
  useEffect(() => {
    if (!currentStory || isPaused || !isLoaded) return;

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
      
      {/* 1. HIDE DEFAULT HEADER */}
      <Stack.Screen options={{ headerShown: false }} />
      
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* 2. MEDIA DISPLAY (Full Screen) */}
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
              resizeMode={ResizeMode.COVER} // Full Screen Video
              shouldPlay={!isPaused && isLoaded}
              isMuted={isMuted}
              onLoad={() => setIsLoaded(true)}
            />
          ) : (
            <Image
              source={{ uri: getUrl(currentStory.media_url) }}
              style={styles.media}
              contentFit="cover" // Full Screen Image
              onLoad={() => setIsLoaded(true)}
            />
          )}
          
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.bottomGradient} />
        </View>
      </TouchableWithoutFeedback>

      {/* 3. OVERLAY UI (Safe Area Logic Here) */}
      {!isPaused && (
        <View style={[styles.overlay, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}>
          
          {/* TOP SECTION */}
          <View style={styles.topSection}>
            {/* Progress Bars */}
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

            {/* INSTAGRAM STYLE HEADER (Avatar Left, Close Right) */}
            <View style={styles.headerRow}>
              <TouchableOpacity 
                style={styles.userInfo}
                onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: currentGroup.userId } })}
              >
                <Image source={{ uri: getUrl(currentGroup.user?.avatar) }} style={styles.avatar} />
                <View>
                  <Text style={styles.username}>{currentGroup.user?.username}</Text>
                  <Text style={styles.timeAgo}>{formatTimeAgo(currentStory.created_at)}</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.headerRight}>
                {isOwnStory && (
                  <TouchableOpacity onPress={deleteMutation.mutate.bind(null, currentStory.id)} style={styles.iconBtn}>
                    <Trash2 color="#fff" size={20} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={closeViewer} style={styles.iconBtn}>
                  <X color="#fff" size={24} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* BOTTOM SECTION */}
          <View style={styles.footer}>
            
            {/* Caption in Center */}
            {currentStory.caption ? (
                <View style={styles.captionContainer}>
                    <Text style={styles.captionText}>{currentStory.caption}</Text>
                </View>
            ) : null}

            {/* Controls */}
            {isOwnStory ? (
                <TouchableOpacity style={styles.viewsPill} onPress={() => { setIsPaused(true); setShowViewers(true); }}>
                    <Eye color="#fff" size={18} />
                    <Text style={styles.viewsText}>{currentStory.views_count || 0} Views</Text>
                </TouchableOpacity>
            ) : (
                <View style={styles.replyRow}>
                    <View style={styles.inputPill}>
                        <TextInput 
                            placeholder="Send message..." 
                            placeholderTextColor="rgba(255,255,255,0.7)"
                            style={styles.input}
                            value={message}
                            onChangeText={setMessage}
                            onFocus={() => setIsPaused(true)}
                            onBlur={() => setIsPaused(false)}
                        />
                        {message.length > 0 && (
                            <TouchableOpacity onPress={() => { setMessage(''); setIsPaused(false); }}>
                                <Send color="#3B82F6" size={20} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity 
                        style={styles.heartBtn} 
                        onPress={() => reactMutation.mutate(currentStory.id)}
                    >
                        <Heart color="#fff" size={24} />
                    </TouchableOpacity>
                </View>
            )}
          </View>

        </View>
      )}

      {/* VIEWERS MODAL */}
      <ViewersModal 
        visible={showViewers} 
        storyId={currentStory.id} 
        onClose={() => { setShowViewers(false); setIsPaused(false); }} 
      />

    </KeyboardAvoidingView>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  blackBg: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#000' }, // Ensure black bg for safe area
  
  // Media
  mediaContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', justifyContent: 'center' },
  media: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  loader: { position: 'absolute', alignSelf: 'center', zIndex: 1 },
  bottomGradient: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 150,
  },

  // Overlay
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  topSection: { paddingHorizontal: 12 },

  // Progress Bar
  progressContainer: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  progressBarBg: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#fff' },

  // Header (Top Left/Right)
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  username: { color: '#fff', fontWeight: '700', fontSize: 13, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  timeAgo: { color: 'rgba(255,255,255,0.8)', fontSize: 11, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBtn: { padding: 4 },

  // Footer
  footer: { paddingHorizontal: 16, gap: 16 },
  captionContainer: { alignSelf: 'center', marginBottom: 10, maxWidth: '90%' },
  captionText: { color: '#fff', fontSize: 16, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  // Owner Controls
  viewsPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, gap: 8 },
  viewsText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Viewer Controls
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inputPill: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.3)' },
  input: { flex: 1, color: '#fff', fontSize: 15 },
  heartBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },

  // Modal
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
});
