// VideoController.tsx

import React, { memo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';

// --- PROPS INTERFACE (Still needed for caller's type check, but values are ignored) ---

interface VideoControllerProps {
    isPlaying: boolean;
    showControls: boolean;
    isFullscreen: boolean;
    isSeeking: boolean;
    currentPosition: number; 
    videoDuration: number;   
    seekPosition: number;    
    showSeekIcon: boolean;
    seekDirection: 'forward' | 'backward';
    
    togglePlayPause: () => void;
    toggleFullscreen: () => void;
    handleDoubleTap: (event: any) => void;
    handleSeekStart: (event: any) => void;
    handleSeekMove: (event: any) => void;
    handleSeekEnd: () => void;
    handleLayout: (event: any) => void;
    goBack: () => void; 
    
    progressBarRef: React.RefObject<View>;
}

// --- VIDEO CONTROLLER COMPONENT (Minimal) ---

// Component receives all props but ignores them.
const VideoController = (props: VideoControllerProps) => {
    
    // Renders an invisible pressable overlay to block any default media controls 
    // and prevent accidental taps from affecting the underlying video if any native controls remain.
    return (
        <Pressable 
            style={styles.overlay} 
            onPress={() => { /* Do nothing on tap */ }} 
            onLongPress={() => { /* Do nothing */ }}
        >
            {/* Empty view for the overlay */}
        </Pressable>
    );
}

export default memo(VideoController); 

// --- STYLES ---

const styles = StyleSheet.create({
  // Completely cover the video player area
  overlay: { 
      ...StyleSheet.absoluteFillObject, 
      backgroundColor: 'transparent', // Make it transparent
      zIndex: 10, // Ensure it is on top
  },
});
