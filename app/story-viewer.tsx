import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { X, Heart, Send, MoreVertical, Pause, Play, Volume2, VolumeX, Eye, Trash2 } from 'lucide-react-native';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Pressable,
  Animated,
  ActivityIndicator,
  PanResponder,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { formatTimeAgo } from '@/constants/timeFormat';
import { useAuth } from '@/contexts/AuthContext';
import { api, MEDIA_BASE_URL } from '@/services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedStoryImage = Animated.createAnimatedComponent(Image);

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  created_at: string;
  expires_at: string;
  is_viewed: boolean;
  views_count?: number;
  likes_count?: number;
  comments_count?: number;
}

interface StoryGroup {
  userId: string;
  user: {
    id: string;
    username: string;
    avatar: string;
  };
  stories: Story[];
}

function ProgressBar({
  isActive,
  duration,
}: {
  isActive: boolean;
  duration: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration,
        useNativeDriver: false,
      }).start();
    } else {
      progress.stopAnimation();
    }
  }, [isActive, duration, progress]);

  return (
    <View style={styles.progressBarContainer}>
      <View style={styles.progressBarBackground} />
      <Animated.View
        style={[
          styles.progressBarFill,
          {
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

function ViewersModal({
  visible,
  onClose,
  storyId,
}: {
  visible: boolean;
  onClose: () => void;
  storyId: string;
}) {
  const { data: viewersData, isLoading } = useQuery({
    queryKey: ['story-viewers', storyId],
    queryFn: () => api.stories.getViewers(storyId),
    enabled: visible && !!storyId,
  });

  const viewers = viewersData?.viewers || [];

  const getImageUri = (uri: string) => {
    if (!uri) return '';
    return uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.viewersModalOverlay}>
        <View style={styles.viewersModalContainer}>
          <View style={styles.viewersModalHeader}>
            <Text style={styles.viewersModalTitle}>Views</Text>
            <TouchableOpacity onPress={onClose}>
              <X color={Colors.text} size={24} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.viewersLoadingContainer}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <FlatList
              data={viewers}
              keyExtractor={(item) => item.id || item.user_id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.viewerItem}
                  onPress={() => {
                    onClose();
                    router.push({
                      pathname: '/user/[userId]',
                      params: { userId: item.user?.id || item.user_id },
                    });
                  }}
                >
                  <Image
                    source={{
                      uri: getImageUri(item.user?.avatar || item.avatar || ''),
                    }}
                    style={styles.viewerAvatar}
                  />
                  <View style={styles.viewerInfo}>
                    <Text style={styles.viewerUsername}>
                      {item.user?.username || item.username || 'Unknown'}
                    </Text>
                    <Text style={styles.viewerTime}>
                      {formatTimeAgo(item.viewed_at || item.created_at)}
                    </Text>
                  </View>
                  {item.reaction && (
                    <Text style={styles.viewerReaction}>❤️</Text>
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.viewersList}
              ListEmptyComponent={
                <View style={styles.emptyViewers}>
                  <Eye color={Colors.textMuted} size={48} />
                  <Text style={styles.emptyViewersText}>No views yet</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function StoryViewerScreen() {
  const params = useLocalSearchParams<{ userId: string }>();
  const initialUserId = params.userId || '';
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data: storiesData, isLoading } = useQuery({
    queryKey: ['stories'],
    queryFn: () => api.stories.getStories(),
    enabled: !!initialUserId,
  });

  const storyGroups = useMemo(() => {
    if (!storiesData?.stories) return [];
    
    const groupedStories: { [key: string]: StoryGroup } = {};
    
    storiesData.stories.forEach((story: any) => {
      const userId = story.user?.id || story.user_id;
      
      if (!groupedStories[userId]) {
        groupedStories[userId] = {
          userId,
          user: story.user || {
            id: userId,
            username: 'Unknown',
            avatar: '',
          },
          stories: [],
        };
      }
      
      groupedStories[userId].stories.push(story);
    });
    
    return Object.values(groupedStories);
  }, [storiesData]);

  const [activeUserIndex, setActiveUserIndex] = useState(() => {
    const index = storyGroups.findIndex((group) => group.userId === initialUserId);
    return index >= 0 ? index : 0;
  });
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [message, setMessage] = useState('');
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showCloseButton, setShowCloseButton] = useState(false);
  const [viewersModalVisible, setViewersModalVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const autoplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentGroup = storyGroups[activeUserIndex];
  const currentUserStories = currentGroup?.stories ?? [];
  const currentStory = currentUserStories[currentStoryIndex];
  const isOwnStory = currentGroup?.userId === currentUser?.id;

  const reactMutation = useMutation({
    mutationFn: (storyId: string) => api.stories.react(storyId, 'heart'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['story-viewers', currentStory?.id] });
    },
  });

  useEffect(() => {
    if (currentStory && !currentStory.is_viewed && !isOwnStory) {
      api.stories.view(currentStory.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['stories'] });
      }).catch((err) => {
        console.error('[StoryViewer] Failed to mark story as viewed', err);
      });
    }
  }, [currentStory, queryClient, isOwnStory]);

  useEffect(() => {
    setCurrentStoryIndex(0);
  }, [activeUserIndex]);

  useEffect(() => {
    setIsMediaReady(false);
    fadeAnim.setValue(0);
  }, [currentStoryIndex, fadeAnim]);

  const goToNext = useCallback(() => {
    console.log('[StoryViewer] advancing to next story');
    if (currentStoryIndex < currentUserStories.length - 1) {
      setCurrentStoryIndex((prev) => prev + 1);
      return;
    }
    if (activeUserIndex < storyGroups.length - 1) {
      const nextIndex = activeUserIndex + 1;
      setActiveUserIndex(nextIndex);
      setCurrentStoryIndex(0);
      return;
    }
    router.back();
  }, [activeUserIndex, currentStoryIndex, currentUserStories.length, storyGroups.length]);

  const goToPrevious = useCallback(() => {
    console.log('[StoryViewer] moving to previous story');
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (activeUserIndex > 0) {
      const previousUserIndex = activeUserIndex - 1;
      const previousStories = storyGroups[previousUserIndex]?.stories ?? [];
      setActiveUserIndex(previousUserIndex);
      setCurrentStoryIndex(Math.max(previousStories.length - 1, 0));
      return;
    }
  }, [activeUserIndex, currentStoryIndex, storyGroups]);

  const isStoryPlaying = !isPaused && isMediaReady;

  useEffect(() => {
    if (autoplayTimer.current) {
      clearTimeout(autoplayTimer.current);
      autoplayTimer.current = null;
    }
    if (currentStory && isStoryPlaying) {
      const duration = currentStory.media_type === 'video' ? 15000 : 5000;
      autoplayTimer.current = setTimeout(() => {
        goToNext();
      }, duration);
    }
    return () => {
      if (autoplayTimer.current) {
        clearTimeout(autoplayTimer.current);
      }
    };
  }, [currentStory, goToNext, isStoryPlaying]);

  const handleSendMessage = useCallback(() => {
    if (message.trim() && currentStory && currentGroup) {
      console.log('[StoryViewer] sending reply', {
        storyId: currentStory.id,
        toUser: currentGroup.user.username,
        value: message,
      });
      setMessage('');
      Alert.alert('Reply Sent', `Your message was sent to ${currentGroup.user.username}`);
    }
  }, [currentStory, currentGroup, message]);

  const handleMediaReady = useCallback(() => {
    setIsMediaReady(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handlePauseToggle = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const handleAudioToggle = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const handleReaction = useCallback(() => {
    if (currentStory && !isOwnStory) {
      reactMutation.mutate(currentStory.id);
    }
  }, [currentStory, isOwnStory]);

  const handleLongPressStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setShowCloseButton(true);
    }, 500);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setTimeout(() => {
      setShowCloseButton(false);
    }, 2000);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 12 || Math.abs(gestureState.dy) > 12,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 40) {
          goToPrevious();
          return;
        }
        if (gestureState.dx < -40) {
          goToNext();
          return;
        }
        if (gestureState.dy > 70) {
          router.back();
        }
      },
    }),
  ).current;

  useEffect(() => {
    return () => {
      if (autoplayTimer.current) {
        clearTimeout(autoplayTimer.current);
      }
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const getImageUri = (uri: string) => {
    if (!uri) return '';
    return uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`;
  };

  if (isLoading) {
    return (
      <View style={styles.fallbackContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading stories...</Text>
      </View>
    );
  }

  if (!currentStory || !currentGroup) {
    return (
      <View style={styles.fallbackContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.fallbackText}>No stories available</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <AnimatedStoryImage
        source={{ uri: getImageUri(currentStory.media_url) }}
        style={[styles.storyImage, { opacity: fadeAnim }]}
        contentFit="cover"
        onLoad={handleMediaReady}
      />
      {!isMediaReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={Colors.text} size="large" />
          <Text style={styles.loadingText}>Loading story</Text>
        </View>
      )}
      <SafeAreaView
        style={styles.overlay}
        edges={['top', 'bottom']}
        {...panResponder.panHandlers}
        testID="story-viewer-overlay"
      >
        <View style={styles.topSection}>
          <View style={styles.progressBars}>
            {currentUserStories.map((story, index) => (
              <ProgressBar
                key={story.id}
                isActive={index === currentStoryIndex && isStoryPlaying}
                duration={story.media_type === 'video' ? 15000 : 5000}
              />
            ))}
          </View>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.userInfo}
              onPress={() => {
                router.back();
                router.push({
                  pathname: '/user/[userId]',
                  params: { userId: currentGroup.userId },
                });
              }}
            >
              <Image source={{ uri: getImageUri(currentGroup.user.avatar) }} style={styles.avatar} />
              <View style={styles.userMeta}>
                <Text style={styles.username}>{currentGroup.user.username}</Text>
                <Text style={styles.timestamp}>{formatTimeAgo(currentStory.created_at)}</Text>
              </View>
              <View style={styles.storyCounterPill}>
                <Text style={styles.storyCounterText}>
                  {activeUserIndex + 1}/{storyGroups.length}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={styles.headerActions}>
              {currentStory.media_type === 'video' && (
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={handleAudioToggle}
                  testID="toggle-story-audio"
                >
                  {isMuted ? (
                    <VolumeX color={Colors.text} size={22} />
                  ) : (
                    <Volume2 color={Colors.text} size={22} />
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.controlButton}
                onPress={handlePauseToggle}
                testID="toggle-story-pause"
              >
                {isPaused ? (
                  <Play color={Colors.text} size={20} fill={Colors.text} />
                ) : (
                  <Pause color={Colors.text} size={20} fill={Colors.text} />
                )}
              </TouchableOpacity>
              {isOwnStory ? (
                <TouchableOpacity 
                  style={styles.controlButton}
                  onPress={() => {
                    Alert.alert(
                      'Delete Story',
                      'Are you sure you want to delete this story?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => {
                            api.stories.delete(currentStory.id)
                              .then(() => {
                                queryClient.invalidateQueries({ queryKey: ['stories'] });
                                goToNext();
                              })
                              .catch((err) => {
                                Alert.alert('Error', 'Failed to delete story');
                              });
                          },
                        },
                      ]
                    );
                  }}
                  testID="story-delete-button"
                >
                  <Trash2 color={Colors.text} size={22} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.controlButton}
                  onPress={() => Alert.alert('More', 'More options coming soon')}
                  testID="story-more-menu"
                >
                  <MoreVertical color={Colors.text} size={24} />
                </TouchableOpacity>
              )}
              {showCloseButton && (
                <TouchableOpacity
                  style={[styles.controlButton, styles.closeButtonHighlight]}
                  onPress={() => router.back()}
                  testID="close-story-viewer"
                >
                  <X color={Colors.text} size={28} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        <Pressable
          style={styles.leftTap}
          onPress={goToPrevious}
          onPressIn={handleLongPressStart}
          onPressOut={handleLongPressEnd}
          testID="story-previous-zone"
        />
        <Pressable
          style={styles.rightTap}
          onPress={goToNext}
          onPressIn={handleLongPressStart}
          onPressOut={handleLongPressEnd}
          testID="story-next-zone"
        />
        {isOwnStory ? (
          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={styles.viewCountButton}
              onPress={() => setViewersModalVisible(true)}
            >
              <Eye color={Colors.text} size={20} />
              <Text style={styles.viewCountText}>
                {currentStory.views_count || 0} {currentStory.views_count === 1 ? 'view' : 'views'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.bottomSection}>
            <View style={styles.messageInputContainer}>
              <TextInput
                style={styles.messageInput}
                placeholder={`Reply to ${currentGroup.user.username}...`}
                placeholderTextColor={Colors.textMuted}
                value={message}
                onChangeText={setMessage}
                testID="story-message-input"
              />
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSendMessage}
                disabled={!message.trim()}
                testID="story-send-message"
              >
                <Send color={message.trim() ? Colors.primary : Colors.textMuted} size={22} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.heartButton}
              onPress={handleReaction}
              disabled={reactMutation.isPending}
              testID="story-heart-action"
            >
              <Heart color={Colors.text} size={28} />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      <ViewersModal
        visible={viewersModalVisible}
        onClose={() => setViewersModalVisible(false)}
        storyId={currentStory?.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  storyImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topSection: {
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  progressBars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 16,
  },
  progressBarContainer: {
    flex: 1,
    height: 3,
    position: 'relative',
  },
  progressBarBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 1.5,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.text,
    borderRadius: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  userMeta: {
    flexDirection: 'column',
    gap: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.text,
  },
  username: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  timestamp: {
    color: Colors.text,
    fontSize: 13,
    opacity: 0.85,
  },
  storyCounterPill: {
    borderColor: Colors.text,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.overlayLight,
  },
  storyCounterText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  controlButton: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: Colors.overlayLight,
  },
  closeButtonHighlight: {
    backgroundColor: Colors.primary,
  },
  leftTap: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.3,
  },
  rightTap: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.3,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  messageInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  messageInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
  },
  sendButton: {
    padding: 4,
    marginLeft: 8,
  },
  heartButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewCountButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 28,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  viewCountText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.text,
    marginTop: 8,
    fontSize: 14,
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: 16,
  },
  fallbackText: {
    color: Colors.text,
    fontSize: 16,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  viewersModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  viewersModalContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  viewersModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  viewersModalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  viewersLoadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  viewersList: {
    padding: 16,
  },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  viewerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  viewerInfo: {
    flex: 1,
  },
  viewerUsername: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  viewerTime: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  viewerReaction: {
    fontSize: 20,
  },
  emptyViewers: {
    padding: 48,
    alignItems: 'center',
  },
  emptyViewersText: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 12,
  },
});
