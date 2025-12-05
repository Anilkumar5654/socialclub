import { ArrowBigRight, ArrowBigLeft, Pause, Play, Maximize, ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/colors'; 

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const formatDuration = (seconds: any) => {
    const sec = Number(seconds) || 0;
    if (sec <= 0) return "00:00";
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- PROPS INTERFACE ---

interface VideoControllerProps {
    // State props
    isPlaying: boolean;
    showControls: boolean;
    isFullscreen: boolean;
    isSeeking: boolean;
    currentPosition: number; // in MS
    videoDuration: number;   // in MS
    seekPosition: number;    // in MS (live preview)
    showSeekIcon: boolean;
    seekDirection: 'forward' | 'backward';
    
    // Handlers
    togglePlayPause: () => void;
    toggleFullscreen: () => void;
    handleDoubleTap: (event: any) => void;
    handleSeekStart: (event: any) => void;
    handleSeekMove: (event: any) => void;
    handleSeekEnd: () => void;
    handleLayout: (event: any) => void;
    goBack: () => void; 
    
    // Refs
    progressBarRef: React.RefObject<View>;
}

// --- VIDEO CONTROLLER COMPONENT ---

export default function VideoController({
    isPlaying,
    showControls,
    isFullscreen,
    isSeeking,
    currentPosition,
    videoDuration,
    seekPosition,
    showSeekIcon,
    seekDirection,
    togglePlayPause,
    toggleFullscreen,
    handleDoubleTap,
    handleSeekStart,
    handleSeekMove,
    handleSeekEnd,
    handleLayout,
    goBack,
    progressBarRef,
}: VideoControllerProps) {
    
    const insets = useSafeAreaInsets();
    
    // Determine the position to display (live or current)
    const displayPosition = isSeeking && seekPosition > 0 ? seekPosition : currentPosition;
    const progressPercentage = (displayPosition / (videoDuration || 1)) * 100;

    return (
        // OVERLAY CONTROLS CONTAINER
        <Pressable style={styles.overlay} onPress={handleDoubleTap}>
            
            {/* 2. SEEK FEEDBACK OVERLAY (YouTube Style) */}
            {showSeekIcon && (
                <View style={styles.seekOverlay}>
                    <View style={styles.seekIconContainer}>
                        {seekDirection === 'forward' ? 
                            <ArrowBigRight color="white" size={48} /> 
                            : 
                            <ArrowBigLeft color="white" size={48} /> 
                        }
                        <Text style={styles.seekAmountText}>10</Text>
                    </View>
                </View>
            )}

            {/* MAIN CONTROLS */}
            {showControls && (
                <View style={styles.controls}>
                    
                    {/* TOP CONTROL BAR (Back Button) */}
                    <View style={[styles.topControlBar, {paddingTop: isFullscreen ? insets.top : 10}]}>
                       <TouchableOpacity onPress={goBack}><ArrowLeft color="white" size={24} /></TouchableOpacity>
                    </View>

                    {/* CENTER PLAY/PAUSE BUTTON */}
                    <TouchableOpacity onPress={togglePlayPause} style={styles.playBtn}>
                      {isPlaying ? <Pause color="white" size={48} fill="white" /> : <Play color="white" size={48} fill="white" />}
                    </TouchableOpacity>

                    {/* BOTTOM CONTROL BAR (Progress Bar & Fullscreen) */}
                    <View style={styles.bottomControlBar}>
                        {/* Live Duration Display */}
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
                            <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
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
    );
}


// --- STYLES ---

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  controls: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'space-between' },
  topControlBar: { flexDirection: 'row', paddingHorizontal: 10, paddingBottom: 10 },
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

  // Progress Bar
  progressBarBg: { flex: 1, height: 20, justifyContent: 'center', backgroundColor: 'transparent' }, 
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
  progressBarHandle: {
      position: 'absolute',
      width: 12, 
      height: 12,
      borderRadius: 6,
      backgroundColor: Colors.primary,
      top: 4, 
      transform: [{ translateX: -6 }], 
      zIndex: 10,
  },
});
