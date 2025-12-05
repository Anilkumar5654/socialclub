import { Video as ExpoVideo, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  ThumbsUp, ThumbsDown, Share2, MessageCircle, Send, ChevronDown,
  Play, Pause, Maximize, ArrowLeft, MoreVertical, Download, X,
  Save, Flag, Trash2,
  ArrowBigRight, ArrowBigLeft 
} from 'lucide-react-native';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, FlatList,
  TextInput, ActivityIndicator, Share, Modal, Pressable, StatusBar, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { formatTimeAgo } from '@/constants/timeFormat';
import { api, MEDIA_BASE_URL } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext'; 
import { getDeviceId } from '@/utils/deviceId'; 


const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- HELPERS (NULL-SAFE) ---

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

const formatDuration = (seconds: any) => {
    const sec = Number(seconds) || 0;
    if (sec <= 0) return "00:00";
    
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- RECOMMENDED CARD & OPTIONS MENU MODAL (No Changes) ---
const RecommendedVideoCard = ({ video, onPress }: { video: any; onPress: () => void }) => {
  const channelName = video.channel_name || 'Channel';
  const channelAvatar = getMediaUrl(video.channel_avatar || 'assets/c_profile.jpg');
  
  return (
    <TouchableOpacity style={styles.recCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.recThumbContainer}>
        <Image source={{ uri: getMediaUrl(video.thumbnail_url) }} style={styles.recThumb} contentFit="cover" />
        <View style={styles.recDuration}>
            <Text style={styles.recDurationText}>{formatDuration(video.duration)}</Text>
        </View>
      </View>
      <View style={styles.recInfo}>
        <Image source={{ uri: channelAvatar }} style={styles.recAvatar} />
        <View style={styles.recTextCol}>
          <Text style={styles.recTitle} numberOfLines={2}>{video.title}</Text>
          <Text style={styles.recMeta} numberOfLines={1}>
            {channelName} · {formatViews(video.views_count)} views · {formatTimeAgo(video.created_at)}
          </Text>
        </View>
      </Image>
    </TouchableOpacity>
  );
};

function OptionsMenuModal({ visible, onClose, isOwner, onDelete, onReport, onSave }: any) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={onClose}>
                <View style={styles.menuBox}>
                    <TouchableOpacity style={styles.menuItemNoIcon} onPress={() => { onClose(); onSave(); }}>
                        <Text style={styles.menuText}>Save Video</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItemNoIcon} onPress={() => { onClose(); onReport(); }}>
                        <Text style={styles.menuText}>Report</Text>
                    </TouchableOpacity>
                    {isOwner && (
                        <TouchableOpacity style={[styles.menuItem, styles.menuItemDestructive]} onPress={() => { onClose(); onDelete(); }}>
                            <Trash2 size={20} color="#FF4444" /><Text style={[styles.menuText, { color: '#FF4444' }]}>Delete Video</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.menuItem, styles.menuItemDestructive]} onPress={onClose}>
                        <X size={20} color={Colors.textSecondary} /><Text style={styles.menuText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}


// --- MAIN PLAYER SCREEN ---

