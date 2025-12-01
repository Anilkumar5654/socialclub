import { Video as ExpoVideo, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router'; // IMPORTANT: useFocusEffect added
import {
  Heart,
  MessageCircle,
  Share2,
  Music,
  Bookmark,
  Volume2,
  VolumeX,
  Play,
  Eye,
} from 'lucide-react-native';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share as RNShare,
  Alert,
  ScrollView,
  Pressable,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { formatTimeAgo } from '@/constants/timeFormat';
import { api, MEDIA_BASE_URL } from '@/services/api';
import { Reel } from '@/types';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// --- COMMENTS SHEET COMPONENT ---
function CommentsSheet({ visible, onClose, reelId }: { visible: boolean; onClose: () => void; reelId: string }) {
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const insets = useSafeAreaInsets();

  const { data: commentsData, isLoading, refetch } = useQuery({
    queryKey: ['reel-comments', reelId],
    queryFn: () => api.reels.getComments(reelId, 1),
    enabled: visible,
  });

  const { mutate: submitComment, isPending } = useMutation({
    mutationFn: (content: string) => api.reels.comment(reelId, content),
    onSuccess: () => {
      setCommentText('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['reels'] });
    },
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" transparent>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView style={[styles.commentsContainer, { paddingBottom: insets.bottom }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsTitle}>Comments</Text>
            <TouchableOpacity onPress={onClose}><Text style={{color: Colors.primary}}>Close</Text></TouchableOpacity>
          </View>
          {isLoading ? <ActivityIndicator style={{flex:1}} color={Colors.primary} /> : (
            <ScrollView contentContainerStyle={{padding: 16}}>
              {(commentsData?.comments || []).map((c: any) => (
                <View key={c.id} style={styles.commentRow}>
                  <Image source={{ uri: c.user?.avatar ? `${MEDIA_BASE_URL}/${c.user.avatar}` : '' }} style={styles.commentAvatar} />
                  <View style={{flex:1}}>
                    <Text style={styles.commentAuthor}>{c.user?.username}</Text>
                    <Text style={styles.commentBody}>{c.content}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={styles.commentComposer}>
            <TextInput style={styles.commentInput} placeholder="Add a comment..." placeholderTextColor="#888" value={commentText} onChangeText={setCommentText} />
            <TouchableOpacity onPress={() => submitComment(commentText.trim())} disabled={!commentText.trim() || isPending}>
              <Text style={styles.commentSendText}>Post</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// --- REEL ITEM COMPONENT ---

interface ReelItemProps {
  reel: Reel;
  isActive: boolean;
  isScreenFocused: boolean; // NEW PROP
}

function ReelItem({ reel, isActive, isScreenFocused }: ReelItemProps) {
  const queryClient = useQueryClient();
  const videoRef = useRef<ExpoVideo>(null);
  
  // States
  const [isLiked, setIsLiked] = useState(reel.isLiked);
  const [likes, setLikes] = useState(reel.likes);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  
  // Subscribe/Follow Logic
  const channelId = reel.channel?.id || reel.user?.channel_id;
  const initialSubState = reel.isSubscribed || false; // Assuming API returns this
  const [isSubscribed, setIsSubscribed] = useState(initialSubState);

  // Watch Time Tracking Refs
  const watchTimeRef = useRef(0);
  const startTimeRef = useRef(0);
  const durationRef = useRef(0);
  const hasTrackedView = useRef(false);

  // Animation
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // --- PLAYBACK LOGIC (CRITICAL FIX FOR BACKGROUND AUDIO) ---
  // Video sirf tab chalega jab:
  // 1. isActive = true (List me video screen par hai)
  // 2. isScreenFocused = true (User Reels tab par hi hai)
  useEffect(() => {
    if (!videoRef.current) return;

    if (isActive && isScreenFocused) {
      videoRef.current.playAsync();
      startTimeRef.current = Date.now();
    } else {
      videoRef.current.pauseAsync();
      // Track view when pausing or scrolling away
      trackViewSession();
    }
  }, [isActive, isScreenFocused]);

  const trackViewSession = async () => {
    if (!startTimeRef.current || durationRef.current === 0) return;
    
    const sessionTime = (Date.now() - startTimeRef.current) / 1000;
    watchTimeRef.current += sessionTime;
    startTimeRef.current = 0; // Reset start time

    // Agar 3 second se jyada dekha aur abhi tak track nahi kiya
    if (watchTimeRef.current > 3 && !hasTrackedView.current) {
      const completionRate = Math.min((watchTimeRef.current / durationRef.current) * 100, 100);
      try {
        await api.reels.trackView(reel.id, watchTimeRef.current, completionRate);
        hasTrackedView.current = true; // Ek session me ek baar track karo
        console.log('[Reel] View Tracked');
      } catch (e) {
        console.log('[Reel] Tracking failed');
      }
    }
  };

  // --- MUTATIONS ---
  const { mutate: toggleLike } = useMutation({
    mutationFn: () => isLiked ? api.reels.unlike(reel.id) : api.reels.like(reel.id),
    onSuccess: (data) => { setIsLiked(data.isLiked); setLikes(data.likes); }
  });

  const { mutate: handleSubscribe } = useMutation({
    mutationFn: () => {
      // Agar channel ID hai to Subscribe endpoint, nahi to Follow endpoint
      if (channelId) {
        return isSubscribed ? api.channels.unsubscribe(channelId) : api.channels.subscribe(channelId);
      } else {
        // Fallback to user follow if no channel
        return api.users.follow(reel.user.id); 
      }
    },
    onSuccess: () => {
      setIsSubscribed(!isSubscribed);
      Alert.alert(isSubscribed ? 'Unsubscribed' : 'Subscribed');
    },
    onError: () => Alert.alert('Error', 'Action failed')
  });

  const { mutate: shareReel } = useMutation({
    mutationFn: async () => {
      const url = `https://www.moviedbr.com/reels/${reel.id}`;
      await RNShare.share({ message: `Watch this reel: ${url}` });
      return api.reels.share(reel.id); // API hit after share
    }
  });

  // --- HANDLERS ---
  const onLikePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    toggleLike();
  };

  const getMediaUri = (uri: string | undefined) => {
    if (!uri) return '';
    return uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`;
  };

  const formatCount = (count: any) => {
    const num = Number(count || 0);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // Data Prep
  const videoUrl = getMediaUri(reel.videoUrl || (reel as any).video_url);
  const avatarUrl = getMediaUri(reel.channel?.avatar || reel.user?.avatar || 'assets/c_profile.jpg');
  const displayName = reel.channel?.name || reel.user?.channel_name || reel.user?.username || 'User';

  return (
    <View style={styles.reelContainer}>
      <Pressable 
        style={styles.videoWrapper} 
        onPress={() => {
          if (isPlaying) { videoRef.current?.pauseAsync(); setShowPlayIcon(true); }
          else { videoRef.current?.playAsync(); setShowPlayIcon(false); }
        }}
      >
        <ExpoVideo
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN} // 16:9 Fit
          isLooping
          isMuted={isMuted}
          shouldPlay={isActive && isScreenFocused} // KEY FIX
          onPlaybackStatusUpdate={status => {
            if (status.isLoaded) {
              setIsPlaying(status.isPlaying);
              if (status.durationMillis) durationRef.current = status.durationMillis / 1000;
            }
          }}
        />
        {showPlayIcon && !isPlaying && (
          <View style={styles.centerIcon}><Play size={50} color="white" fill="white" /></View>
        )}
      </Pressable>

      {/* Mute Toggle */}
      <TouchableOpacity style={styles.muteBtn} onPress={() => setIsMuted(!isMuted)}>
        {isMuted ? <VolumeX color="white" size={20} /> : <Volume2 color="white" size={20} />}
      </TouchableOpacity>

      {/* --- INSTAGRAM LAYOUT UI --- */}
      <View style={styles.uiContainer}>
        
        {/* Left Bottom: Info */}
        <View style={styles.leftCol}>
          <View style={styles.userRow}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            <Text style={styles.username} numberOfLines={1}>{displayName}</Text>
            <TouchableOpacity 
              style={[styles.subBtn, isSubscribed && styles.subBtnActive]} 
              onPress={() => handleSubscribe()}
            >
              <Text style={styles.subText}>{isSubscribed ? 'Subscribed' : 'Subscribe'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.caption} numberOfLines={2}>{reel.caption}</Text>
          {reel.music && (
            <View style={styles.musicRow}>
              <Music size={12} color="white" />
              <Text style={styles.musicText}>{reel.music.title}</Text>
            </View>
          )}
        </View>

        {/* Right Bottom: Actions */}
        <View style={styles.rightCol}>
          {/* Like */}
          <TouchableOpacity style={styles.actionBtn} onPress={onLikePress}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Heart size={32} color={isLiked ? Colors.error : "white"} fill={isLiked ? Colors.error : "transparent"} />
            </Animated.View>
            <Text style={styles.actionText}>{formatCount(likes)}</Text>
          </TouchableOpacity>

          {/* Views */}
          <View style={styles.actionBtn}>
            <Eye size={28} color="white" />
            <Text style={styles.actionText}>{formatCount(reel.views)}</Text>
          </View>

          {/* Comments */}
          <TouchableOpacity style={styles.actionBtn} onPress={() => setCommentsVisible(true)}>
            <MessageCircle size={30} color="white" />
            <Text style={styles.actionText}>{formatCount(reel.comments)}</Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={styles.actionBtn} onPress={() => shareReel()}>
            <Share2 size={28} color="white" />
            <Text style={styles.actionText}>{formatCount(reel.shares)}</Text>
          </TouchableOpacity>

          {/* Music Disc */}
          <View style={styles.discContainer}>
            <Image source={{ uri: avatarUrl }} style={styles.discImg} />
          </View>
        </View>
      </View>

      <CommentsSheet visible={commentsVisible} onClose={() => setCommentsVisible(false)} reelId={reel.id} />
    </View>
  );
}

// --- REELS SCREEN ---

export default function ReelsScreen() {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  // Focus Effect to detect tab switching
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true); // Screen focused
      return () => {
        setIsScreenFocused(false); // Screen blurred (Navigated away)
      };
    }, [])
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reels-feed'],
    queryFn: async () => api.reels.getReels(1, 20),
  });

  const reels = data?.reels || [];

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }, []);

  return (
    <View style={styles.container}>
      {/* Header moved down slightly */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerText}>Reels</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={reels}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ReelItem 
              reel={item} 
              isActive={index === activeIndex} 
              isScreenFocused={isScreenFocused} // Pass focus state
            />
          )}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={SCREEN_HEIGHT}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          removeClippedSubviews
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { position: 'absolute', top: 0, left: 20, zIndex: 10 },
  headerText: { color: 'white', fontSize: 24, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 5 },
  
  reelContainer: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, position: 'relative' },
  videoWrapper: { flex: 1, justifyContent: 'center', backgroundColor: 'black' },
  video: { width: '100%', height: '100%' },
  centerIcon: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  muteBtn: { position: 'absolute', top: 100, right: 20, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },

  uiContainer: { position: 'absolute', bottom: 20, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, alignItems: 'flex-end', paddingBottom: Platform.OS === 'ios' ? 20 : 10 },
  
  leftCol: { flex: 1, paddingRight: 60, marginBottom: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'white', marginRight: 10 },
  username: { color: 'white', fontWeight: 'bold', fontSize: 16, marginRight: 10, maxWidth: 120 },
  subBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'white', backgroundColor: 'rgba(0,0,0,0.3)' },
  subBtnActive: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'transparent' },
  subText: { color: 'white', fontSize: 12, fontWeight: '600' },
  caption: { color: 'white', fontSize: 14, marginBottom: 10, textShadowColor: 'black', textShadowRadius: 1 },
  musicRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, alignSelf: 'flex-start' },
  musicText: { color: 'white', fontSize: 12, marginLeft: 5 },

  rightCol: { alignItems: 'center', gap: 20, paddingBottom: 20 },
  actionBtn: { alignItems: 'center' },
  actionText: { color: 'white', fontSize: 13, fontWeight: 'bold', marginTop: 4 },
  discContainer: { width: 45, height: 45, borderRadius: 25, backgroundColor: '#222', borderWidth: 2, borderColor: '#333', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  discImg: { width: 30, height: 30, borderRadius: 15 },

  // Comments Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  commentsContainer: { height: '70%', backgroundColor: '#121212', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderColor: '#333' },
  commentsTitle: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  commentRow: { flexDirection: 'row', marginBottom: 15 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  commentAuthor: { color: '#ccc', fontSize: 12, fontWeight: 'bold' },
  commentBody: { color: 'white', fontSize: 14 },
  commentComposer: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderColor: '#333' },
  commentInput: { flex: 1, backgroundColor: '#333', borderRadius: 20, paddingHorizontal: 15, color: 'white', marginRight: 10, height: 40 },
  commentSendText: { color: Colors.primary, fontWeight: 'bold', marginTop: 10 },
});
