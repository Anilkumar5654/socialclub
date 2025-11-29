import { Image } from 'expo-image';
import { Stack, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  X,
  Upload,
  Video,
  Image as ImageIcon,
  FileText,
  Tag,
  Eye,
  Lock,
  Users,
  Calendar,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Switch,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';

const VIDEO_CATEGORIES = [
  'Gaming',
  'Entertainment',
  'Music',
  'Sports',
  'News',
  'Education',
  'Technology',
  'Comedy',
  'Vlog',
  'Tutorial',
  'Review',
  'How-to',
];

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public', icon: Eye, description: 'Everyone can see this video' },
  { value: 'unlisted', label: 'Unlisted', icon: Lock, description: 'Only people with the link' },
  { value: 'private', label: 'Private', icon: Users, description: 'Only you can see this' },
];

export default function VideoUploadScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [videoFile, setVideoFile] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<ImagePicker.ImagePickerAsset | null>(null);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [allowComments, setAllowComments] = useState(true);
  const [monetize, setMonetize] = useState(true);
  const [scheduledDate, setScheduledDate] = useState('');

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!videoFile) {
        throw new Error('Please select a video to upload');
      }
      if (!title.trim()) {
        throw new Error('Please enter a video title');
      }
      if (!description.trim()) {
        throw new Error('Please enter a video description');
      }
      if (!category) {
        throw new Error('Please select a category');
      }

      const formData = new FormData();
      
      const videoUri = videoFile.uri;
      const videoFileName = videoUri.split('/').pop() || 'video.mp4';
      const videoFileType = videoFileName.split('.').pop() || 'mp4';

      formData.append('video', {
        uri: videoUri,
        name: videoFileName,
        type: `video/${videoFileType}`,
      } as any);

      if (thumbnailFile) {
        const thumbUri = thumbnailFile.uri;
        const thumbFileName = thumbUri.split('/').pop() || 'thumbnail.jpg';
        const thumbFileType = thumbFileName.split('.').pop() || 'jpg';
        
        formData.append('thumbnail', {
          uri: thumbUri,
          name: thumbFileName,
          type: `image/${thumbFileType}`,
        } as any);
      }

      formData.append('title', title);
      formData.append('description', description);
      formData.append('category', category);
      formData.append('tags', tags);
      formData.append('visibility', visibility);
      formData.append('allow_comments', allowComments ? '1' : '0');
      formData.append('monetization_enabled', monetize ? '1' : '0');
      
      if (scheduledDate) {
        formData.append('scheduled_at', scheduledDate);
      }

      return api.videos.upload(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['creator'] });
      Alert.alert(
        'Success',
        'Your video has been uploaded successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    },
    onError: (error: any) => {
      Alert.alert('Upload Failed', error.message || 'Failed to upload video. Please try again.');
    },
  });

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need permission to access your media library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setVideoFile(result.assets[0]);
    }
  };

  const pickThumbnail = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need permission to access your media library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setThumbnailFile(result.assets[0]);
    }
  };

  const handleUpload = () => {
    uploadMutation.mutate();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Upload Video',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
              <X color={Colors.text} size={24} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={[
                styles.uploadButton,
                uploadMutation.isPending && styles.uploadButtonDisabled,
              ]}
              onPress={handleUpload}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <ActivityIndicator color={Colors.text} size="small" />
              ) : (
                <Text style={styles.uploadButtonText}>Upload</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Video Details</Text>
          
          <View style={styles.uploadArea}>
            {videoFile ? (
              <View style={styles.videoPreview}>
                <View style={styles.videoPreviewInfo}>
                  <Video color={Colors.primary} size={32} />
                  <Text style={styles.videoFileName} numberOfLines={1}>
                    {videoFile.uri.split('/').pop()}
                  </Text>
                  <Text style={styles.videoDuration}>
                    Duration: {Math.floor((videoFile.duration || 0) / 1000)}s
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeVideoButton}
                  onPress={pickVideo}
                >
                  <Text style={styles.changeVideoButtonText}>Change Video</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadBox} onPress={pickVideo}>
                <Upload color={Colors.textSecondary} size={48} />
                <Text style={styles.uploadText}>Select Video to Upload</Text>
                <Text style={styles.uploadHint}>MP4, MOV, or WEBM</Text>
                <Text style={styles.uploadHint}>Max 500MB</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              <FileText color={Colors.text} size={16} /> Title *
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter a compelling video title"
              placeholderTextColor={Colors.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
            <Text style={styles.charCount}>{title.length}/100</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              <FileText color={Colors.text} size={16} /> Description *
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell viewers about your video (use keywords for better SEO)"
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              maxLength={5000}
            />
            <Text style={styles.charCount}>{description.length}/5000</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thumbnail</Text>
          <Text style={styles.sectionDescription}>
            A good thumbnail helps your video stand out
          </Text>

          {thumbnailFile ? (
            <View style={styles.thumbnailPreview}>
              <Image
                source={{ uri: thumbnailFile.uri }}
                style={styles.thumbnailImage}
                contentFit="cover"
              />
              <TouchableOpacity
                style={styles.changeThumbnailButton}
                onPress={pickThumbnail}
              >
                <Text style={styles.changeThumbnailButtonText}>Change Thumbnail</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.thumbnailUploadBox} onPress={pickThumbnail}>
              <ImageIcon color={Colors.textSecondary} size={40} />
              <Text style={styles.thumbnailUploadText}>Upload Thumbnail</Text>
              <Text style={styles.thumbnailUploadHint}>1280x720 recommended</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SEO & Discovery</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              <Tag color={Colors.text} size={16} /> Category *
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
            >
              {VIDEO_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    category === cat && styles.categoryChipActive,
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      category === cat && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              <Tag color={Colors.text} size={16} /> Tags
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Add tags separated by commas (e.g., gaming, tutorial, tips)"
              placeholderTextColor={Colors.textMuted}
              value={tags}
              onChangeText={setTags}
            />
            <Text style={styles.hint}>
              <Sparkles color={Colors.info} size={14} /> Tags help viewers find your video
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visibility</Text>
          
          {VISIBILITY_OPTIONS.map((option) => {
            const IconComponent = option.icon;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.visibilityOption,
                  visibility === option.value && styles.visibilityOptionActive,
                ]}
                onPress={() => setVisibility(option.value)}
              >
                <View style={styles.visibilityLeft}>
                  <IconComponent
                    color={visibility === option.value ? Colors.primary : Colors.textSecondary}
                    size={20}
                  />
                  <View style={styles.visibilityInfo}>
                    <Text style={[
                      styles.visibilityLabel,
                      visibility === option.value && styles.visibilityLabelActive,
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={styles.visibilityDescription}>{option.description}</Text>
                  </View>
                </View>
                <View style={[
                  styles.radioButton,
                  visibility === option.value && styles.radioButtonActive,
                ]} />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced Settings</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Allow Comments</Text>
              <Text style={styles.settingDescription}>Let viewers comment on your video</Text>
            </View>
            <Switch
              value={allowComments}
              onValueChange={setAllowComments}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.text}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Monetization</Text>
              <Text style={styles.settingDescription}>Enable ads on this video</Text>
            </View>
            <Switch
              value={monetize}
              onValueChange={setMonetize}
              trackColor={{ false: Colors.border, true: Colors.success }}
              thumbColor={Colors.text}
            />
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  closeButton: {
    padding: 8,
    marginLeft: 8,
  },
  uploadButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    padding: 16,
    borderBottomWidth: 8,
    borderBottomColor: Colors.surface,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  uploadArea: {
    marginTop: 12,
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 8,
  },
  uploadHint: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  videoPreview: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  videoPreviewInfo: {
    alignItems: 'center',
    gap: 8,
  },
  videoFileName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    maxWidth: '80%',
  },
  videoDuration: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  changeVideoButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changeVideoButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  thumbnailUploadBox: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
  },
  thumbnailUploadText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  thumbnailUploadHint: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  thumbnailPreview: {
    gap: 12,
  },
  thumbnailImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  changeThumbnailButton: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  changeThumbnailButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  categoryScroll: {
    marginTop: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  categoryChipTextActive: {
    color: Colors.text,
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginBottom: 12,
  },
  visibilityOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  visibilityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  visibilityInfo: {
    flex: 1,
  },
  visibilityLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  visibilityLabelActive: {
    color: Colors.primary,
  },
  visibilityDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  radioButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingLeft: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  bottomSpacer: {
    height: 40,
  },
});