export default function VideoPlayerScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const insets = useSafeAreaInsets();
  const videoRef = useRef<ExpoVideo>(null);
  const { user } = useAuth();

  // Player State
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const [videoDuration, setVideoDuration] = useState(0); 
  const [currentPosition, setCurrentPosition] = useState(0); 
  const [totalDurationSec, setTotalDurationSec] = useState(0); 
  
  // Fullscreen & Seeking State
  const [isFullscreen, setIsFullscreen] = useState(false); 
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0); 
  const progressBarRef = useRef<View>(null);
  const progressBarWidth = useRef(0);
  const lastTapTime = useRef(0);
  
  // Seek Feedback State
  const [showSeekIcon, setShowSeekIcon] = useState(false);
  const [seekDirection, setSeekDirection] = useState<'forward' | 'backward'>('forward');
  const seekFeedbackTimeout = useRef<NodeJS.Timeout | null>(null);
  

  // Logic & UI State
  const startTimeRef = useRef<number>(Date.now());
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


  // Data Fetching 
  const { data: videoData, isLoading } = useQuery({ queryKey: ['video-details', videoId], queryFn: () => api.videos.getDetails(videoId!), enabled: !!videoId });
  const { data: recData } = useQuery({ queryKey: ['video-rec', videoId], queryFn: () => api.videos.getRecommended(videoId!), enabled: !!videoId });
  const { data: commentsData, refetch: refetchComments } = useQuery({ queryKey: ['video-comments', videoId], queryFn: () => api.videos.getComments(videoId!, 1), enabled: !!videoId });
  
  const video = videoData?.video; 
  const recommended = recData?.videos || [];
  const comments = commentsData?.comments || [];

  // Watch Time Tracker
  const trackVideoWatch = useCallback(async (watchedSec: number) => {
    if (videoId && watchedSec > 1) {
      const completionRate = Math.min(1, watchedSec / (totalDurationSec || 1)); 
      api.videos.trackWatch(videoId, watchedSec, completionRate); 
    }
  }, [videoId, totalDurationSec]);

  // Effects
  useEffect(() => {
    if (video) {
      setLikesCount(video.likes_count || 0);
      setIsLiked(!!video.isLiked);
      setIsSubscribed(!!video.isSubscribed);
      setTotalDurationSec(Number(video.duration) || 0);
      setIsPlaying(true); 
      // Play immediately on load
      if (videoRef.current) { videoRef.current.playAsync().catch(e => console.log("Play command skipped or failed on load:", e)); }
    }
  }, [video]);

  useEffect(() => {
    if (videoId) api.videos.view(videoId); 
    startTimeRef.current = Date.now();
    return () => {
        const watchedSec = (Date.now() - startTimeRef.current) / 1000;
        trackVideoWatch(watchedSec);
        if (videoRef.current) { videoRef.current.unloadAsync(); }
    };
  }, [videoId, totalDurationSec]);

  // Controls Auto-Hide
  useEffect(() => {
    if (showControls && isPlaying && !isSeeking) { 
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    }
    return () => { if (controlsTimeout.current) clearTimeout(controlsTimeout.current); };
  }, [showControls, isPlaying, isSeeking]);


  // Mutations (No Changes)
  const likeMutation = useMutation({ mutationFn: () => isLiked ? api.videos.unlike(videoId!) : api.videos.like(videoId!), onSuccess: (data) => { setIsLiked(data.isLiked); setLikesCount(data.likes); if(data.isLiked && isDisliked) { setIsDisliked(false); } }});
  const dislikeMutation = useMutation({ mutationFn: () => isDisliked ? api.videos.undislike(videoId!) : api.videos.dislike(videoId!), onSuccess: (data) => { setIsDisliked(data.isDisliked); if(data.isDisliked && isLiked) { setIsLiked(false); setLikesCount(prev => Math.max(0, prev - 1)); } }});
  const subscribeMutation = useMutation({ mutationFn: () => api.channels[isSubscribed ? 'unsubscribe' : 'subscribe'](video?.channel?.id!), onSuccess: () => setIsSubscribed(!isSubscribed) });
  const commentMutation = useMutation({ mutationFn: (txt: string) => api.videos.comment(videoId!, txt), onSuccess: () => { setCommentText(''); refetchComments(); showCustomToast('Comment posted!'); } });
  const reportMutation = useMutation({ mutationFn: () => api.videos.report(videoId!, 'Inappropriate'), onSuccess: () => { showCustomToast('Thanks for reporting! We will review this video shortly.'); } });
  const deleteMutation = useMutation({ mutationFn: () => api.videos.delete(videoId!), onSuccess: () => { showCustomToast('Video has been successfully deleted.'); router.back(); } });
  const saveMutation = useMutation({ mutationFn: () => api.videos.save(videoId!), onSuccess: (data) => { const message = data.isSaved ? 'Video saved to your library!' : 'Video removed from library.'; showCustomToast(message); } });


  // --- SEEKING & CONTROL FIXES (UPDATED FOR LIVE SEEKING) ---

  // Seek feedback display function
  const displaySeekFeedback = (direction: 'forward' | 'backward') => {
      if (seekFeedbackTimeout.current) clearTimeout(seekFeedbackTimeout.current);
      setSeekDirection(direction);
      setShowSeekIcon(true);
      seekFeedbackTimeout.current = setTimeout(() => {
          setShowSeekIcon(false);
      }, 500);
  };
  
  // Seek Video by X seconds (used by double-tap)
  const seekVideo = useCallback(async (amount: number) => {
    if (!videoRef.current) return;
    
    const status = await videoRef.current.getStatusAsync();
    const currentPosMillis = status.positionMillis || currentPosition;
    
    const newPosition = currentPosMillis + amount * 1000;
    const maxDuration = videoDuration;
    
    const finalPosition = Math.min(Math.max(0, newPosition), maxDuration);

    try {
      await videoRef.current.setStatusAsync({ positionMillis: finalPosition });
      setCurrentPosition(finalPosition); 
      // Update seekPosition too so the bar stays at the new position if controls are active
      if (showControls) setSeekPosition(finalPosition);
    } catch (e) {
      console.log('Seek failed:', e);
    }
  }, [currentPosition, videoDuration, showControls]);


  // SEEKING BAR LOGIC (Duration Bar)
  const handleSeek = (x: number) => {
      const barWidth = progressBarWidth.current || SCREEN_WIDTH; 
      const newPositionPercentage = Math.min(1, Math.max(0, x / barWidth));
      const newPositionMillis = videoDuration * newPositionPercentage;
      setSeekPosition(newPositionMillis);
  };

  // 1. handleSeekStart: Remove pauseAsync() and keep video playing.
  const handleSeekStart = (event: any) => { 
      // Set initial seek position for preview (use current position)
      const initialSeekPos = isSeeking ? seekPosition : currentPosition;
      setSeekPosition(initialSeekPos);
      
      setIsSeeking(true);
      handleSeek(event.nativeEvent.locationX);
      
      // *** FIX: REMOVED PAUSE LOGIC ***
      // videoRef.current.pauseAsync(); is removed.
  };

  const handleSeekMove = (event: any) => {
      if (isSeeking) {
          handleSeek(event.nativeEvent.locationX);
      }
  };

  // 2. handleSeekEnd: Only commit the seek, do not touch play/pause state.
  const handleSeekEnd = async () => {
      if (videoRef.current) {
          try {
              // Commit the final seek position
              await videoRef.current.setStatusAsync({ positionMillis: seekPosition });
              
              // *** FIX: REMOVED RESUME LOGIC ***
              
              // Update current position immediately so the bar doesn't jump back
              setCurrentPosition(seekPosition);
              
              // Reset seeking state
              setIsSeeking(false);
              setSeekPosition(0); // Reset preview position
          } catch (e) {
               console.log('Final seek failed:', e);
               setIsSeeking(false);
               setSeekPosition(0);
          }
      }
  };

  const handleLayout = (event: any) => {
      progressBarWidth.current = event.nativeEvent.layout.width;
  };


  // DOUBLE TAP AND SINGLE TAP CONTROL LOGIC
  const handleDoubleTap = (event: any) => {
    const now = Date.now();
    const isDoubleTap = now - lastTapTime.current < 300; 
    
    const tapX = event.nativeEvent.locationX;
    const currentWidth = isFullscreen ? Dimensions.get('window').width : SCREEN_WIDTH; 
    
    const isLeft = tapX < currentWidth * 0.4;
    const isRight = tapX > currentWidth * 0.6;
    
    if (isDoubleTap) {
      if (isLeft) {
        seekVideo(-10); 
        displaySeekFeedback('backward'); 
      } else if (isRight) {
        seekVideo(10); 
        displaySeekFeedback('forward'); 
      }
      
      // Reset tap time and ensure controls are visible briefly
      lastTapTime.current = 0; 
      setShowControls(true); 
      return;
    }
    
    lastTapTime.current = now;
    
    // Single Tap Logic (Fix for control lag)
    setTimeout(() => {
        if (Date.now() - lastTapTime.current >= 300) {
            setShowControls(!showControls);
        }
    }, 300);
  };
  
  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  // Other Handlers (No Changes)
  const togglePlayPause = async () => {
    if (!videoRef.current) return;
    if (isPlaying) { await videoRef.current.pauseAsync(); setIsPlaying(false); setShowControls(true); } 
    else { await videoRef.current.playAsync(); setIsPlaying(true); }
  };
  
  const handleLike = () => { likeMutation.mutate(); };
  const handleDislike = () => { dislikeMutation.mutate(); }; 
  const handleShare = async () => {
    api.videos.share(videoId!);
    try { await Share.share({ message: `Check this video: https://moviedbr.com/video/${videoId}` }); } catch {}
  };
  const handleReport = () => { Alert.alert('Confirm Report', 'Are you sure you want to report this video for inappropriate content?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Report', style: 'destructive', onPress: () => reportMutation.mutate() }]); };
  const handleDelete = () => { Alert.alert('Delete', 'Are you sure you want to delete this video?', [{text:'Cancel'}, {text:'Delete', style:'destructive', onPress:()=> deleteMutation.mutate() }]); };
  const handleSave = () => { saveMutation.mutate(); }


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

  // 3. Live Position for Progress Bar & Time
  const displayPosition = isSeeking && seekPosition > 0 ? seekPosition : currentPosition;
  const progressPercentage = (displayPosition / (videoDuration || 1)) * 100;

  return (
    // FIX 1: paddingTop is only applied when NOT in fullscreen
    <View style={[styles.container, { paddingTop: isFullscreen ? 0 : insets.top }]}>
      
      {/* 1. FIX: Header is removed. */}
      <Stack.Screen options={{ headerShown: false }} /> 
      
      <StatusBar barStyle="light-content" hidden={isFullscreen} />

      {/* PLAYER AREA */}
      <View style={isFullscreen ? styles.playerContainerFull : styles.playerContainer}>
        <ExpoVideo
          key={videoId} 
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={isPlaying}
          useNativeControls={false}
          
          // FIX: Performance (Delay Load) - using Poster
          usePoster={true} 
          posterSource={{ uri: thumbnailUrl }}
          posterStyle={StyleSheet.absoluteFillObject}
          
          onPlaybackStatusUpdate={status => {
             if (status.isLoaded) {
                 setVideoDuration(status.durationMillis || 0);
                 // Only update currentPosition if we are NOT seeking
                 if (!isSeeking) { 
                     setCurrentPosition(status.positionMillis);
                 }
                 if (status.didJustFinish) { setIsPlaying(false); setShowControls(true); trackVideoWatch(totalDurationSec); }
             }
          }}
          onError={(e) => console.log('CRITICAL EXPO VIDEO ERROR:', e)}
        />
        
        {/* 2. SEEK FEEDBACK OVERLAY (Using Lucide Icons) */}
        {showSeekIcon && (
            <View style={styles.seekOverlay}>
                <View style={styles.seekIconContainer}>
                    {seekDirection === 'forward' ? 
                        <ArrowBigRight color="white" size={48} /> 
                        : 
                        <ArrowBigLeft color="white" size={48} /> 
                    }
                    {/* Display the seek amount (10) */}
                    <Text style={styles.seekAmountText}>10</Text>
                </View>
            </View>
        )}
        
        {/* OVERLAY CONTROLS */}
        <Pressable style={styles.overlay} onPress={handleDoubleTap}>
          {showControls && (
            <View style={styles.controls}>
              <View style={[styles.topControlBar, {paddingTop: isFullscreen ? insets.top : 10}]}> 
                 <TouchableOpacity onPress={() => isFullscreen ? toggleFullscreen() : router.back()}><ArrowLeft color="white" size={24} /></TouchableOpacity>
              </View>

              <TouchableOpacity onPress={togglePlayPause} style={styles.playBtn}>
                {isPlaying ? <Pause color="white" size={48} fill="white" /> : <Play color="white" size={48} fill="white" />}
              </TouchableOpacity>

              <View style={styles.bottomControlBar}>
                {/* 4. Live Duration Display */}
                <Text style={styles.timeText}>
                    {formatDuration(displayPosition/1000)} / {formatDuration(videoDuration/1000)}
                </Text>
                
                {/* SEEKING ENABLED PROGRESS BAR */}
                <Pressable
                    ref={progressBarRef}
                    style={styles.progressBarBg}
                    onLayout={handleLayout} 
                    onPressIn={handleSeekStart} 
                    onResponderMove={handleSeekMove} 
                    onResponderRelease={handleSeekEnd} 
                >
                    <View style={styles.progressBarTrack} />
                    {/* ProgressBar Fill tracks the live or current position */}
                    <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
                    {/* 5. Draggable Handle */}
                    <View style={[styles.progressBarHandle, { left: `${progressPercentage}%` }]} />
                </Pressable>
                
                {/* Fullscreen Button */}
                <TouchableOpacity onPress={toggleFullscreen}>
                    <Maximize color="white" size={20} style={{marginLeft: 10}}/>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Pressable>
      </View>

      {/* SCROLLABLE CONTENT - Hide when in fullscreen */}
      {!isFullscreen && (
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

            {/* 3. ACTIONS */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsScroll}>
                
                {/* 1. LIKE/DISLIKE PILL */}
                <View style={styles.actionPill}>
                    <TouchableOpacity style={styles.likeBtn} onPress={handleLike}>
                        <ThumbsUp size={20} color={isLiked ? Colors.primary : Colors.text} fill={isLiked ? Colors.primary : "transparent"} />
                        <Text style={[styles.actionTextLike, isLiked && {color: Colors.primary}]}>{formatViews(likesCount)}</Text>
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    <TouchableOpacity style={styles.dislikeBtn} onPress={handleDislike}>
                        <ThumbsDown size={20} color={isDisliked ? Colors.primary : Colors.text} fill={isDisliked ? Colors.primary : "transparent"} />
                    </TouchableOpacity>
                </View>

                {/* 2. Comment Button */}
                <TouchableOpacity style={styles.iconBtnRound} onPress={() => setShowComments(true)}>
                    <MessageCircle size={20} color={Colors.text} />
                </TouchableOpacity>

                {/* 3. Download Button */}
                <TouchableOpacity style={styles.iconBtnRound} onPress={() => {}}>
                    <Download size={20} color={Colors.text} />
                </TouchableOpacity>

                {/* 4. Share Button */}
                <TouchableOpacity style={styles.iconBtnRound} onPress={handleShare}>
                    <Share2 size={20} color={Colors.text} />
                </TouchableOpacity>

                {/* 5. Menu Button */}
                <TouchableOpacity style={styles.iconBtnRound} onPress={() => { setShowMenu(true) }}>
                    <MoreVertical size={20} color={Colors.text} />
                </TouchableOpacity>
            </ScrollView>

            {/* 4. DESCRIPTION TEASER (NEW STYLED CARD) */}
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

            {/* 6. RECOMMENDED VIDEOS */}
            <View style={styles.recSection}>
                {recommended.map((item: any) => (
                    <RecommendedVideoCard 
                        key={item.id} 
                        video={item} 
                        onPress={() => router.replace({ pathname: '/videos/player', params: { videoId: item.id } })} 
                    />
                ))}
            </View>
        </ScrollView>
      )}

      {/* --- MODALS (Comments & Description) --- */}
      
      <Modal visible={showComments} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowComments(false)}>
         <View style={styles.modalContainer}>
             <View style={styles.modalHeader}>
                 <Text style={styles.modalTitle}>Comments</Text>
                 <TouchableOpacity onPress={() => setShowComments(false)}><X color={Colors.textSecondary} size={24} /></TouchableOpacity>
             </View>
             <FlatList 
                data={comments} 
                keyExtractor={i => i.id} 
                renderItem={({item}) => (
                    <View style={styles.commentItem}>
                        <Image source={{ uri: getMediaUrl(item.user.avatar) }} style={styles.commentAvatar} />
                        <View style={{flex:1}}>
                            <Text style={styles.commentUser}>
                                {item.user.username} · 
                                <Text style={{fontWeight:'400', color:'#666', fontSize:12}}>
                                    {formatTimeAgo(item.created_at)}
                                </Text>
                            </Text>
                            <Text style={styles.commentBody}>{item.content}</Text>
                        </View>
                    </View>
                )} 
             />
             <View style={styles.inputArea}>
                 <TextInput style={styles.input} placeholder="Add a comment..." value={commentText} onChangeText={setCommentText} placeholderTextColor="#888" />
                 <TouchableOpacity onPress={() => commentText.trim() && commentMutation.mutate(commentText)}><Send color={commentText.trim() ? Colors.primary : '#666'} /></TouchableOpacity>
             </View>
         </View>
      </Modal>

      {/* Description Modal */}
      <Modal visible={showDescription} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowDescription(false)}>
         <View style={styles.modalContainer}>
             <View style={styles.modalHeader}>
                 <Text style={styles.modalTitle}>Description</Text>
                 <TouchableOpacity onPress={() => setShowDescription(false)}><X color={Colors.textSecondary} size={24} /></TouchableOpacity>
             </View>
             <ScrollView style={{padding: 16}}>
                <Text style={styles.title}>{video.title}</Text>
                <Text style={styles.meta}>{viewsDisplay} views · {formatTimeAgo(video.created_at)}</Text>
                <View style={{marginTop: 15, borderTopWidth:1, borderTopColor:'#222', paddingTop: 15}}>
                    <Text style={styles.descTextFull}>{video.description || 'No description provided for this video.'}</Text>
                </View>
             </ScrollView>
         </View>
      </Modal>
      
      {/* --- OPTIONS MENU MODAL --- */}
      <OptionsMenuModal 
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        isOwner={isOwner}
        onDelete={handleDelete}
        onReport={handleReport}
        onSave={handleSave} 
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
  playerContainerFull: {
    width: Dimensions.get('window').width, 
    height: Dimensions.get('window').height,
    backgroundColor: '#000',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
  },
  
  video: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  controls: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'space-between' },
  topControlBar: { flexDirection: 'row', padding: 10 },
  playBtn: { alignSelf: 'center' },
  bottomControlBar: { flexDirection: 'row', alignItems: 'center', padding: 10, paddingBottom: 10 },
  timeText: { color: '#fff', fontSize: 12, marginRight: 10, fontWeight: '600' },
  
  // Seek Feedback Overlay Styles
  seekOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5, 
  },
  seekIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  seekAmountText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '700',
    marginLeft: 5,
  },

  // Progress Bar (Now a Pressable)
  progressBarBg: { 
      flex: 1, 
      height: 20, 
      justifyContent: 'center', 
      backgroundColor: 'transparent' 
  }, 
  progressBarTrack: { 
      position: 'absolute', 
      height: 3, 
      width: '100%', 
      backgroundColor: 'rgba(255,255,255,0.3)', 
      borderRadius: 2 
  },
  progressBarFill: { 
      height: 3, 
      backgroundColor: Colors.primary, 
      borderRadius: 2 
  },
  // <<< NEW: Draggable Handle Style >>>
  progressBarHandle: {
      position: 'absolute',
      width: 12, 
      height: 12,
      borderRadius: 6,
      backgroundColor: Colors.primary,
      // Center the handle on the progress bar track
      top: 4, 
      transform: [{ translateX: -6 }], // Half of the width to truly center
      zIndex: 10,
  },
  // <<< END NEW STYLE >>>
  
  // Content
  scrollContent: { flex: 1 },
  infoSection: { padding: 12, paddingBottom: 0 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 6, lineHeight: 24 },
  meta: { fontSize: 12, color: Colors.textSecondary },
  
  // New Description Card Style (Mirroring Comments Teaser)
  descContainerCard: { padding: 12, backgroundColor: '#1a1a1a', marginHorizontal: 12, marginTop: 8, marginBottom: 12, borderRadius: 10 },
  descTextCard: { fontSize: 13, color: Colors.text, flex: 1, lineHeight: 18 },
  descTextFull: { fontSize: 14, color: Colors.text, lineHeight: 22 },

  // Actions Row 
  actionsScroll: { paddingHorizontal: 12, paddingVertical: 12, gap: 12 },
  actionPill: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      backgroundColor: '#222', 
      borderRadius: 24, 
      overflow: 'hidden'
  },
  likeBtn: {
      flexDirection: 'row', 
      alignItems: 'center', 
      paddingHorizontal: 16, 
      paddingVertical: 10, 
      gap: 8,
  },
  dislikeBtn: {
      flexDirection: 'row', 
      alignItems: 'center', 
      paddingHorizontal: 16, 
      paddingVertical: 10, 
      gap: 8,
  },
  actionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  actionTextLike: { color: '#fff', fontSize: 14, fontWeight: '600' },
  separator: { width: 1, height: 18, backgroundColor: '#444' },

  iconBtnRound: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: '#222',
      justifyContent: 'center', alignItems: 'center'
  },

  // Channel
  channelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#222' },
  channelAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: '#333' },
  channelName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  subsText: { color: Colors.textSecondary, fontSize: 12 },
  subBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  subBtnActive: { backgroundColor: '#333', borderWidth: 1, borderColor: '#444' },
  subText: { color: '#000', fontWeight: '600', fontSize: 13 },
  subTextActive: { color: '#fff' },

  // Comments Teaser
  commentsTeaser: { padding: 12, backgroundColor: '#1a1a1a', marginHorizontal: 12, marginBottom: 12, borderRadius: 10 },
  commentsHeader: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
  recTitle: { color: '#fff', fontSize: 15, fontWeight: '500', lineHeight: 20 },
  recMeta: { color: Colors.textSecondary, fontSize: 12 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#222', alignItems:'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  commentItem: { flexDirection: 'row', padding: 16, gap: 12, borderBottomWidth: 1, borderColor: '#111' },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#333' },
  commentUser: { fontWeight: '700', fontSize: 13, color: Colors.text, marginBottom: 2 },
  commentBody: { fontSize: 14, color: Colors.textSecondary },
  inputArea: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderColor: '#222', alignItems: 'center', paddingBottom: 30 },
  input: { flex: 1, backgroundColor: '#111', borderRadius: 20, padding: 10, marginRight: 10, color: Colors.text },

  // Menu Styles
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'flex-end', flexDirection: 'row' },
  menuBox: { width: '100%', backgroundColor: '#1E1E1E', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 10, borderWidth: 1, borderColor: '#333' }, 
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, gap: 16 },
  menuItemNoIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 26, 
      justifyContent: 'flex-start',
  },
  menuItemDestructive: { borderTopWidth: 1, borderTopColor: '#333', marginTop: 5, paddingTop: 15 },
  menuText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  
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
