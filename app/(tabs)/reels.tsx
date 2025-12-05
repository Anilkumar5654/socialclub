import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity,
  StatusBar, ActivityIndicator, TouchableWithoutFeedback, Animated, Platform, Modal, TextInput, Share, RefreshControl, AppState
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, router } from 'expo-router'; 
import { useIsFocused } from '@react-navigation/native'; 
import { Heart, MessageCircle, Share2, MoreVertical, Music2, Camera, X, Send, Trash2, Flag, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import Colors from '@/constants/colors';
import { api, MEDIA_BASE_URL } from '@/services/api';
import { formatTimeAgo } from '@/constants/timeFormat';
import { useAuth } from '@/contexts/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_TAB_HEIGHT = Platform.OS === 'ios' ? 80 : 50; 
const ACTUAL_HEIGHT = SCREEN_HEIGHT - BOTTOM_TAB_HEIGHT;

// --- CUSTOM ALERT COMPONENT ---
const CustomAlert = ({ visible, title, message, onCancel, onConfirm, confirmText = 'Confirm', isDestructive = false }: any) => {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.alertOverlay}>
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          <View style={styles.alertButtons}>
            {onCancel && (
                <TouchableOpacity onPress={onCancel} style={styles.alertBtnCancel}>
                <Text style={styles.alertBtnTextCancel}>Cancel</Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onConfirm} style={styles.alertBtnConfirm}>
              <Text style={[styles.alertBtnTextConfirm, isDestructive && { color: '#FF4444' }]}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// --- REPORT MODAL ---
const ReportModal = ({ visible, onClose, onReport }: any) => {
    const reasons = ["Spam", "Sexual Content", "Harassment", "Violent", "False Info", "Other"];
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.reportContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Report</Text>
                        <TouchableOpacity onPress={onClose}><X color="#fff" size={24}/></TouchableOpacity>
                    </View>
                    <Text style={{color:'#aaa', marginBottom:15}}>Why are you reporting this reel?</Text>
                    {reasons.map(r => (
                        <TouchableOpacity key={r} style={styles.reportItem} onPress={() => onReport(r)}>
                            <Text style={styles.reportText}>{r}</Text><ChevronRight color="#666"/>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </Modal>
    );
};

// --- COMMENTS MODAL ---
const CommentsModal = ({ visible, onClose, reelId, showAlert }: any) => {
    const [text, setText] = useState('');
    const { user: currentUser } = useAuth();
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: ['reel-comments', reelId], queryFn: () => api.reels.getComments(reelId), enabled: visible });
    
    const post = useMutation({ 
        mutationFn: (t: string) => api.reels.comment(reelId, t), 
        onSuccess: () => { setText(''); queryClient.invalidateQueries({ queryKey: ['reel-comments', reelId] }); } 
    });
    
    const del = useMutation({ 
        mutationFn: (cid: string) => api.reels.deleteComment(cid), 
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reel-comments', reelId] }) 
    });

    const handleDelete = (cid: string) => {
        showAlert({
            title: 'Delete Comment', message: 'Are you sure?', isDestructive: true, confirmText: 'Delete',
            onConfirm: () => del.mutate(cid)
        });
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}><Text style={styles.modalTitle}>Comments ({data?.comments?.length || 0})</Text><TouchableOpacity onPress={onClose}><X color="#fff" size={24}/></TouchableOpacity></View>
                    {isLoading ? <ActivityIndicator color={Colors.primary} /> : (
                        <FlatList data={data?.comments || []} keyExtractor={i => i.id} contentContainerStyle={{paddingBottom: 80}} renderItem={({item}) => (
                            <View style={styles.commentItem}>
                                <TouchableOpacity onPress={() => { onClose(); router.push({ pathname: '/user/[userId]', params: { userId: item.user_id } }); }}>
                                    <Image source={{ uri: item.user.avatar ? (item.user.avatar.startsWith('http') ? item.user.avatar : `${MEDIA_BASE_URL}/${item.user.avatar}`) : '' }} style={styles.commentAvatar} />
                                </TouchableOpacity>
                                <View style={{flex:1}}>
                                    <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                                        <Text style={styles.commentUser}>{item.user.username}</Text>
                                        <Text style={styles.commentTime}>{formatTimeAgo(item.created_at)}</Text>
                                    </View>
                                    <Text style={styles.commentText}>{item.content}</Text>
                                </View>
                                {String(currentUser?.id) === String(item.user_id) && (
                                    <TouchableOpacity onPress={() => handleDelete(item.id)}><Trash2 size={16} color="#666"/></TouchableOpacity>
                                )}
                            </View>
                        )} ListEmptyComponent={<Text style={{color:'#666', textAlign:'center', marginTop:20}}>No comments yet.</Text>} />
                    )}
                    <View style={styles.inputContainer}>
                        <TextInput style={styles.input} placeholder="Add comment..." placeholderTextColor="#999" value={text} onChangeText={setText} />
                        <TouchableOpacity onPress={() => text.trim() && post.mutate(text)}><Send color={text.trim() ? Colors.primary : "#666"} size={24}/></TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

// --- OPTIONS MODAL ---
const ReelOptionsModal = ({ visible, onClose, isOwner, onDelete, onReportClick }: any) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={styles.optionsOverlay} activeOpacity={1} onPress={onClose}>
            <View style={styles.optionsBox}>
                {isOwner ? (
                    <TouchableOpacity style={styles.optionItem} onPress={onDelete}>
                        <Trash2 size={20} color="#FF4444" /><Text style={[styles.optionText, { color: '#FF4444' }]}>Delete Reel</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.optionItem} onPress={onReportClick}>
                        <Flag size={20} color="#fff" /><Text style={styles.optionText}>Report Reel</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.optionItem} onPress={onClose}>
                    <X size={20} color="#fff" /><Text style={styles.optionText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    </Modal>
);

// --- REEL ITEM ---
const ReelItem = React.memo(({ item, isActive, toggleLike, toggleSubscribe, openComments, openOptions, onDurationUpdate }: any) => {
    const videoRef = useRef<Video>(null);
    const isFocused = useIsFocused();
    const appState = useRef(AppState.currentState);
    const [appActive, setAppActive] = useState(appState.current === 'active');
    
    // NEW: Manual Pause State
    const [userPaused, setUserPaused] = useState(false);

    const heartScale = useRef(new Animated.Value(0)).current;
    const insets = useSafeAreaInsets();
    const lastTap = useRef<number | null>(null);

    useEffect(() => {
        const sub = AppState.addEventListener('change', next => { appState.current = next; setAppActive(next === 'active'); });
        return () => sub.remove();
    }, []);

    // Logic: Play only if Active + Screen Focused + App Active + User Didn't Pause
    useEffect(() => {
        if (!videoRef.current) return;
        if (isActive && isFocused && appActive && !userPaused) {
            videoRef.current.playAsync();
        } else {
            videoRef.current.pauseAsync();
            if (!isActive) {
                videoRef.current.setPositionAsync(0);
                setUserPaused(false); // Reset pause when scrolled away
            }
        }
    }, [isActive, isFocused, appActive, userPaused]);

    const handleTap = () => {
        const now = Date.now();
        const DOUBLE_PRESS_DELAY = 300;
        if (lastTap.current && (now - lastTap.current) < DOUBLE_PRESS_DELAY) {
            // Double Tap -> Like
            if (!item.is_liked) toggleLike(item.id);
            animateHeart();
        } else {
            // Single Tap -> Toggle Play/Pause
            lastTap.current = now;
            // Add small delay to distinguish single/double tap if needed, but immediate toggle feels snappier
            setUserPaused(prev => !prev);
        }
    };

    const animateHeart = () => {
        heartScale.setValue(0);
        Animated.sequence([
            Animated.spring(heartScale, { toValue: 1, useNativeDriver: true }),
            Animated.timing(heartScale, { toValue: 0, duration: 200, useNativeDriver: true })
        ]).start();
    };

    const handleShare = async () => {
        api.reels.share(item.id);
        try { await Share.share({ message: `Check this reel: https://moviedbr.com/reels/${item.id}` }); } catch(e){}
    };

    const getUrl = (path: string) => path?.startsWith('http') ? path : `${MEDIA_BASE_URL}/${path}`;
    const channelAvatar = item.channel_avatar ? getUrl(item.channel_avatar) : 'https://via.placeholder.com/100';

    return (
        <View style={[styles.reelContainer, { height: ACTUAL_HEIGHT }]}>
            <TouchableWithoutFeedback onPress={handleTap}>
                <View style={styles.videoWrapper}>
                    <Video ref={videoRef} source={{ uri: getUrl(item.video_url) }} style={styles.video} resizeMode={ResizeMode.COVER} isLooping shouldPlay={isActive && isFocused && appActive && !userPaused} onPlaybackStatusUpdate={(s:any) => { if(s.isLoaded && s.durationMillis && isActive) onDurationUpdate(item.id, s.durationMillis/1000); }} posterSource={{ uri: getUrl(item.thumbnail_url) }} />
                    
                    {/* Pause Icon Overlay */}
                    {userPaused && <View style={styles.centerOverlay}><View style={styles.pauseCircle}><View style={styles.playIcon}/></View></View>}

                    <View style={styles.centerHeart}><Animated.View style={{ transform: [{ scale: heartScale }] }}><Heart size={100} color="white" fill="white" /></Animated.View></View>
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.9)']} style={styles.gradient} />
                    
                    <View style={[styles.rightActions, { bottom: insets.bottom + 40 }]}>
                        <TouchableOpacity onPress={() => toggleLike(item.id)} style={styles.actionBtn}>
                            <Heart size={32} color={item.is_liked ? "#E1306C" : "#fff"} fill={item.is_liked ? "#E1306C" : "transparent"} /><Text style={styles.actionText}>{item.likes_count}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openComments(item.id)} style={styles.actionBtn}>
                            <MessageCircle size={32} color="#fff" /><Text style={styles.actionText}>{item.comments_count}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleShare} style={styles.actionBtn}>
                            <Share2 size={30} color="#fff" /><Text style={styles.actionText}>{item.shares_count}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openOptions(item)} style={styles.actionBtn}><MoreVertical size={28} color="#fff" /></TouchableOpacity>
                    </View>

                    <View style={[styles.bottomInfo, { bottom: insets.bottom + 10 }]}>
                        <View style={styles.channelRow}>
                            <TouchableOpacity style={styles.channelInfo} onPress={() => router.push({ pathname: '/channel/[channelId]', params: { channelId: item.channel_id } })}>
                                <Image source={{ uri: channelAvatar }} style={styles.avatar} />
                                <Text style={styles.channelName}>{item.channel_name || 'Channel'}</Text>
                                {item.channel_verified && <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View>}
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.subscribeBtn, item.is_subscribed && styles.subscribedBtn]} onPress={() => toggleSubscribe(item.channel_id)}>
                                <Text style={[styles.subscribeText, item.is_subscribed && styles.subscribedText]}>{item.is_subscribed ? 'Subscribed' : 'Subscribe'}</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.caption} numberOfLines={2}>{item.caption}</Text>
                        <View style={styles.musicRow}><Music2 size={14} color="#fff" /><Text style={styles.musicText}>Original Audio</Text></View>
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
    const [commentsVisible, setCommentsVisible] = useState(false);
    const [optionsVisible, setOptionsVisible] = useState(false);
    const [activeReel, setActiveReel] = useState<any>(null);
    
    // Alert State
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
    
    const startTimeRef = useRef<number>(Date.now());
    const durationsRef = useRef<{[key: string]: number}>({});
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();
    const { user: currentUser } = useAuth();

    const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ['reels-feed', page], queryFn: () => api.reels.getReels(page, 5) });
    const reels = data?.reels || [];

    const showAlert = (config: any) => {
        setAlertConfig({ ...config, visible: true, onCancel: () => setAlertConfig({ visible: false }) });
    };

    const trackCurrentView = useCallback((index: number, reelList: any[]) => {
        const reel = reelList[index];
        if (!reel) return;
        const endTime = Date.now();
        const watchDuration = (endTime - startTimeRef.current) / 1000; 
        const totalDuration = durationsRef.current[reel.id] || 0; 
        if (watchDuration > 1) api.reels.trackView(reel.id, watchDuration, totalDuration);
        startTimeRef.current = Date.now();
    }, []);

    useFocusEffect(useCallback(() => {
        startTimeRef.current = Date.now();
        return () => trackCurrentView(activeIndex, reels);
    }, [activeIndex, reels, trackCurrentView]));

    const likeMutation = useMutation({
        mutationFn: (reelId: string) => {
            const reel = reels.find((r: any) => r.id === reelId);
            return reel?.is_liked ? api.reels.unlike(reelId) : api.reels.like(reelId);
        },
        onSuccess: (data, reelId) => {
            queryClient.setQueryData(['reels-feed', page], (old: any) => {
                if(!old) return old;
                return { ...old, reels: old.reels.map((r: any) => r.id === reelId ? {...r, is_liked: !r.is_liked, likes_count: r.is_liked ? r.likes_count - 1 : r.likes_count + 1} : r) }
            })
        }
    });

    const subscribeMutation = useMutation({
        mutationFn: (cid: string) => {
            const reel = reels.find((x:any)=>x.channel_id===cid);
            return reel?.is_subscribed ? api.channels.unsubscribe(cid) : api.channels.subscribe(cid);
        },
        onSuccess: (d, cid) => queryClient.setQueryData(['reels-feed', page], (old:any) => ({...old, reels: old.reels.map((r:any) => r.channel_id===cid ? {...r, is_subscribed: !r.is_subscribed} : r)}))
    });

    const reportMutation = useMutation({
        mutationFn: (reason: string) => api.reels.report(activeReel.id, reason),
        onSuccess: () => {
             showAlert({ title: 'Reported', message: 'Thanks for helping us.', confirmText: 'OK', onConfirm: () => setAlertConfig({visible: false}) });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.reels.delete(id), 
        onSuccess: () => { setOptionsVisible(false); refetch(); }
    });

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            const newIndex = viewableItems[0].index ?? 0;
            if (newIndex !== activeIndex) trackCurrentView(activeIndex, reels);
            setActiveIndex(newIndex);
        }
    }).current;

    const handleDurationUpdate = useCallback((id: string, duration: number) => { durationsRef.current[id] = duration; }, []);

    if (isLoading && page === 1) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <View style={[styles.header, { top: insets.top + 10 }]}>
                <Text style={styles.headerTitle}>Reels</Text>
                <TouchableOpacity onPress={() => router.push('/reels/upload')}><Camera size={26} color="#fff" /></TouchableOpacity>
            </View>
            
            <FlatList
                data={reels}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item, index }) => (
                    <ReelItem item={item} index={index} isActive={index === activeIndex} 
                        toggleLike={(id:string) => likeMutation.mutate(id)} 
                        toggleSubscribe={(cid:string) => subscribeMutation.mutate(cid)}
                        openComments={(id:string)=>{setActiveReel(item); setCommentsVisible(true)}} 
                        openOptions={(r:any)=>{setActiveReel(r); setOptionsVisible(true)}}
                        onDurationUpdate={handleDurationUpdate}
                    />
                )}
                pagingEnabled showsVerticalScrollIndicator={false} snapToInterval={ACTUAL_HEIGHT}
                onViewableItemsChanged={onViewableItemsChanged} viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                getItemLayout={(data, index) => ({ length: ACTUAL_HEIGHT, offset: ACTUAL_HEIGHT * index, index })}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
                onEndReached={() => { if(data?.hasMore) setPage(p => p+1) }} onEndReachedThreshold={2}
                ListEmptyComponent={<View style={[styles.loadingContainer, {height: ACTUAL_HEIGHT}]}><Text style={{color:'#fff'}}>No Reels Found</Text></View>}
            />

            {activeReel && <CommentsModal visible={commentsVisible} onClose={() => setCommentsVisible(false)} reelId={activeReel.id} showAlert={showAlert} />}
            
            {activeReel && <ReelOptionsModal visible={optionsVisible} onClose={() => setOptionsVisible(false)} 
                isOwner={String(activeReel.user_id) === String(currentUser?.id)} 
                onDelete={() => showAlert({ title: 'Delete', message: 'Are you sure?', isDestructive: true, confirmText: 'Delete', onConfirm: () => deleteMutation.mutate(activeReel.id) })}
                onReportClick={() => { setOptionsVisible(false); setTimeout(() => showAlert({ title: 'Report', message: 'Select reason', confirmText: 'Spam', onConfirm: () => reportMutation.mutate('Spam') }), 300); }} 
            />}

            <CustomAlert {...alertConfig} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    header: { position: 'absolute', left: 20, right: 20, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between' },
    headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
    reelContainer: { width: SCREEN_WIDTH, backgroundColor: '#000' },
    videoWrapper: { flex: 1, backgroundColor: '#121212' },
    video: { width: '100%', height: '100%' },
    gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 350 },
    centerHeart: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
    centerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 4 },
    pauseCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    playIcon: { width: 0, height: 0, borderLeftWidth: 20, borderLeftColor: '#fff', borderTopWidth: 12, borderTopColor: 'transparent', borderBottomWidth: 12, borderBottomColor: 'transparent', marginLeft: 4 }, // Simple CSS Triangle
    rightActions: { position: 'absolute', right: 10, bottom: 100, zIndex: 20, alignItems: 'center', gap: 20 },
    actionBtn: { alignItems: 'center' },
    actionText: { color: '#fff', marginTop: 5, fontSize: 13, fontWeight: '600' },
    bottomInfo: { position: 'absolute', left: 16, right: 80, bottom: 20, zIndex: 20 },
    channelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    channelInfo: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#fff', marginRight: 10 },
    channelName: { color: '#fff', fontWeight: '700', fontSize: 16, marginRight: 6 },
    verifiedBadge: { backgroundColor: Colors.primary, borderRadius: 10, width: 14, height: 14, justifyContent: 'center', alignItems: 'center' },
    verifiedText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
    subscribeBtn: { backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 10 },
    subscribedBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
    subscribeText: { color: '#000', fontSize: 13, fontWeight: '700' },
    subscribedText: { color: '#fff' },
    caption: { color: '#fff', fontSize: 14, lineHeight: 20, marginBottom: 10 },
    musicRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    musicText: { color: '#fff', fontSize: 13 },
    // Modals & Alerts
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#121212', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '70%', padding: 0 },
    reportContent: { backgroundColor: '#121212', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
    modalHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#333' },
    modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
    commentItem: { flexDirection: 'row', marginBottom: 20, paddingHorizontal: 16 },
    commentAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
    commentUser: { color: '#fff', fontWeight: '700', fontSize: 13 },
    commentTime: { color: '#888', fontSize: 11 },
    commentText: { color: '#ddd', marginTop: 2 },
    inputContainer: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#333', alignItems: 'center' },
    input: { flex: 1, backgroundColor: '#333', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', marginRight: 10 },
    optionsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
    optionsBox: { width: '80%', backgroundColor: '#1E1E1E', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#333' },
    optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16 },
    optionText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    reportItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
    reportText: { color: '#fff', fontSize: 16 },
    // Custom Alert
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
    alertBox: { width: '80%', backgroundColor: '#1E1E1E', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    alertTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
    alertMessage: { color: '#AAA', fontSize: 14, textAlign: 'center', marginBottom: 20 },
    alertButtons: { flexDirection: 'row', gap: 12, width: '100%' },
    alertBtnCancel: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#333', alignItems: 'center' },
    alertBtnConfirm: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#333', alignItems: 'center' },
    alertBtnTextCancel: { color: '#fff', fontWeight: '600' },
    alertBtnTextConfirm: { color: '#E1306C', fontWeight: '600' }
});
