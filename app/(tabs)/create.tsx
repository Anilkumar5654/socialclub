import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Camera, ImageIcon, Type, MapPin, Hash, X, Clock, Video } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();
  
  // States (Video option removed)
  const [contentType, setContentType] = useState<'text' | 'photo' | 'reel' | null>(null);
  const [textContent, setTextContent] = useState('');
  const [location, setLocation] = useState('');
  const [hashtags, setHashtags] = useState('');
  
  // Media States
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<{ uri: string; duration: number } | null>(null);

  // Check Channel Status (Required for Reels)
  const { data: channelCheck } = useQuery({
    queryKey: ['check-user-channel', user?.id],
    queryFn: () => api.channels.checkUserChannel(user?.id || ''),
    enabled: !!user?.id,
  });

  const hasChannel = channelCheck?.has_channel || false;

  // Clear data on tab change
  useEffect(() => {
    if (contentType !== 'reel') {
      setSelectedVideo(null);
    }
  }, [contentType]);

  // --- MUTATIONS ---
  const createPostMutation = useMutation({
    mutationFn: async (formData: FormData) => api.posts.create(formData),
    onSuccess: () => handleSuccess('Post created successfully!', 'home-feed'),
    onError: (err: any) => Alert.alert('Error', err.message || 'Failed to create post'),
  });

  const uploadReelMutation = useMutation({
    mutationFn: async (formData: FormData) => api.reels.upload(formData),
    onSuccess: () => handleSuccess('Reel uploaded successfully!', 'reels-feed'),
    onError: (err: any) => Alert.alert('Error', err.message || 'Failed to upload reel'),
  });

  const handleSuccess = (msg: string, queryKey: string) => {
    Alert.alert('Success', msg, [
      {
        text: 'OK',
        onPress: () => {
          resetForm();
          queryClient.invalidateQueries({ queryKey: [queryKey] });
          router.push('/(tabs)');
        },
      },
    ]);
  };

  const resetForm = () => {
    setContentType(null);
    setTextContent('');
    setLocation('');
    setHashtags('');
    setSelectedImages([]);
    setSelectedVideo(null);
  };

  // --- RESTRICTED SELECTION ---
  const handleContentTypeSelect = (type: 'text' | 'photo' | 'reel') => {
    if (type === 'reel') {
      if (!hasChannel) {
        Alert.alert(
          'Channel Required',
          'You need a channel to upload Reels.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Create Channel', 
              onPress: () => router.push('/creator-studio')
            }
          ]
        );
        return;
      }
    }
    setContentType(type);
  };

  // --- MEDIA PICKERS ---
  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission Required', 'Please grant access to photos');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const uris = result.assets.map((asset) => asset.uri);
      setSelectedImages(prev => [...prev, ...uris]);
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission Required', 'Please grant access to videos');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const durationInSeconds = Math.round((asset.duration || 0) / 1000);

      // Strict Reel Validation (Must be <= 90s)
      if (durationInSeconds > 90) {
        return Alert.alert('Video too long', 'Reels must be under 90 seconds.');
      }

      setSelectedVideo({ uri: asset.uri, duration: durationInSeconds });
    }
  };

  // --- SUBMIT HANDLER ---
  const handlePost = () => {
    if (!isAuthenticated) return router.push('/auth/login');

    if (contentType === 'text' && !textContent.trim()) return Alert.alert('Error', 'Please enter some text');
    if (contentType === 'photo' && selectedImages.length === 0) return Alert.alert('Error', 'Please select at least one photo');
    if (contentType === 'reel' && !selectedVideo) return Alert.alert('Error', 'Please select a video');

    const formData = new FormData();

    if (contentType === 'text') {
      formData.append('type', 'text');
      formData.append('content', textContent);
    } 
    else if (contentType === 'photo') {
      formData.append('type', 'photo');
      if (textContent) formData.append('content', textContent);
      selectedImages.forEach((uri, index) => {
        const filename = uri.split('/').pop() || `image_${index}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('images[]', { uri, name: filename, type } as any);
      });
    } 
    else if (contentType === 'reel') {
      if (selectedVideo) {
        const filename = selectedVideo.uri.split('/').pop() || 'video.mp4';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `video/${match[1]}` : 'video/mp4';
        formData.append('video', { uri: selectedVideo.uri, name: filename, type } as any);
        
        if (selectedVideo.duration) formData.append('duration', selectedVideo.duration.toString());
        if (textContent) formData.append('caption', textContent); 
      }
    }

    if (location) formData.append('location', location);
    if (hashtags) formData.append('hashtags', hashtags);

    if (contentType === 'text' || contentType === 'photo') createPostMutation.mutate(formData);
    else if (contentType === 'reel') uploadReelMutation.mutate(formData);
  };

  const isLoading = createPostMutation.isPending || uploadReelMutation.isPending;

  // --- SELECTION SCREEN ---
  if (!contentType) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.headerTitle}>Create</Text>
        </View>

        <ScrollView style={styles.optionsContainer}>
          <Text style={styles.sectionTitle}>What do you want to create?</Text>

          <TouchableOpacity style={styles.optionCard} onPress={() => handleContentTypeSelect('text')}>
            <View style={[styles.optionIcon, { backgroundColor: Colors.primary }]}>
              <Type color={Colors.text} size={32} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Text Post</Text>
              <Text style={styles.optionDescription}>Share your thoughts</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionCard} onPress={() => handleContentTypeSelect('photo')}>
            <View style={[styles.optionIcon, { backgroundColor: Colors.secondary }]}>
              <ImageIcon color={Colors.text} size={32} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Photo Post</Text>
              <Text style={styles.optionDescription}>Share photos</Text>
            </View>
          </TouchableOpacity>

          {/* REEL ONLY - Video Removed */}
          <TouchableOpacity 
            style={[styles.optionCard, !hasChannel && styles.optionCardDisabled]} 
            onPress={() => handleContentTypeSelect('reel')}
          >
            <View style={[styles.optionIcon, { backgroundColor: hasChannel ? Colors.error : '#444' }]}>
              <Camera color={Colors.text} size={32} />
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, !hasChannel && styles.textDisabled]}>
                Create Reel {!hasChannel && '(Channel Required)'}
              </Text>
              <Text style={styles.optionDescription}>Short video (up to 90s)</Text>
            </View>
          </TouchableOpacity>

        </ScrollView>
      </View>
    );
  }

  // --- CREATE FORM ---
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => setContentType(null)} disabled={isLoading}>
          <Text style={styles.headerButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {contentType === 'text' && 'New Text Post'}
          {contentType === 'photo' && 'New Photo Post'}
          {contentType === 'reel' && 'New Reel'}
        </Text>
        <TouchableOpacity onPress={handlePost} disabled={isLoading} testID="create-submit-button">
          {isLoading ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={[styles.headerButton, styles.postButton]}>Post</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.createContent} keyboardShouldPersistTaps="handled">
        {contentType === 'text' && (
          <View style={styles.textPostContainer}>
            <TextInput style={styles.textInput} placeholder="What's on your mind?" placeholderTextColor={Colors.textMuted} multiline value={textContent} onChangeText={setTextContent} autoFocus editable={!isLoading} />
          </View>
        )}

        {contentType === 'photo' && (
          <View style={styles.mediaContainer}>
            {selectedImages.length > 0 ? (
              <View style={styles.selectedImagesContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {selectedImages.map((uri, index) => (
                    <View key={index} style={styles.selectedImageWrapper}>
                      <Image source={{ uri }} style={styles.selectedImage} />
                      <TouchableOpacity style={styles.removeImageButton} onPress={() => setSelectedImages(selectedImages.filter((_, i) => i !== index))}><X color={Colors.text} size={16} /></TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.addMoreButton} onPress={pickImages}><Text style={styles.addMoreText}>Add More</Text></TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadButton} onPress={pickImages}>
                <ImageIcon color={Colors.text} size={48} /><Text style={styles.uploadText}>Select Photos</Text>
              </TouchableOpacity>
            )}
            <TextInput style={styles.captionInput} placeholder="Write a caption..." placeholderTextColor={Colors.textMuted} multiline value={textContent} onChangeText={setTextContent} editable={!isLoading} />
          </View>
        )}

        {contentType === 'reel' && (
          <View style={styles.mediaContainer}>
            {selectedVideo ? (
              <View style={styles.selectedVideoContainer}>
                <View style={styles.videoPlaceholder}>
                  <Video color={Colors.text} size={64} />
                  <Text style={styles.videoSelectedText}>Reel Selected</Text>
                  <View style={styles.durationBadge}><Clock size={14} color={Colors.textSecondary} /><Text style={styles.durationText}>{selectedVideo.duration}s</Text></View>
                </View>
                <TouchableOpacity style={styles.changeVideoButton} onPress={pickVideo}><Text style={styles.changeVideoText}>Change Video</Text></TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadButton} onPress={pickVideo}>
                <Camera color={Colors.text} size={48} />
                <Text style={styles.uploadText}>Select Reel (Max 90s)</Text>
              </TouchableOpacity>
            )}
            <TextInput style={styles.captionInput} placeholder="Write a caption..." placeholderTextColor={Colors.textMuted} multiline value={textContent} onChangeText={setTextContent} editable={!isLoading} />
          </View>
        )}

        <View style={styles.additionalOptions}>
          <View style={styles.optionRow}><MapPin color={Colors.textSecondary} size={20} /><TextInput style={styles.optionInput} placeholder="Add location" placeholderTextColor={Colors.textMuted} value={location} onChangeText={setLocation} editable={!isLoading} /></View>
          <View style={styles.optionRow}><Hash color={Colors.textSecondary} size={20} /><TextInput style={styles.optionInput} placeholder="Add hashtags" placeholderTextColor={Colors.textMuted} value={hashtags} onChangeText={setHashtags} editable={!isLoading} /></View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  headerButton: { fontSize: 16, color: Colors.textSecondary },
  postButton: { color: Colors.primary, fontWeight: '700' as const },
  optionsContainer: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, marginBottom: 20 },
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 16, padding: 20, marginBottom: 16 },
  optionCardDisabled: { opacity: 0.5 },
  optionIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  optionContent: { flex: 1 },
  optionTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, marginBottom: 4 },
  textDisabled: { color: Colors.textMuted },
  optionDescription: { fontSize: 14, color: Colors.textSecondary },
  createContent: { flex: 1 },
  textPostContainer: { padding: 16 },
  textInput: { fontSize: 16, color: Colors.text, minHeight: 200, textAlignVertical: 'top' },
  mediaContainer: { padding: 16 },
  uploadButton: { height: 300, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  uploadText: { fontSize: 16, color: Colors.textSecondary, marginTop: 12, fontWeight: '600' as const },
  selectedImagesContainer: { marginBottom: 16 },
  selectedImageWrapper: { position: 'relative', marginRight: 12 },
  selectedImage: { width: 200, height: 200, borderRadius: 12 },
  removeImageButton: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center' },
  addMoreButton: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: Colors.surface, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  addMoreText: { fontSize: 15, fontWeight: '600' as const, color: Colors.primary },
  selectedVideoContainer: { marginBottom: 16 },
  videoPlaceholder: { height: 300, backgroundColor: Colors.surface, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  videoSelectedText: { fontSize: 16, color: Colors.text, marginTop: 12, fontWeight: '600' as const },
  durationBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  durationText: { color: Colors.textSecondary, fontSize: 14 },
  changeVideoButton: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: Colors.surface, borderRadius: 8, alignItems: 'center },
  changeVideoText: { fontSize: 15, fontWeight: '600' as const, color: Colors.primary },
  captionInput: { fontSize: 15, color: Colors.text, minHeight: 80, textAlignVertical: 'top' },
  additionalOptions: { paddingHorizontal: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  optionInput: { flex: 1, fontSize: 15, color: Colors.text },
});
