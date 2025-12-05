import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, FlatList,
  TextInput, ActivityIndicator, Share, Modal, StatusBar, Pressable, Platform
} from 'react-native';
import { Video as ExpoVideo, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  ThumbsUp, ThumbsDown, Share2, MessageCircle, Send, ChevronDown,
  Play, Pause, Maximize, ArrowLeft, MoreVertical, Download
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { formatTimeAgo } from '@/constants/timeFormat';
import { api, MEDIA_BASE_URL } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- HELPERS ---

const getMediaUrl = (path: string | undefined) => {
  if (!path) return '';
  return path.startsWith('http') ? path : `${MEDIA_BASE_URL}/${path}`;
};

const formatViews = (views: number) => {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
};

// FIX: Correct Duration Format (MM:SS)
const formatDuration = (seconds: any) => {
    const sec = Number(seconds);
    if (!sec || isNaN(sec)) return "00:00";
    
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// --- COMPONENTS ---

const RecommendedVideoCard = ({ video, onPress }: { video: any; onPress: () => void }) => {
  const channelName = video.channel_name || video.user?.channel_name || 'Channel';
  const channelAvatar = getMediaUrl(video.channel_avatar || video.user?.avatar || 'assets/c_profile.jpg');
  
  return (
    <TouchableOpacity style={styles.recCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.recThumbContainer}>
        <Image source={{ uri: getMediaUrl(video.thumbnail_url) }} style={styles.recThumb} contentFit="cover" />
        {/* DURATION BADGE FIX */}
        <View style={styles.recDuration}>
            <Text style={styles.recDurationText}>{formatDuration(video.duration)}</Text>
        </View>
      </View>
      <View style={styles.recInfo}>
        <Image source={{ uri: channelAvatar }} style={styles.recAvatar} />
        <View style={styles.recTextCol}>
          <Text style={styles.recTitle} numberOfLines={2}>{video.title}</Text>
          <Text style={styles.recMeta} numberOfLines={1}>
            {channelName} · {formatViews(video.views_count || 0)} views · {formatTimeAgo(video.created_at)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// --- MAIN PLAYER SCREEN ---

export default function VideoPlayerScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const videoRef = useRef<ExpoVideo>(null);
  const { user } = useAuth();

  // Player State
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const [videoDuration, setVideoDuration] = useState(0); // In MS for progress bar
  const [currentPosition, setCurrentPosition] = useState(0); // In MS
  const [totalDurationSec, setTotalDurationSec] = useState(0); // In Sec for API

  // Logic State
  const startTimeRef = useRef<number>(Date.now());
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  
  // Comments Modal
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');

  // 1. Fetch Video Details
  const { data: videoData, isLoading } = useQuery({
    queryKey: ['video-details', videoId],
    queryFn: () => api.videos.getDetails(videoId!),
    enabled: !!videoId
  });
  const video = videoData?.video;

  // 2. Fetch Recommended
  const { data: recData } = useQuery({
    queryKey: ['video-rec', videoId],
    queryFn: () => api.videos.getRecommended(videoId!),
    enabled: !!videoId
  });
  const recommended = recData?.videos || [];

  // 3. Fetch Comments
  const { data: commentsData, refetch: refetchComments } = useQuery({
    queryKey: ['video-comments', videoId],
    queryFn: () => api.videos.getComments(videoId!, 1),
    enabled: !!videoId
  });
  const comments = commentsData?.comments || [];

  // Initialize State
  useEffect(() => {
    if (video) {
      setLikesCount(video.likes_count || 0);
      setIsLiked(!!video.is_liked);
      setIsSubscribed(!!video.is_subscribed);
      setTotalDurationSec(Number(video.duration) || 0);
    }
  }, [video]);

  // View Counter (Once per load)
  useEffect(() => {
    if (videoId) api.videos.view(videoId);
  }, [videoId]);

  // Viral Logic: Watch Time Tracker
  useEffect(() => {
    startTimeRef.current = Date.now();
    
    return () => {
        // On Unmount / Change Video
        const endTime = Date.now();
        const watchedSec = (endTime - startTimeRef.current) / 1000;
        if (videoId && watchedSec > 1) {
            api.videos.trackWatch(videoId, watchedSec, totalDurationSec);
        }
    };
  }, [videoId, totalDurationSec]);

  // Controls Logic
  useEffect(() => {
    if (showControls && isPlaying) {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    }
    return () => { if (controlsTimeout.current) clearTimeout(controlsTimeout.current); };
  }, [showControls, isPlaying]);

  // Mutations
  const likeMutation = useMutation({
    mutationFn: () => isLiked ? api.videos.unlike(videoId!) : api.videos.like(videoId!),
    onSuccess: (data) => { setIsLiked(data.isLiked); setLikesCount(data.likes); }
  });

  const subscribeMutation = useMutation({
    mutationFn: () => isSubscribed ? api.channels.unsubscribe(video.channel_id) : api.channels.subscribe(video.channel_id),
    onSuccess: () => setIsSubscribed(!isSubscribed)
  });

  const commentMutation = useMutation({
    mutationFn: (txt: string) => api.videos.comment(videoId!, txt),
    onSuccess: () => { setCommentText(''); refetchComments(); }
  });

  // Handlers
  const togglePlayPause = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
      setIsPlaying(false);
      setShowControls(true);
    } else {
      await videoRef.current.playAsync();
      setIsPlaying(true);
    }
  };

  const handleShare = async () => {
    api.videos.share(videoId!);
    try { await Share.share({ message: `Check this video: https://moviedbr.com/video/${videoId}` }); } catch {}
  };

  if (isLoading || !video) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const videoUrl = getMediaUrl(video.video_url);
  const channelName = video.channel_name || 'Channel Name';
  const channelAvatar = getMediaUrl(video.channel_avatar || 'assets/c_profile.jpg');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* --- PLAYER AREA --- */}
      <View style={styles.playerContainer}>
        <ExpoVideo
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={isPlaying}
          useNativeControls={false}
          onPlaybackStatusUpdate={status => {
             if (status.isLoaded) {
                 setVideoDuration(status.durationMillis || 0);
                 setCurrentPosition(status.positionMillis);
                 if (status.didJustFinish) { setIsPlaying(false); setShowControls(true); }
             }
          }}
        />
        
        {/* OVERLAY CONTROLS */}
        <Pressable style={styles.overlay} onPress={() => setShowControls(!showControls)}>
          {showControls && (
            <View style={styles.controls}>
              <View style={styles.topControlBar}>
                 <TouchableOpacity onPress={() => router.back()}><ArrowLeft color="white" size={24} /></TouchableOpacity>
              </View>

              <TouchableOpacity onPress={togglePlayPause} style={styles.playBtn}>
                {isPlaying ? <Pause color="white" size={48} fill="white" /> : <Play color="white" size={48} fill="white" />}
              </TouchableOpacity>

              <View style={styles.bottomControlBar}>
                <Text style={styles.timeText}>{formatDuration(currentPosition/1000)} / {formatDuration(videoDuration/1000)}</Text>
                <View style={styles.progressBarBg}>
                   <View style={[styles.progressBarFill, { width: `${(currentPosition / (videoDuration || 1)) * 100}%` }]} />
                </View>
                <Maximize color="white" size={20} style={{marginLeft: 10}}/>
              </View>
            </View>
          )}
        </Pressable>
      </View>

      {/* --- SCROLLABLE CONTENT --- */}
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 1. Title & Views */}
        <View style={styles.infoSection}>
            <Text style={styles.title}>{video.title}</Text>
            <Text style={styles.meta}>{formatViews(video.views_count)} views · {formatTimeAgo(video.created_at)}</Text>
        </View>

        {/* 2. CHANNEL ROW */}
        <TouchableOpacity style={styles.channelRow} onPress={() => router.push({ pathname: '/channel/[channelId]', params: { channelId: video.channel_id } })}>
            <View style={{flexDirection:'row', alignItems:'center', flex:1}}>
                <Image source={{ uri: channelAvatar }} style={styles.channelAvatar} />
                <View>
                    <Text style={styles.channelName}>{channelName}</Text>
                    <Text style={styles.subsText}>{formatViews(video.subscribers_count || 0)} subscribers</Text>
                </View>
            </View>
            <TouchableOpacity 
                style={[styles.subBtn, isSubscribed && styles.subBtnActive]} 
                onPress={() => subscribeMutation.mutate()}
            >
                <Text style={[styles.subText, isSubscribed && styles.subTextActive]}>
                    {isSubscribed ? 'Subscribed' : 'Subscribe'}
                </Text>
            </TouchableOpacity>
        </TouchableOpacity>

        {/* 3. ACTIONS (LIKE/DISLIKE/SHARE/DOWNLOAD) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsScroll}>
            
            {/* LIKE (Pill Shape with Text) */}
            <TouchableOpacity style={[styles.actionPillLike, isLiked && {backgroundColor: 'rgba(225, 48, 108, 0.15)'}]} onPress={() => likeMutation.mutate()}>
                <ThumbsUp size={20} color={isLiked ? Colors.primary : Colors.text} fill={isLiked ? Colors.primary : "transparent"} />
                <View style={styles.separator} />
                <Text style={[styles.actionTextLike, isLiked && {color: Colors.primary}]}>{formatViews(likesCount)}</Text>
            </TouchableOpacity>

            {/* OTHER BUTTONS (Round Icons) */}
            <TouchableOpacity style={styles.iconBtnRound} onPress={() => {/* Dislike Logic */}}>
                <ThumbsDown size={20} color={Colors.text} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtnRound} onPress={handleShare}>
                <Share2 size={20} color={Colors.text} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtnRound} onPress={() => setShowComments(true)}>
                <MessageCircle size={20} color={Colors.text} />
            </TouchableOpacity>

             <TouchableOpacity style={styles.iconBtnRound} onPress={() => { Alert.alert("Download", "Starting download...") }}>
                <Download size={20} color={Colors.text} />
            </TouchableOpacity>
        </ScrollView>

        {/* 4. DESCRIPTION EXPANDER */}
        <TouchableOpacity style={styles.descContainer} onPress={() => setShowFullDesc(!showFullDesc)}>
             <Text numberOfLines={showFullDesc ? undefined : 2} style={styles.descText}>
                {video.description || 'No description'}
             </Text>
             <Text style={styles.moreText}>{showFullDesc ? 'Show less' : 'Show more'}</Text>
        </TouchableOpacity>

        {/* 5. COMMENTS TEASER */}
        <TouchableOpacity style={styles.commentsTeaser} onPress={() => setShowComments(true)}>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:8}}>
                <Text style={styles.commentsHeader}>Comments {comments.length}</Text>
                <ChevronDown size={16} color="#666" />
            </View>
            {comments.length > 0 ? (
                <View style={{flexDirection:'row', alignItems:'center', gap:10}}>
                    <Image source={{ uri: getMediaUrl(comments[0].user.avatar) }} style={{width:24, height:24, borderRadius:12}} />
                    <Text numberOfLines={1} style={{color:Colors.text, fontSize:13, flex:1}}>{comments[0].content}</Text>
                </View>
            ) : (
                <Text style={{color:Colors.textSecondary, fontSize:13}}>Add a public comment...</Text>
            )}
        </TouchableOpacity>

        {/* 6. RECOMMENDED VIDEOS */}
        <View style={styles.recSection}>
            {recommended.map((item: any) => (
                <RecommendedVideoCard 
                    key={item.id} 
                    video={item} 
                    onPress={() => router.push({ pathname: '/videos/player', params: { videoId: item.id } })} 
                />
            ))}
        </View>
      </ScrollView>

      {/* --- COMMENTS MODAL --- */}
      <Modal visible={showComments} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowComments(false)}>
         <View style={styles.modalContainer}>
             <View style={styles.modalHeader}>
                 <Text style={styles.modalTitle}>Comments</Text>
                 <TouchableOpacity onPress={() => setShowComments(false)}><Text style={{fontWeight:'600', fontSize:16}}>Close</Text></TouchableOpacity>
             </View>
             <FlatList 
                data={comments} 
                keyExtractor={i => i.id} 
                renderItem={({item}) => (
                    <View style={styles.commentItem}>
                        <Image source={{ uri: getMediaUrl(item.user.avatar) }} style={styles.commentAvatar} />
                        <View style={{flex:1}}>
                            <Text style={styles.commentUser}>{item.user.username} · <Text style={{fontWeight:'400', color:'#666', fontSize:12}}>{formatTimeAgo(item.created_at)}</Text></Text>
                            <Text style={styles.commentBody}>{item.content}</Text>
                        </View>
                    </View>
                )} 
             />
             <View style={styles.inputArea}>
                 <TextInput style={styles.input} placeholder="Add a comment..." value={commentText} onChangeText={setCommentText} />
                 <TouchableOpacity onPress={() => commentText.trim() && commentMutation.mutate(commentText)}><Send color={Colors.primary} /></TouchableOpacity>
             </View>
         </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center', flex: 1 },
  
  // Player
  playerContainer: { width: SCREEN_WIDTH, aspectRatio: 16/9, backgroundColor: '#000' },
  video: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  controls: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'space-between' },
  topControlBar: { flexDirection: 'row', padding: 10, paddingTop: 40 },
  playBtn: { alignSelf: 'center' },
  bottomControlBar: { flexDirection: 'row', alignItems: 'center', padding: 10, paddingBottom: 10 },
  timeText: { color: '#fff', fontSize: 12, marginRight: 10, fontWeight: '600' },
  progressBarBg: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },

  // Content
  scrollContent: { flex: 1 },
  infoSection: { padding: 12, paddingBottom: 0 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 6, lineHeight: 24 },
  meta: { fontSize: 12, color: Colors.textSecondary },
  
  // Channel
  channelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  channelAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: '#333' },
  channelName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  subsText: { color: Colors.textSecondary, fontSize: 12 },
  subBtn: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  subBtnActive: { backgroundColor: '#333', borderWidth: 1, borderColor: '#444' },
  subText: { color: '#000', fontWeight: '600', fontSize: 13 },
  subTextActive: { color: '#fff' },

  // Actions Row (New Design)
  actionsScroll: { paddingHorizontal: 12, paddingVertical: 12, gap: 12 },
  
  // Like Pill Button
  actionPillLike: { 
      flexDirection: 'row', alignItems: 'center', 
      backgroundColor: '#222', 
      paddingHorizontal: 16, paddingVertical: 10, 
      borderRadius: 24, 
      gap: 10 
  },
  separator: { width: 1, height: 18, backgroundColor: '#444' },
  actionTextLike: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Round Buttons for others
  iconBtnRound: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: '#222',
      justifyContent: 'center', alignItems: 'center'
  },

  // Description
  descContainer: { padding: 12, backgroundColor: '#1a1a1a', marginHorizontal: 12, borderRadius: 8, marginTop: 4 },
  descText: { fontSize: 13, color: Colors.text, lineHeight: 18 },
  moreText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginTop: 4 },

  // Comments Teaser
  commentsTeaser: { padding: 12, backgroundColor: '#1a1a1a', margin: 12, marginTop: 8, borderRadius: 10 },
  commentsHeader: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Recommended Cards
  recSection: { paddingBottom: 40 },
  recCard: { marginBottom: 16 },
  recThumbContainer: { width: SCREEN_WIDTH, height: 220, backgroundColor: '#222' },
  recThumb: { width: '100%', height: '100%' },
  recDuration: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  recDurationText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  recInfo: { flexDirection: 'row', padding: 12, gap: 12 },
  recAvatar: { width: 36, height: 36, borderRadius: 18 },
  recTextCol: { flex: 1, gap: 4 },
  recTitle: { color: '#fff', fontSize: 15, fontWeight: '500', lineHeight: 20 },
  recMeta: { color: Colors.textSecondary, fontSize: 12 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#eee', alignItems:'center' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  inputArea: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderColor: '#eee', alignItems: 'center', paddingBottom: 30 },
  input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, padding: 10, marginRight: 10 },
  commentItem: { flexDirection: 'row', padding: 16, gap: 12 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16 },
  commentUser: { fontWeight: '700', fontSize: 13, marginBottom: 2 },
  commentBody: { fontSize: 14, color: '#333' }
});
