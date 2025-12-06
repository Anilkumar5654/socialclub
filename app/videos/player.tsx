// VideoPlayerScreen.tsx

import { Video as ExpoVideo, ResizeMode } from 'expo-av';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
  ActivityIndicator, Share, StatusBar, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { formatTimeAgo } from '@/constants/timeFormat';
import { api, MEDIA_BASE_URL } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext'; 
import { getDeviceId } from '@/utils/deviceId'; 

// REMOVED: import VideoController from '@/components/video/VideoController'; 
import VideoActions from '@/components/video/VideoActions'; 
import VideoModals from '@/components/video/VideoModals'; 
import RecommendedVideos from '@/components/video/RecommendedVideos'; 

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- HELPERS (Minimal) ---

const getMediaUrl = (path: string | undefined) => {
  if (!path) return '';
  return path.startsWith('http') ? path : `${MEDIA_BASE_URL}/${path}`;
};

const formatViews = (views: number | undefined | null) => {
  const safeViews = Number(views) || 0;
  if (safeViews >= 1000000) return `${(safeViews / 1000000).toFixed(1)}M`;
  if (safeViews >= 1000) return `${(safeViews / 1000).toFixed(1)}K`;
  return safeViews.toString();
};


// --- MAIN PLAYER SCREEN ---

