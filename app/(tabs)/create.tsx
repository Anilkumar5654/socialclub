import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import { Camera, ImageIcon, Video, Type, MapPin, Hash, X } from 'lucide-react-native';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [contentType, setContentType] = useState<
    'text' | 'photo' | 'reel' | 'video' | null
  >(null);
  const [textContent, setTextContent] = useState('');
  const [location, setLocation] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [reelDuration, setReelDuration] = useState<string>('');

  useEffect(() => {
    if (contentType !== 'reel' && reelDuration !== '') {
      setReelDuration('');
    }
  }, [contentType, reelDuration]);

  const createPostMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return api.posts.create(formData);
    },
    onSuccess: () => {
      Alert.alert('Success', 'Post created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['home-feed'] });
            queryClient.invalidateQueries({ queryKey: ['user-posts'] });
            router.push('/(tabs)');
          },
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to create post');
    },
  });

  const uploadReelMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return api.reels.upload(formData);
    },
    onSuccess: () => {
      Alert.alert('Success', 'Reel uploaded successfully!', [
        {
          text: 'OK',
          onPress: () => {
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['reels'] });
            router.push('/(tabs)/reels');
          },
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to upload reel');
    },
  });

  const uploadVideoMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return api.videos.upload(formData);
    },
    onSuccess: () => {
      Alert.alert('Success', 'Video uploaded successfully!', [
        {
          text: 'OK',
          onPress: () => {
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['videos'] });
            router.push('/(tabs)/videos');
          },
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to upload video');
    },
  });

  const resetForm = () => {
    setContentType(null);
    setTextContent('');
    setLocation('');
    setHashtags('');
    setSelectedImages([]);
    setSelectedVideo(null);
    setReelDuration('');
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant permission to access photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const uris = result.assets.map((asset) => asset.uri);
      setSelectedImages(uris);
    }
  };

  const pickVideo = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'video/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedVideo(result.assets[0].uri);
    }
  };

  const handlePost = () => {
    if (!isAuthenticated) {
      Alert.alert('Error', 'Please log in to create a post');
      router.push('/auth/login');
      return;
    }

    if (contentType === 'text' && !textContent.trim()) {
      Alert.alert('Error', 'Please enter some text');
      return;
    }

    if (contentType === 'photo' && selectedImages.length === 0) {
      Alert.alert('Error', 'Please select at least one photo');
      return;
    }

    if ((contentType === 'reel' || contentType === 'video') && !selectedVideo) {
      Alert.alert('Error', 'Please select a video');
      return;
    }

    let parsedReelDuration: number | null = null;
    if (contentType === 'reel') {
      const trimmed = reelDuration.trim();
      parsedReelDuration = Number(trimmed);
      if (!trimmed || Number.isNaN(parsedReelDuration) || parsedReelDuration <= 0) {
        Alert.alert('Error', 'Reel duration (seconds) is required');
        return;
      }
    }

    const formData = new FormData();

    if (contentType === 'text') {
      formData.append('type', 'text');
      formData.append('content', textContent);
    } else if (contentType === 'photo') {
      formData.append('type', 'photo');
      if (textContent) {
        formData.append('content', textContent);
      }
      selectedImages.forEach((uri, index) => {
        const filename = uri.split('/').pop() || `image_${index}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        
        formData.append('images', {
          uri,
          name: filename,
          type,
        } as any);
      });
    } else if (contentType === 'reel' || contentType === 'video') {
      if (selectedVideo) {
        const filename = selectedVideo.split('/').pop() || 'video.mp4';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `video/${match[1]}` : 'video/mp4';

        formData.append('video', {
          uri: selectedVideo,
          name: filename,
          type,
        } as any);

        if (textContent) {
          formData.append('caption', textContent);
        }
      }
    }

    if (location) {
      formData.append('location', location);
    }

    if (hashtags) {
      formData.append('hashtags', hashtags);
    }

    if (contentType === 'reel' && parsedReelDuration !== null) {
      formData.append('duration', parsedReelDuration.toString());
    }

    if (contentType === 'text' || contentType === 'photo') {
      createPostMutation.mutate(formData);
    } else if (contentType === 'reel') {
      uploadReelMutation.mutate(formData);
    } else if (contentType === 'video') {
      uploadVideoMutation.mutate(formData);
    }
  };

  const isLoading = 
    createPostMutation.isPending || 
    uploadReelMutation.isPending || 
    uploadVideoMutation.isPending;

  if (!contentType) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.headerTitle}>Create</Text>
        </View>

        <ScrollView style={styles.optionsContainer}>
          <Text style={styles.sectionTitle}>What do you want to create?</Text>

          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => setContentType('text')}
          >
            <View style={[styles.optionIcon, { backgroundColor: Colors.primary }]}>
              <Type color={Colors.text} size={32} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Text Post</Text>
              <Text style={styles.optionDescription}>
                Share your thoughts with text
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => setContentType('photo')}
          >
            <View
              style={[styles.optionIcon, { backgroundColor: Colors.secondary }]}
            >
              <ImageIcon color={Colors.text} size={32} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Photo Post</Text>
              <Text style={styles.optionDescription}>
                Upload and share photos
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => setContentType('reel')}
          >
            <View style={[styles.optionIcon, { backgroundColor: Colors.error }]}>
              <Camera color={Colors.text} size={32} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Create Reel</Text>
              <Text style={styles.optionDescription}>
                Record or upload short video
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => setContentType('video')}
          >
            <View style={[styles.optionIcon, { backgroundColor: Colors.info }]}>
              <Video color={Colors.text} size={32} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Upload Video</Text>
              <Text style={styles.optionDescription}>
                Share long-form video content
              </Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

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
          {contentType === 'video' && 'New Video'}
        </Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={isLoading}
          testID="create-submit-button"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={[styles.headerButton, styles.postButton]}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.createContent}>
        {contentType === 'text' && (
          <View style={styles.textPostContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="What's on your mind?"
              placeholderTextColor={Colors.textMuted}
              multiline
              value={textContent}
              onChangeText={setTextContent}
              autoFocus
              editable={!isLoading}
            />
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
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => {
                          setSelectedImages(selectedImages.filter((_, i) => i !== index));
                        }}
                      >
                        <X color={Colors.text} size={16} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.addMoreButton} onPress={pickImages}>
                  <Text style={styles.addMoreText}>Add More Photos</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadButton} onPress={pickImages}>
                <ImageIcon color={Colors.text} size={48} />
                <Text style={styles.uploadText}>Select Photos</Text>
              </TouchableOpacity>
            )}

            <TextInput
              style={styles.captionInput}
              placeholder="Write a caption..."
              placeholderTextColor={Colors.textMuted}
              multiline
              value={textContent}
              onChangeText={setTextContent}
              editable={!isLoading}
            />
          </View>
        )}

        {(contentType === 'reel' || contentType === 'video') && (
          <View style={styles.mediaContainer}>
            {selectedVideo ? (
              <View style={styles.selectedVideoContainer}>
                <View style={styles.videoPlaceholder}>
                  <Video color={Colors.text} size={64} />
                  <Text style={styles.videoSelectedText}>Video Selected</Text>
                </View>
                <TouchableOpacity
                  style={styles.changeVideoButton}
                  onPress={pickVideo}
                >
                  <Text style={styles.changeVideoText}>Change Video</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadButton} onPress={pickVideo}>
                {contentType === 'reel' ? (
                  <Camera color={Colors.text} size={48} />
                ) : (
                  <Video color={Colors.text} size={48} />
                )}
                <Text style={styles.uploadText}>
                  {contentType === 'reel' ? 'Record or Select' : 'Select Video'}
                </Text>
              </TouchableOpacity>
            )}

            <TextInput
              style={styles.captionInput}
              placeholder="Write a caption..."
              placeholderTextColor={Colors.textMuted}
              multiline
              value={textContent}
              onChangeText={setTextContent}
              editable={!isLoading}
            />

            {contentType === 'reel' && (
              <View style={styles.durationCard}>
                <Text style={styles.durationLabel}>Duration (seconds)</Text>
                <TextInput
                  style={styles.durationInput}
                  value={reelDuration}
                  onChangeText={setReelDuration}
                  placeholder="e.g. 30"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  testID="reel-duration-input"
                  editable={!isLoading}
                />
                <Text style={styles.durationHelper}>
                  Match the actual clip length to avoid upload rejection.
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.additionalOptions}>
          <View style={styles.optionRow}>
            <MapPin color={Colors.textSecondary} size={20} />
            <TextInput
              style={styles.optionInput}
              placeholder="Add location"
              placeholderTextColor={Colors.textMuted}
              value={location}
              onChangeText={setLocation}
              editable={!isLoading}
            />
          </View>

          <View style={styles.optionRow}>
            <Hash color={Colors.textSecondary} size={20} />
            <TextInput
              style={styles.optionInput}
              placeholder="Add hashtags"
              placeholderTextColor={Colors.textMuted}
              value={hashtags}
              onChangeText={setHashtags}
              editable={!isLoading}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  headerButton: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  postButton: {
    color: Colors.primary,
    fontWeight: '700' as const,
  },
  optionsContainer: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  optionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  createContent: {
    flex: 1,
  },
  textPostContainer: {
    padding: 16,
  },
  textInput: {
    fontSize: 16,
    color: Colors.text,
    minHeight: 200,
    textAlignVertical: 'top',
  },
  mediaContainer: {
    padding: 16,
  },
  uploadButton: {
    height: 300,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
    fontWeight: '600' as const,
  },
  selectedImagesContainer: {
    marginBottom: 16,
  },
  selectedImageWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  selectedImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  addMoreText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  selectedVideoContainer: {
    marginBottom: 16,
  },
  videoPlaceholder: {
    height: 300,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  videoSelectedText: {
    fontSize: 16,
    color: Colors.text,
    marginTop: 12,
    fontWeight: '600' as const,
  },
  changeVideoButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    alignItems: 'center',
  },
  changeVideoText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  captionInput: {
    fontSize: 15,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  durationCard: {
    marginTop: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  durationLabel: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  durationInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
  },
  durationHelper: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  additionalOptions: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  optionInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
});
