import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { X, ImageIcon, Video, Loader } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { api } from '@/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function StoryUploadScreen() {
  const [selectedMedia, setSelectedMedia] = useState<{
    uri: string;
    type: 'image' | 'video';
    mimeType: string;
  } | null>(null);

  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (media: { uri: string; type: 'image' | 'video'; mimeType: string }) => {
      const formData = new FormData();
      
      const uriParts = media.uri.split('.');
      const fileType = uriParts[uriParts.length - 1];
      
      const mediaFile: any = {
        uri: Platform.OS === 'ios' ? media.uri.replace('file://', '') : media.uri,
        name: `story.${fileType}`,
        type: media.mimeType,
      };
      
      formData.append('media', mediaFile);
      formData.append('media_type', media.type);
      
      return api.stories.upload(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      Alert.alert('Success', 'Story uploaded successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to upload story');
    },
  });

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'Camera and media library permissions are required to upload stories.'
      );
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedMedia({
        uri: asset.uri,
        type: 'image',
        mimeType: asset.mimeType || 'image/jpeg',
      });
    }
  };

  const pickVideo = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedMedia({
        uri: asset.uri,
        type: 'video',
        mimeType: asset.mimeType || 'video/mp4',
      });
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedMedia({
        uri: asset.uri,
        type: 'image',
        mimeType: asset.mimeType || 'image/jpeg',
      });
    }
  };

  const handleUpload = () => {
    if (!selectedMedia) return;
    uploadMutation.mutate(selectedMedia);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          presentation: 'modal',
        }} 
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create Story</Text>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <X color={Colors.text} size={28} />
          </TouchableOpacity>
        </View>

        {selectedMedia ? (
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: selectedMedia.uri }}
              style={styles.previewImage}
              contentFit="contain"
            />
            
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setSelectedMedia(null)}
              >
                <Text style={styles.actionButtonText}>Choose Different</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.uploadButton]}
                onPress={handleUpload}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader color={Colors.text} size={20} />
                    <Text style={styles.uploadButtonText}>Uploading...</Text>
                  </>
                ) : (
                  <Text style={styles.uploadButtonText}>Share Story</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.selectContainer}>
            <Text style={styles.selectTitle}>Add to your story</Text>
            <Text style={styles.selectSubtitle}>
              Share a photo or video that will disappear after 24 hours
            </Text>

            <View style={styles.optionsContainer}>
              <TouchableOpacity 
                style={styles.option}
                onPress={takePhoto}
              >
                <View style={styles.optionIcon}>
                  <ImageIcon color={Colors.primary} size={32} />
                </View>
                <Text style={styles.optionText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.option}
                onPress={pickImage}
              >
                <View style={styles.optionIcon}>
                  <ImageIcon color={Colors.primary} size={32} />
                </View>
                <Text style={styles.optionText}>Choose Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.option}
                onPress={pickVideo}
              >
                <View style={styles.optionIcon}>
                  <Video color={Colors.primary} size={32} />
                </View>
                <Text style={styles.optionText}>Choose Video</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  selectContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  selectTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  selectSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 22,
  },
  optionsContainer: {
    width: '100%',
    gap: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 16,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  previewContainer: {
    flex: 1,
  },
  previewImage: {
    flex: 1,
    width: SCREEN_WIDTH,
    backgroundColor: Colors.surface,
  },
  actionsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  uploadButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    flexDirection: 'row',
    gap: 8,
  },
  uploadButtonText: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700' as const,
  },
});