export default function VideoPlayerScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const insets = useSafeAreaInsets();
  const videoRef = useRef<ExpoVideo>(null);
  const { user } = useAuth();

  // Player State (Minimized - only what's absolutely needed)
  const [videoDuration, setVideoDuration] = useState(0); 
  const [totalDurationSec, setTotalDurationSec] = useState(0); 
  // Video will always attempt to play (isPlaying assumed true)
  const isPlaying = true; 
  
  // Controls/Seeking States REMOVED: isPlaying, showControls, isFullscreen, isSeeking, seekPosition, etc.
  
  // Watch Time Tracking (Minimal)
  const watchTimeTracker = useRef({ startTime: Date.now(), totalWatched: 0 }); 
  const watchTimeInterval = useRef<NodeJS.Timeout | null>(null);

  // Content/Action Logic States (Kept as they are not playback controls)
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showDescription, setShowDescription] = useState(false); 
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showCustomToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000); 
  };

  // Data Fetching (Kept)
  const { data: videoData, isLoading } = useQuery({ queryKey: ['video-details', videoId], queryFn: () => api.videos.getDetails(videoId!), enabled: !!videoId });
  const { data: recData } = useQuery({ queryKey: ['video-rec', videoId], queryFn: () => api.videos.getRecommended(videoId!), enabled: !!videoId });
  const { data: commentsData, refetch: refetchComments } = useQuery({ queryKey: ['video-comments', videoId], queryFn: () => api.videos.getComments(videoId!, 1), enabled: !!videoId });
  
  const video = videoData?.video; 
  const recommended = recData?.videos || [];
  const comments = commentsData?.comments || [];

  // Mutations (Kept)
  const likeMutation = useMutation({ mutationFn: () => isLiked ? api.videos.unlike(videoId!) : api.videos.like(videoId!), onSuccess: (data) => { setIsLiked(data.isLiked); setLikesCount(data.likes); if(data.isLiked && isDisliked) { setIsDisliked(false); } }});
  const dislikeMutation = useMutation({ mutationFn: () => isDisliked ? api.videos.undislike(videoId!) : api.videos.dislike(videoId!), onSuccess: (data) => { setIsDisliked(data.isDisliked); if(data.isDisliked && isLiked) { setIsLiked(false); setLikesCount(prev => Math.max(0, prev - 1)); } }});
  const subscribeMutation = useMutation({ mutationFn: () => api.channels[isSubscribed ? 'unsubscribe' : 'subscribe'](video?.channel?.id!), onSuccess: () => setIsSubscribed(!isSubscribed) });
  const commentMutation = useMutation({ mutationFn: (txt: string) => api.videos.comment(videoId!, txt), onSuccess: () => { setCommentText(''); refetchComments(); showCustomToast('Comment posted!'); } });
  const reportMutation = useMutation({ mutationFn: () => api.videos.report(videoId!, 'Inappropriate'), onSuccess: () => { showCustomToast('Thanks for reporting! We will review this video shortly.'); } });
  const deleteMutation = useMutation({ mutationFn: () => api.videos.delete(videoId!), onSuccess: () => { showCustomToast('Video has been successfully deleted.'); router.back(); } });
  const saveMutation = useMutation({ mutationFn: () => api.videos.save(videoId!), onSuccess: (data) => { const message = data.isSaved ? 'Video saved to your library!' : 'Video removed from library.'; showCustomToast(message); } });


  // --- HANDLERS (Only Content Actions Kept) ---
  const handleLike = () => { likeMutation.mutate(); };
  const handleDislike = () => { dislikeMutation.mutate(); }; 
  const handleShare = async () => {
    api.videos.share(videoId!);
    try { await Share.share({ message: `Check this video: https://moviedbr.com/video/${videoId}` }); } catch {}
  };
  const handleReport = () => { Alert.alert('Confirm Report', 'Are you sure you want to report this video for inappropriate content?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Report', style: 'destructive', onPress: () => reportMutation.mutate() }]); };
  const handleDelete = () => { Alert.alert('Delete', 'Are you sure you want to delete this video?', [{text:'Cancel'}, {text:'Delete', style:'destructive', onPress:()=> deleteMutation.mutate() }]); };
  const handleSave = () => { saveMutation.mutate(); }
  
  // Playback control handlers REMOVED: seekVideo, handleSeekStart, handleSeekEnd, etc.

  // Simplified Navigation
  const goBack = () => { router.back(); }; 

  // Watch Time Tracking (Robust)
  const trackVideoWatch = useCallback(async (watchedSec: number) => {
    if (videoId && watchedSec > 1) {
      const completionRate = Math.min(1, watchedSec / (totalDurationSec || 1)); 
      getDeviceId().then(deviceId => {
        api.videos.trackWatch(videoId, watchedSec, completionRate);
      });
    }
  }, [videoId, totalDurationSec]);

  // INTERVAL SETUP & CLEANUP
  useEffect(() => {
    if (video) {
        setTotalDurationSec((video.duration_sec || 0));
        watchTimeTracker.current.startTime = Date.now();
        
        // Start tracking interval every 10 seconds
        watchTimeInterval.current = setInterval(() => {
            // isPlaying is always true, so it always tracks.
            const now = Date.now();
            const elapsedSec = (now - watchTimeTracker.current.startTime) / 1000;
            watchTimeTracker.current.totalWatched += elapsedSec;
            trackVideoWatch(watchTimeTracker.current.totalWatched);
            watchTimeTracker.current.startTime = now; 
        }, 10000); // Report every 10s
    }

    // MEMORY LEAK CLEANUP: Clear interval
    return () => {
        if (watchTimeInterval.current) clearInterval(watchTimeInterval.current);

        if (watchTimeTracker.current.totalWatched > 0) {
            trackVideoWatch(watchTimeTracker.current.totalWatched);
        }
    };
  }, [videoId, video, trackVideoWatch]);


  // Null Check
  if (isLoading || !video || !video.channel) { 
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const videoUrl = getMediaUrl(video.video_url);
  const thumbnailUrl = getMediaUrl(video.thumbnail_url); 
  
  // Robust Channel Data Access
  const channelName = video.channel.name || 'Channel Name'; 
  const channelAvatar = getMediaUrl(video.channel.avatar || 'assets/c_profile.jpg');
  const subscriberCount = video.channel.subscribers_count || 0;
  const viewsDisplay = formatViews(video.views_count);
  const isOwner = video.user.id === user?.id; 

  // NOTE: isFullscreen state is REMOVED, so we only use the standard container style.
  const isFullscreen = false;


  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      <Stack.Screen options={{ headerShown: false }} /> 
      
      <StatusBar barStyle="light-content" />

      {/* PLAYER AREA - NO CONTROLS OVERLAY */}
      <View style={styles.playerContainer}>
        <ExpoVideo
          key={videoId} 
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.video}
          // The video will fill the container, but controls are disabled
          resizeMode={ResizeMode.CONTAIN} 
          shouldPlay={true} // Always try to play
          useNativeControls={false} // Custom control layer is now empty
          
          usePoster={true} 
          posterSource={{ uri: thumbnailUrl }}
          posterStyle={StyleSheet.absoluteFillObject}
          
          onPlaybackStatusUpdate={status => {
             if (status.isLoaded) {
                 setVideoDuration(status.durationMillis || 0);
                 
                 if (status.didJustFinish) { 
                    // Video finished, can't play again without controls, so just stops.
                 }
             }
          }}
          onError={(e) => console.log('CRITICAL EXPO VIDEO ERROR:', e)}
        />
        
        {/* VIDEO CONTROLLER COMPONENT RENDER REMOVED */}
        
      </View>

      {/* SCROLLABLE CONTENT */}
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 1. Title & Views */}
        <View style={styles.infoSection}>
            <Text style={styles.title}>{video.title}</Text>
            <Text style={styles.meta}>{viewsDisplay} views · {formatTimeAgo(video.created_at)}</Text>
        </View>

        {/* 2. CHANNEL ROW */}
        <TouchableOpacity style={styles.channelRow} onPress={() => router.push({ pathname: '/channel/[channelId]', params: { channelId: video.channel.id } })}>
            <View style={{flexDirection:'row', alignItems:'center', flex:1}}>
                <Image source={{ uri: channelAvatar }} style={styles.channelAvatar} />
                <View>
                    <Text style={styles.channelName}>{channelName}</Text>
                    <Text style={styles.subsText}>{formatViews(subscriberCount)} subscribers</Text>
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

        {/* 3. VIDEO ACTIONS ROW (Extracted Component) */}
        <VideoActions 
            likesCount={likesCount}
            isLiked={isLiked}
            isDisliked={isDisliked}
            handleLike={handleLike}
            handleDislike={handleDislike}
            handleShare={handleShare}
            setShowComments={setShowComments}
            setShowMenu={setShowMenu}
        />

        {/* 4. DESCRIPTION TEASER */}
        <TouchableOpacity style={styles.descContainerCard} onPress={() => setShowDescription(true)}>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:4}}>
                <Text style={styles.commentsHeader}>Description</Text>
                <ChevronDown size={18} color={Colors.textSecondary} />
            </View>
            <Text numberOfLines={2} style={styles.descTextCard}>
                {video.description || 'No description provided.'}
            </Text>
        </TouchableOpacity>

        {/* 5. COMMENTS TEASER */}
        <TouchableOpacity style={styles.commentsTeaser} onPress={() => setShowComments(true)}>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:8}}>
                <Text style={styles.commentsHeader}>Comments</Text>
                <Text style={styles.commentsCount}>{comments.length}</Text>
            </View>
            {comments.length > 0 ? (
                <View style={{flexDirection:'row', alignItems:'center', gap:10}}>
                    <Image source={{ uri: getMediaUrl(comments[0].user.avatar) }} style={{width:24, height:24, borderRadius:12}} />
                    <Text numberOfLines={1} style={{color:Colors.text, fontSize:13, flex:1}}>{comments[0].content}</Text>
                </View>
            ) : (
                <Text style={styles.commentsCount}>Add a public comment...</Text>
            )}
        </TouchableOpacity>

        {/* 6. RECOMMENDED VIDEOS (Extracted Component) */}
        <RecommendedVideos recommended={recommended} />
      </ScrollView>

      {/* --- RENDER MODALS (Extracted Component) --- */}
      <VideoModals 
        videoTitle={video.title}
        viewsDisplay={viewsDisplay}
        videoCreatedAt={video.created_at}
        videoDescription={video.description}
        comments={comments}
        commentText={commentText}
        setCommentText={setCommentText}
        commentMutation={() => commentMutation.mutate(commentText)}
        showComments={showComments}
        showDescription={showDescription}
        setShowComments={setShowComments}
        setShowDescription={setShowDescription}
        showMenu={showMenu}
        setShowMenu={setShowMenu}
        isOwner={isOwner}
        handleDelete={() => handleDelete()}
        handleReport={() => handleReport()}
        handleSave={() => handleSave()}
      />
      
      {/* <<< CUSTOM TOAST COMPONENT >>> */}
      {showToast && (
           <View style={styles.customToast}>
               <Text style={styles.customToastText}>{toastMessage}</Text>
           </View>
      )}


    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center', flex: 1 },
  
  // Player
  playerContainer: { width: SCREEN_WIDTH, aspectRatio: 16/9, backgroundColor: '#000' },
  // playerContainerFull style REMOVED
  
  video: { width: '100%', height: '100%' },
  
  // Content
  scrollContent: { flex: 1 },
  infoSection: { padding: 12, paddingBottom: 0 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 6, lineHeight: 24 },
  meta: { fontSize: 12, color: Colors.textSecondary },
  
  // Description Teaser
  descContainerCard: { padding: 12, backgroundColor: '#1a1a1a', marginHorizontal: 12, marginTop: 8, marginBottom: 12, borderRadius: 10 },
  descTextCard: { fontSize: 13, color: Colors.text, flex: 1, lineHeight: 18 },

  // Channel
  channelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#222' },
  channelAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: '#333' },
  channelName: { color: Colors.text, fontWeight: '700', fontSize: 15 },
  subsText: { color: Colors.textSecondary, fontSize: 12 },
  subBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  subBtnActive: { backgroundColor: '#333', borderWidth: 1, borderColor: '#444' },
  subText: { color: '#000', fontWeight: '600', fontSize: 13 },
  subTextActive: { color: '#fff' },

  // Comments Teaser
  commentsTeaser: { padding: 12, backgroundColor: '#1a1a1a', marginHorizontal: 12, marginBottom: 12, borderRadius: 10 },
  commentsHeader: { color: Colors.text, fontWeight: '700', fontSize: 14 },
  commentsCount: { color: Colors.textSecondary },

  // Recommended Cards 
  recSection: { paddingBottom: 40 },
  recCard: { marginBottom: 16 },
  recThumbContainer: { width: SCREEN_WIDTH, aspectRatio: 16/9, backgroundColor: '#222' },
  recThumb: { width: '100%', height: '100%' },
  recDuration: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  recDurationText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  recInfo: { flexDirection: 'row', padding: 12, gap: 12 },
  recAvatar: { width: 36, height: 36, borderRadius: 18 },
  recTextCol: { flex: 1, gap: 4 },
  recTitle: { color: Colors.text, fontSize: 15, fontWeight: '500', lineHeight: 20 },
  recMeta: { color: Colors.textSecondary, fontSize: 12 },
  
  // Custom Toast Styles
  customToast: {
    position: 'absolute',
    bottom: 50, 
    alignSelf: 'center',
    backgroundColor: Colors.primary, 
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 9999,
  },
  customToastText: {
    color: '#000', 
    fontWeight: '600',
    fontSize: 14,
  },
});
