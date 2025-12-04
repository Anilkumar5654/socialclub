import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  StatusBar,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Image } from 'expo-image'; // High performance image
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av'; // For Video Preview
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Image as ImageIcon, Video as VideoIcon, Send, Camera, Trash2, RefreshCcw } from 'lucide-react-native';

import Colors from '@/constants/colors'; // Ensure this exists or replace with hex codes
import { api } from '@/services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function StoryUploadScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const videoRef = useRef<Video>(null);

  // --- STATE ---
  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState<{
    uri: string;
    type: 'image' | 'video';
    mimeType: string;
    duration?: number;
  } | null>(null);

  // --- API MUTATION ---
  const uploadMutation = useMutation({
    mutationFn: async (data: { media: typeof media; caption: string }) => {
      if (!data.media) throw new Error("No media selected");

      const formData = new FormData();
      
      const uriParts = data.media.uri.split('.');
      const fileType = uriParts[uriParts.length - 1];
      
      const mediaFile: any = {
        uri: Platform.OS === 'ios' ? data.media.uri.replace('file://', '') : data.media.uri,
        name: `upload.${fileType}`,
        type: data.media.mimeType || (data.media.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      };
      
      // Matches your PHP: $_FILES['file']
      formData.append('file', mediaFile);
      
      // Matches your PHP: $_POST['caption']
      if (data.caption.trim()) {
        formData.append('caption', data.caption.trim());
      }
      
      // Helper for Backend Logic
      formData.append('media_type', data.media.type);
      if (data.media.duration) {
        formData.append('duration', Math.round(data.media.duration).toString());
      }
      
      return api.stories.upload(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      Alert.alert('Posted!', 'Your story is now live.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    },
    onError: (error: any) => {
      console.error("Upload Error:", error);
      Alert.alert('Upload Failed', error.message || 'Something went wrong.');
    },
  });

  // --- MEDIA PICKERS ---
  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to camera and gallery.');
      return false;
    }
    return true;
  };

  const handlePickMedia = async (mode: 'camera' | 'library', mediaType: 'image' | 'video' | 'all') => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    let result;
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: mediaType === 'video' 
        ? ImagePicker.MediaTypeOptions.Videos 
        : mediaType === 'image' 
          ? ImagePicker.MediaTypeOptions.Images 
          : ImagePicker.MediaTypeOptions.All,
      allowsEditing: true, // Allows cropping/trimming
      quality: 0.8,
      videoMaxDuration: 60,
      aspect: [9, 16], // Perfect Story Ratio
    };

    if (mode === 'camera') {
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMedia({
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image',
        mimeType: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        duration: asset.duration ? asset.duration / 1000 : undefined, // Convert ms to seconds
      });
    }
  };

  const handlePost = () => {
    if (!media) return;
    uploadMutation.mutate({ media, caption });
  };

  const clearSelection = () => {
    setMedia(null);
    setCaption('');
  };

  // --- RENDER ---
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* 1. SELECTION SCREEN (Empty State) */}
      {!media && (
        <View style={[styles.selectionContainer, { paddingTop: insets.top }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
              <X color="#fff" size={32} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add to Story</Text>
            <View style={{ width: 32 }} /> 
          </View>

          <View style={styles.selectionContent}>
            <Text style={styles.selectionHint}>Share your moments</Text>
            
            <View style={styles.pickerGrid}>
              <TouchableOpacity 
                style={styles.pickerCard} 
                onPress={() => handlePickMedia('camera', 'all')}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#E1306C' }]}>
                  <Camera color="#fff" size={32} />
                </View>
                <Text style={styles.pickerText}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.pickerCard} 
                onPress={() => handlePickMedia('library', 'image')}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#405DE6' }]}>
                  <ImageIcon color="#fff" size={32} />
                </View>
                <Text style={styles.pickerText}>Photos</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.pickerCard} 
                onPress={() => handlePickMedia('library', 'video')}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#F56040' }]}>
                  <VideoIcon color="#fff" size={32} />
                </View>
                <Text style={styles.pickerText}>Videos</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* 2. PREVIEW SCREEN (Media Selected) */}
      {media && (
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.previewContainer}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.fullScreenWrapper}>
              
              {/* Media Display */}
              {media.type === 'video' ? (
                <Video
                  ref={videoRef}
                  source={{ uri: media.uri }}
                  style={styles.mediaPreview}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay
                  isLooping
                  isMuted={false}
                />
              ) : (
                <Image 
                  source={{ uri: media.uri }} 
                  style={styles.mediaPreview} 
                  contentFit="cover"
                />
              )}

              {/* Top Overlay: Close / Retake */}
              <View style={[styles.previewHeader, { top: insets.top + 10 }]}>
                <TouchableOpacity onPress={clearSelection} style={styles.glassButton}>
                   <X color="#fff" size={24} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handlePickMedia('library', media.type)} style={styles.glassButton}>
                   <RefreshCcw color="#fff" size={20} />
                </TouchableOpacity>
              </View>

              {/* Bottom Overlay: Caption & Send */}
              <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 10 }]}>
                
                {/* Caption Input with Glass Effect */}
                <View style={styles.captionWrapper}>
                  <TextInput
                    style={styles.captionInput}
                    placeholder="Write a caption..."
                    placeholderTextColor="rgba(255,255,255,0.7)"
                    value={caption}
                    onChangeText={setCaption}
                    multiline
                    maxLength={150}
                  />
                  {caption.length > 0 && (
                     <Text style={styles.charCount}>{caption.length}/150</Text>
                  )}
                </View>

                {/* Send Button */}
                <TouchableOpacity 
                  style={[styles.sendButton, uploadMutation.isPending && styles.disabledBtn]}
                  onPress={handlePost}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <Text style={styles.sendText}>Share</Text>
                      <Send color="#000" size={18} fill="#000" />
                    </>
                  )}
                </TouchableOpacity>

              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  // --- SELECTION SCREEN STYLES ---
  selectionContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  iconButton: {
    padding: 8,
  },
  selectionContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  selectionHint: {
    color: '#rgba(255,255,255,0.6)',
    fontSize: 16,
    marginBottom: 30,
    letterSpacing: 0.5,
  },
  pickerGrid: {
    flexDirection: 'row',
    gap: 20,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pickerCard: {
    width: 100,
    height: 120,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // --- PREVIEW SCREEN STYLES ---
  previewContainer: {
    flex: 1,
  },
  fullScreenWrapper: {
    flex: 1,
    position: 'relative',
  },
  mediaPreview: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#121212',
  },
  previewHeader: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  glassButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)', // Glass dark
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 20,
    backgroundColor: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', // Note: standard RN doesnt support gradient without lib, so using fallback below
    // Fallback simple background if no LinearGradient lib
    justifyContent: 'flex-end',
    gap: 16,
  },
  captionWrapper: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    minHeight: 50,
  },
  captionInput: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 100,
  },
  charCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 30,
    height: 56,
    gap: 8,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  disabledBtn: {
    opacity: 0.7,
    backgroundColor: '#e0e0e0',
  },
  sendText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
});
