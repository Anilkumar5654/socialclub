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
import { Video, ResizeMode, Audio } from 'expo-av';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Heart, Send, MoreVertical, Pause, Play, Volume2, VolumeX, Eye, Trash2, ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient'; // Install: npx expo install expo-linear-gradient

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
  
  // Controls
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
    queryKey: ['stories'], // We fetch all stories to allow swiping between users
    queryFn: () => api.stories.getStories(),
  });

  // Organize Data: Group stories by User
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

  // Set initial user based on param
  useEffect(() => {
    if (storyGroups.length > 0 && userId) {
      const index = storyGroups.findIndex(g => g.userId.toString() === userId.toString());
      if (index !== -1) setActiveUserIndex(index);
    }
  }, [userId, storyGroups.length]); // Removed storyGroups from dependency to prevent loop reset

  // Current pointers
  const currentGroup = storyGroups[activeUserIndex];
  const currentStory = currentGroup?.stories[currentStoryIndex];
  const isOwnStory = currentGroup?.userId === currentUser?.id;

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
      // If deleted last story of user, close or move next
      if (currentGroup.stories.length === 1) {
        closeViewer();
      } else {
        advanceStory();
      }
    }
  });

  // --- NAVIGATION LOGIC ---
  const closeViewer = () => router.back();

  const advanceStory = useCallback(() => {
    // Reset state for next story
    progressAnim.setValue(0);
    setIsLoaded(false);
    
    if (currentStoryIndex < currentGroup.stories.length - 1) {
      // Next Story, Same User
      setCurrentStoryIndex(prev => prev + 1);
    } else {
      // Next User
      if (activeUserIndex < storyGroups.length - 1) {
        setActiveUserIndex(prev => prev + 1);
        setCurrentStoryIndex(0);
      } else {
        closeViewer(); // End of all stories
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
        // Go to last story of previous user
        setCurrentStoryIndex(storyGroups[activeUserIndex - 1].stories.length - 1);
      } else {
        setCurrentStoryIndex(0); // Restart first story
      }
    }
  };

  // --- PROGRESS LOGIC ---
  useEffect(() => {
    if (!currentStory || isPaused || !isLoaded) return;

    // Mark Viewed
    if (!currentStory.is_viewed && !isOwnStory) {
      viewMutation.mutate(currentStory.id);
    }

    // Timer Logic
    const duration = currentStory.media_type === 'video' 
      ? (currentStory.duration ? currentStory.duration * 1000 : 15000) 
      : 5000; // 5s for images

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        advanceStory();
      }
    });

    return () => progressAnim.stopAnimation();
  }, [currentStoryIndex, activeUserIndex, isPaused, isLoaded, currentStory]);

  // --- HANDLERS ---
  const handlePressIn = () => setIsPaused(true);
  const handlePressOut = () => setIsPaused(false);
  
  const handleTap = (evt: any) => {
    const x = evt.nativeEvent.locationX;
    if (x < SCREEN_WIDTH * 0.3) previousStory();
    else advanceStory();
  };

  const handleMediaLoad = () => {
    setIsLoaded(true);
  };

  const handleDelete = () => {
    setIsPaused(true);
    // Custom Alert logic here or standard Alert
    deleteMutation.mutate(currentStory.id);
  };

  // Helper for URL
  const getUrl = (path: string) => path?.startsWith('http') ? path : `${MEDIA_BASE_URL}/${path}`;

  if (isLoading || !currentStory) {
    return <View style={styles.blackBg}><ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} /></View>;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" hidden />

      {/* --- MEDIA LAYER --- */}
      <TouchableWithoutFeedback
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handleTap}
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
              onLoad={handleMediaLoad}
              onPlaybackStatusUpdate={(status: any) => {
                // Optional: Sync progress bar exactly with video position
              }}
            />
          ) : (
            <Image
              source={{ uri: getUrl(currentStory.media_url) }}
              style={styles.media}
              contentFit="cover"
              onLoad={handleMediaLoad}
            />
          )}
          
          {/* Dark Gradient at Bottom for Text Visibility */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.bottomGradient}
          />
        </View>
      </TouchableWithoutFeedback>

      {/* --- OVERLAY LAYER (Hide on Pause) --- */}
      {!isPaused && (
        <View style={[styles.overlay, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}>
          
          {/* 1. PROGRESS BARS */}
          <View style={styles.progressContainer}>
            {currentGroup.stories.map((story: any, index: number) => {
              return (
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
              );
            })}
          </View>

          {/* 2. HEADER (Glassmorphism Pill) */}
          <View style={styles.headerPill}>
            <TouchableOpacity onPress={() => {
                // Navigate to Profile
                router.push({ pathname: '/user/[userId]', params: { userId: currentGroup.userId } });
            }} style={styles.userInfo}>
              <Image source={{ uri: getUrl(currentGroup.user?.avatar) }} style={styles.avatar} />
              <View>
                <Text style={styles.username}>{currentGroup.user?.username}</Text>
                <Text style={styles.timeAgo}>{formatTimeAgo(currentStory.created_at)}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.headerActions}>
              {currentStory.media_type === 'video' && (
                <TouchableOpacity onPress={() => setIsMuted(!isMuted)} style={styles.iconBtn}>
                  {isMuted ? <VolumeX color="#fff" size={20} /> : <Volume2 color="#fff" size={20} />}
                </TouchableOpacity>
              )}
              
              {isOwnStory ? (
                <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
                  <Trash2 color="#FF4444" size={20} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => {}} style={styles.iconBtn}>
                  <MoreVertical color="#fff" size={20} />
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={closeViewer} style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <X color="#fff" size={20} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 3. CENTER (Invisible Taps handled by Parent) */}

          {/* 4. FOOTER & CAPTION */}
          <View style={styles.footer}>
            
            {/* Caption (If exists) */}
            {currentStory.caption ? (
                <View style={styles.captionContainer}>
                    <Text style={styles.captionText}>{currentStory.caption}</Text>
                </View>
            ) : null}

            {/* Controls */}
            {isOwnStory ? (
                // OWNER CONTROLS (Views)
                <TouchableOpacity style={styles.viewsPill} onPress={() => { setIsPaused(true); setShowViewers(true); }}>
                    <Eye color="#fff" size={18} />
                    <Text style={styles.viewsText}>{currentStory.views_count || 0} Views</Text>
                    <View style={styles.avatarsPreview}>
                        {/* Fake avatars for effect, replace with real data if available in list */}
                        <View style={[styles.miniAvatar, { backgroundColor: 'red', right: 0 }]} />
                        <View style={[styles.miniAvatar, { backgroundColor: 'blue', right: 10 }]} />
                    </View>
                </TouchableOpacity>
            ) : (
                // VIEWER CONTROLS (Reply & Heart)
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

const styles = StyleSheet.create({
  blackBg: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#000' },
  
  // Media Layer
  mediaContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center' },
  media: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: '#1a1a1a' },
  loader: { position: 'absolute', alignSelf: 'center', zIndex: 1 },
  bottomGradient: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 150,
  },

  // Overlay
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  
  // Progress
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    gap: 4,
    marginBottom: 12,
  },
  progressBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
  },

  // Header Pill (The Unique Design)
  headerPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.3)', // Glass effect
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#fff' },
  username: { color: '#fff', fontWeight: '700', fontSize: 13 },
  timeAgo: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },

  // Footer & Caption
  footer: { paddingHorizontal: 16, gap: 16 },
  
  captionContainer: {
    alignSelf: 'center',
    marginBottom: 10,
  },
  captionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    fontWeight: '500',
  },

  // Owner Controls (Views Pill)
  viewsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    gap: 8,
    width: '100%',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  viewsText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  avatarsPreview: { flexDirection: 'row', width: 30, height: 20 },
  miniAvatar: { position: 'absolute', width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#000' },

  // Viewer Controls (Input)
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inputPill: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  input: { flex: 1, color: '#fff', fontSize: 15 },
  heartBtn: {
    width: 50, height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#121212', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '60%' },
  modalHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#222' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  closeModalBtn: { backgroundColor: '#fff', padding: 4, borderRadius: 12 },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 20 },
  viewerItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  viewerAvatar: { width: 44, height: 44, borderRadius: 22 },
  viewerName: { color: '#fff', fontWeight: '600' },
  viewerTime: { color: '#888', fontSize: 12 },
});
