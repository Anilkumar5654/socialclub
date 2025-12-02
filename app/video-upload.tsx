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
  DollarSign,
  MonitorPlay,
  Trash2, // Added for tag removal
} from 'lucide-react-native';
import React, { useState, useMemo } from 'react';
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
  Keyboard, // Added for tags handling
} from 'react-native';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';

// --- NEW HOOK: FETCH CHANNEL MONETIZATION STATUS ---
// 🔥 FIX: Connecting to the real API endpoint /api/channels/details
const useMonetizationStatus = (userId: string | undefined) => {
    return useQuery({
        queryKey: ['channelDetailsMonetization', userId],
        queryFn: async () => {
            if (!userId) return null;

            // Assuming your api object has a 'channels' property with a details method
            // We pass user ID so backend can find the channel details
            // ⚠️ NOTE: This assumes api.channels.details is configured to handle the user_id query param
            const response = await api.channels.details({ user_id: userId }); 
            
            if (response.success && response.channel && response.channel.monetization) {
                 return response.channel.monetization;
            }
            
            // Default safe return: Not eligible
            return { status: 'PENDING', is_enabled: false };
        },
        enabled: !!userId,
        // Set stale time high as monetization status doesn't change often
        staleTime: 1000 * 60 * 60, 
    });
};


const VIDEO_CATEGORIES = [
  'Gaming', 'Entertainment', 'Music', 'Sports', 'News', 'Education', 'Technology', 
  'Comedy', 'Vlog', 'Tutorial', 'Review', 'How-to',
];

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public', icon: Eye, description: 'Everyone can see this video' },
  { value: 'unlisted', label: 'Unlisted', icon: Lock, description: 'Only people with the link' },
  { value: 'private', label: 'Private', icon: Users, description: 'Only you can see this' },
];

