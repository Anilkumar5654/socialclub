import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity,
  StatusBar, ActivityIndicator, TouchableWithoutFeedback, Animated, Platform
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, router } from 'expo-router';
import { Heart, MessageCircle, Share2, MoreVertical, Music2, Camera, Check } from 'lucide-react-native'; // Added Check icon
import { LinearGradient } from 'expo-linear-gradient';

import Colors from '@/constants/colors';
import { api, MEDIA_BASE_URL } from '@/services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_TAB_HEIGHT = Platform.OS === 'ios' ? 80 : 50; 
const ACTUAL_HEIGHT = SCREEN_HEIGHT - BOTTOM_TAB_HEIGHT;

// --- SINGLE REEL ITEM ---
const ReelItem = React.memo(({ item, isActive, index, toggleLike, toggleSubscribe, onDurationUpdate }: { 
  item: any, 
  isActive: boolean, 
  index: number, 
  toggleLike: (id: string) => void,
  toggleSubscribe: (channelId: string) => void,
  onDurationUpdate: (id: string, duration: number) => void
}) => {
  const insets = useSafeAreaInsets();
  const videoRef = useRef<Video>(null);
  const heartScale = useRef(new Animated.Value(0)).current;
  const lastTap = useRef<number | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) {
      videoRef.current.playAsync();
    } else {
      videoRef.current.pauseAsync();
      videoRef.current.setPositionAsync(0); 
    }
  }, [isActive]);

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

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded && status.durationMillis && isActive) {
        onDurationUpdate(item.id, status.durationMillis / 1000); 
    }
  };

  const getUrl = (path: string) => path?.startsWith('http') ? path : `${MEDIA_BASE_URL}/${path}`;

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
            shouldPlay={isActive}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            posterSource={{ uri: getUrl(item.thumbnail_url) }}
            posterStyle={{ resizeMode: 'cover' }}
          />

          <View style={styles.centerHeart}>
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Heart size={100} color="white" fill="white" style={{ opacity: 0.8 }} />
            </Animated.View>
          </View>

          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.9)']} style={styles.gradient} />

          {/* Right Actions */}
          <View style={[styles.rightActions, { bottom: insets.bottom + 40 }]}>
            <TouchableOpacity onPress={() => toggleLike(item.id)} style={styles.actionBtn}>
              <Heart size={32} color={item.is_liked ? "#E1306C" : "#fff"} fill={item.is_liked ? "#E1306C" : "transparent"} />
              <Text style={styles.actionText}>{item.likes_count}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <MessageCircle size={32} color="#fff" />
              <Text style={styles.actionText}>{item.comments_count}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Share2 size={30} color="#fff" />
              <Text style={styles.actionText}>{item.shares_count}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <MoreVertical size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Bottom Channel Info */}
          <View style={[styles.bottomInfo, { bottom: insets.bottom + 10 }]}>
            <View style={styles.channelRow}>
                <TouchableOpacity 
                  style={styles.channelInfo} 
                  onPress={() => router.push({ pathname: '/channel/[channelId]', params: { channelId: item.channel_id } })}
                >
                  <Image source={{ uri: getUrl(item.channel_avatar) }} style={styles.avatar} />
                  <Text style={styles.channelName}>{item.channel_name}</Text>
                  {item.channel_verified && <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View>}
                </TouchableOpacity>

                {/* SUBSCRIBE BUTTON */}
                <TouchableOpacity 
                    style={[styles.subscribeBtn, item.is_subscribed && styles.subscribedBtn]} 
                    onPress={() => toggleSubscribe(item.channel_id)}
                >
                    <Text style={[styles.subscribeText, item.is_subscribed && styles.subscribedText]}>
                        {item.is_subscribed ? 'Subscribed' : 'Subscribe'}
                    </Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.caption} numberOfLines={2}>{item.caption}</Text>
            <View style={styles.musicRow}>
              <Music2 size={14} color="#fff" />
              <Text style={styles.musicText}>Original Audio</Text>
            </View>
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
  const startTimeRef = useRef<number>(Date.now());
  const durationsRef = useRef<{[key: string]: number}>({});
  
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  // 1. Fetch Reels
  const { data, isLoading } = useQuery({
    queryKey: ['reels-feed', page],
    queryFn: () => api.reels.getReels(page, 5),
    staleTime: 5 * 60 * 1000, 
  });

  const reels = data?.reels || [];

  // 2. Track View
  const trackCurrentView = useCallback((index: number, reelList: any[]) => {
    const reel = reelList[index];
    if (!reel) return;
    const endTime = Date.now();
    const watchDuration = (endTime - startTimeRef.current) / 1000; 
    const totalDuration = durationsRef.current[reel.id] || 0; 

    if (watchDuration > 1) {
        api.reels.trackView(reel.id, watchDuration, totalDuration);
    }
    startTimeRef.current = Date.now();
  }, []);

  useFocusEffect(
    useCallback(() => {
      startTimeRef.current = Date.now();
      return () => { trackCurrentView(activeIndex, reels); };
    }, [activeIndex, reels, trackCurrentView])
  );

  // 3. Mutations
  const likeMutation = useMutation({
    mutationFn: (reelId: string) => {
      const reel = reels.find((r: any) => r.id === reelId);
      return reel?.is_liked ? api.reels.unlike(reelId) : api.reels.like(reelId);
    },
    onSuccess: (data, reelId) => {
      queryClient.setQueryData(['reels-feed', page], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          reels: oldData.reels.map((r: any) => {
            if (r.id === reelId) {
              const wasLiked = r.is_liked;
              return { ...r, is_liked: !wasLiked, likes_count: wasLiked ? r.likes_count - 1 : r.likes_count + 1 };
            }
            return r;
          })
        };
      });
    }
  });

  const subscribeMutation = useMutation({
    mutationFn: (channelId: string) => {
        const reel = reels.find((r: any) => r.channel_id === channelId);
        // Note: Logic assumes api.channels.subscribe handles toggle or you need separate unsubscribe
        // For simplicity here assuming subscribe works as toggle or just subscribe
        // Ideally: check reel.is_subscribed ? unsubscribe : subscribe
        return reel?.is_subscribed ? api.channels.unsubscribe(channelId) : api.channels.subscribe(channelId);
    },
    onSuccess: (data, channelId) => {
       queryClient.setQueryData(['reels-feed', page], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          // Update ALL reels from same channel
          reels: oldData.reels.map((r: any) => {
            if (r.channel_id === channelId) {
              return { ...r, is_subscribed: !r.is_subscribed };
            }
            return r;
          })
        };
      });
    }
  });

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index ?? 0;
      if (newIndex !== activeIndex) {
         trackCurrentView(activeIndex, reels);
      }
      setActiveIndex(newIndex);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const handleDurationUpdate = useCallback((id: string, duration: number) => {
      durationsRef.current[id] = duration;
  }, []);

  if (isLoading && page === 1) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

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
            toggleLike={(id) => likeMutation.mutate(id)}
            toggleSubscribe={(cid) => subscribeMutation.mutate(cid)}
            onDurationUpdate={handleDurationUpdate}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ACTUAL_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(data, index) => ({ length: ACTUAL_HEIGHT, offset: ACTUAL_HEIGHT * index, index })}
        onEndReached={() => { if (data?.hasMore) setPage(p => p + 1); }}
        onEndReachedThreshold={2}
        ListEmptyComponent={<View style={[styles.loadingContainer, { height: ACTUAL_HEIGHT }]}><Text style={{ color: '#fff' }}>No Reels found</Text></View>}
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
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 350 }, // Increased height for better visibility
  centerHeart: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  rightActions: { position: 'absolute', right: 10, zIndex: 20, alignItems: 'center', gap: 20 },
  actionBtn: { alignItems: 'center' },
  actionText: { color: '#fff', marginTop: 6, fontSize: 13, fontWeight: '600' },
  bottomInfo: { position: 'absolute', left: 16, right: 80, zIndex: 20 },
  
  // Channel Styles
  channelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, justifyContent: 'space-between', width: '100%' },
  channelInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#fff', marginRight: 10 },
  channelName: { color: '#fff', fontWeight: '700', fontSize: 16, marginRight: 6 },
  verifiedBadge: { backgroundColor: Colors.primary, borderRadius: 10, width: 14, height: 14, justifyContent: 'center', alignItems: 'center' },
  verifiedText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  
  // Subscribe Button
  subscribeBtn: { backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 10 },
  subscribedBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  subscribeText: { color: '#000', fontSize: 13, fontWeight: '700' },
  subscribedText: { color: '#fff' },

  caption: { color: '#fff', fontSize: 14, lineHeight: 20, marginBottom: 10 },
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  musicText: { color: '#fff', fontSize: 13 },
});