export default function VideoUploadScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoFile, setVideoFile] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<ImagePicker.ImagePickerAsset | null>(null);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]); // 1. TAGS FIX: Change to Array
  const [tagInput, setTagInput] = useState(''); // State for current text input
  const [visibility, setVisibility] = useState('public');
  const [allowComments, setAllowComments] = useState(true);
  const [monetize, setMonetize] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');

  // Fetch monetization status
  const { data: monetizationStatus, isLoading: isLoadingMonetization } = useMonetizationStatus(user?.id);

  // Determine if monetization option should be shown
  const isMonetizationEligible = useMemo(() => {
    if (!monetizationStatus) return false;
    const status = monetizationStatus.status; // Accessing the new structure
    const isEnabled = monetizationStatus.is_enabled; // Accessing the new structure
    
    // Eligibility Logic: Must be 'APPROVED' or 'ELIGIBLE' AND enabled at channel level
    return (status === 'APPROVED' || status === 'ELIGIBLE') && isEnabled;
  }, [monetizationStatus]);

  // --- TAGS LOGIC ---
  const handleTagInput = (text: string) => {
    setTagInput(text);
    // If the last character is a comma or Enter, process the tag
    if (text.endsWith(',') || text.endsWith('\n')) {
      const newTag = text.slice(0, -1).trim(); // Remove comma/newline
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
        setTagInput(''); // Clear input
      } else if (newTag) {
        setTagInput(''); // Clear input if tag is duplicate
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };
  // --- END TAGS LOGIC ---


  const uploadMutation = useMutation({
    mutationFn: async () => {
      // Input validations... (unchanged)
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
      if (videoDuration === null) {
         throw new Error('Video duration could not be determined. Please re-select the video.');
      }
      
      // Process any remaining text in the tag input field
      const finalTags = tagInput.trim() ? [...tags, tagInput.trim()] : tags; 
      
      const formData = new FormData();
      // ... (file appends unchanged) ...
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

      // Append data
      formData.append('video_duration', videoDuration.toString());
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category', category);
      formData.append('visibility', visibility);
      formData.append('allow_comments', allowComments ? '1' : '0');

      // 1. TAGS FIX: Join array into comma-separated string for backend
      formData.append('tags', finalTags.join(',')); 
      
      // 2. CONDITIONAL MONETIZATION LOGIC
      if (isMonetizationEligible) {
          formData.append('monetization_enabled', monetize ? '1' : '0');
      } else {
          // Send 0 if not eligible, ensuring backend saves it as disabled
          formData.append('monetization_enabled', '0'); 
      }
      
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
      // ⚠️ Note: Database error messages were exposed by the backend for debugging.
      Alert.alert('Upload Failed', error.message || 'Failed to upload video. Please try again.');
    },
  });

  // Pick video logic (unchanged)
  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Denied', 'We need permission to access your media library.'); return; }
    setVideoDuration(null); 
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, allowsEditing: true, quality: 1, });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.duration) {
          setVideoDuration(Math.floor(asset.duration / 1000)); 
      } else {
          Alert.alert("Error", "Could not read video duration. Please try a different file.");
          setVideoFile(null); return;
      }
      setVideoFile(asset);
    }
  };

  // Pick thumbnail logic (unchanged)
  const pickThumbnail = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Denied', 'We need permission to access your media library.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 1, });
    if (!result.canceled && result.assets[0]) {
      setThumbnailFile(result.assets[0]);
    }
  };

  const handleUpload = () => {
    uploadMutation.mutate();
  };
  
  const formatDuration = (seconds: number | null) => {
      if (seconds === null) return 'N/A';
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
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
                uploadMutation.isPending || isLoadingMonetization || videoDuration === null && videoFile !== null ? styles.uploadButtonDisabled : null,
              ]}
              onPress={handleUpload}
              disabled={uploadMutation.isPending || isLoadingMonetization || videoDuration === null && videoFile !== null}
            >
              {uploadMutation.isPending || isLoadingMonetization ? (
                <ActivityIndicator color={Colors.text} size="small" />
              ) : (
                <Text style={styles.uploadButtonText}>Upload</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* ... Video Details Section (unchanged) ... */}
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
                    Duration: {videoDuration === null ? 'Calculating...' : formatDuration(videoDuration)}
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
        {/* ... Thumbnail Section (unchanged) ... */}
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

          {/* 2. TAGS FIX: Show current chips and input field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              <Tag color={Colors.text} size={16} /> Tags
            </Text>
            
            <View style={styles.tagsContainer}>
                {tags.map((tag, index) => (
                    <View key={index} style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{tag}</Text>
                        <TouchableOpacity onPress={() => removeTag(tag)} style={styles.tagChipRemove}>
                            <X color={Colors.text} size={12} />
                        </TouchableOpacity>
                    </View>
                ))}
                
                <TextInput
                    style={[styles.tagInput, { minWidth: tags.length === 0 ? '100%' : 100 }]}
                    placeholder="Add tags separated by comma"
                    placeholderTextColor={Colors.textMuted}
                    value={tagInput}
                    onChangeText={handleTagInput}
                    onSubmitEditing={() => {
                      // Process tag on 'Done'/'Enter' press
                      if (tagInput.trim()) {
                        handleTagInput(tagInput.trim() + ',');
                        Keyboard.dismiss(); 
                      }
                    }}
                    returnKeyType={Platform.OS === 'ios' ? 'done' : 'next'}
                />
            </View>
            <Text style={styles.hint}>
              <Sparkles color={Colors.info} size={14} /> Press comma (,) or Enter to create a tag
            </Text>
          </View>
        </View>
        {/* ... Visibility Section (unchanged) ... */}
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

          {/* 3. MONETIZATION VISIBILITY FIX: Show Switch ONLY IF eligible */}
          {isLoadingMonetization ? (
            <View style={styles.loadingMonetization}>
                <ActivityIndicator color={Colors.textSecondary} size="small" />
                <Text style={styles.settingDescription}>Checking eligibility...</Text>
            </View>
          ) : isMonetizationEligible && (
            // Only render the switch if the channel is eligible/approved and enabled
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Text style={styles.settingLabel}>
                    <DollarSign color={Colors.success} size={16} /> Monetization
                </Text>
                <Text style={styles.settingDescription}>Enable ads on this video</Text>
              </View>
              <Switch
                value={monetize}
                onValueChange={setMonetize}
                trackColor={{ false: Colors.border, true: Colors.success }}
                thumbColor={Colors.text}
              />
            </View>
          )}
          
          {/* Note: The Non-Eligible Notice is completely REMOVED as requested */}
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
    fontSize: 14,
    fontWeight: '600' as const,
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
  // 🔴 TAGS FIX: New style for wrapping chips and input
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 8,
    minHeight: 50,
  },
  tagChip: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
    gap: 4,
  },
  tagChipText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  tagChipRemove: {
    padding: 2,
  },
  tagInput: {
    // Input must behave inline with chips
    flexGrow: 1,
    minHeight: 30,
    fontSize: 15,
    color: Colors.text,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  // ------------------------------------
  
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
    flexDirection: 'row', // Ensure icon is inline
    alignItems: 'center',
    gap: 6,
  },
  settingDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  bottomSpacer: {
    height: 40,
  },
  loadingMonetization: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  nonEligibleNotice: {
      paddingVertical: 12,
  },
  nonEligibleText: {
      fontSize: 13,
      color: Colors.textMuted,
      lineHeight: 18,
  }
});
