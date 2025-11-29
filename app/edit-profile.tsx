import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, X, Check, User, Info, Link2 } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { buildMediaUrl } from '@/constants/media';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();

  // Form states
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [location, setLocation] = useState(user?.location || '');
  const [phone, setPhone] = useState(user?.phone || '');

  // Image states
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [profileImageFile, setProfileImageFile] = useState<any>(null);
  const [coverImageFile, setCoverImageFile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || '');
      setBio(user.bio || '');
      setWebsite(user.website || '');
      setLocation(user.location || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  // Current images
  const currentProfileImage = buildMediaUrl(user?.avatar, 'userProfile');

  const currentCoverImage = buildMediaUrl(user?.coverPhoto || user?.cover_photo, 'userCover');

  // Image picker functions
  const pickImage = async (type: 'profile' | 'cover') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'profile' ? [1, 1] : [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (type === 'profile') {
        setProfileImage(asset.uri);
        setProfileImageFile({
          uri: asset.uri,
          name: `profile_${Date.now()}.jpg`,
          type: 'image/jpeg',
        });
      } else {
        setCoverImage(asset.uri);
        setCoverImageFile({
          uri: asset.uri,
          name: `cover_${Date.now()}.jpg`,
          type: 'image/jpeg',
        });
      }
    }
  };

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      
      // Add text fields
      formData.append('name', name);
      formData.append('username', username);
      formData.append('bio', bio);
      formData.append('website', website);
      formData.append('location', location);
      formData.append('phone', phone);

      // Add images if changed
      if (profileImageFile) {
        formData.append('profile_image', profileImageFile as any);
      }
      if (coverImageFile) {
        formData.append('cover_image', coverImageFile as any);
      }

      const response = await api.users.updateProfile(formData);
      return response;
    },
    onSuccess: (data) => {
      if (data.user) {
        updateUser(data.user);
      }
      queryClient.invalidateQueries({ queryKey: ['user-posts'] });
      queryClient.invalidateQueries({ queryKey: ['user-reels'] });
      queryClient.invalidateQueries({ queryKey: ['user-videos'] });
      
      Alert.alert('Success', 'Profile updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update profile');
    },
  });

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    if (!username.trim()) {
      Alert.alert('Error', 'Username is required');
      return;
    }
    updateProfileMutation.mutate();
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <X color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity 
          onPress={handleSave} 
          style={styles.headerButton}
          disabled={updateProfileMutation.isPending}
        >
          {updateProfileMutation.isPending ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Check color={Colors.primary} size={24} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Cover Photo Section */}
        <View style={styles.coverSection}>
          <Image 
            source={{ uri: coverImage || currentCoverImage }}
            style={styles.coverPhoto}
            contentFit="cover"
          />
          <TouchableOpacity 
            style={styles.changeCoverButton}
            onPress={() => pickImage('cover')}
          >
            <Camera color={Colors.text} size={20} />
            <Text style={styles.changePhotoText}>Change Cover</Text>
          </TouchableOpacity>

          {/* Profile Photo */}
          <View style={styles.profilePhotoContainer}>
            <Image 
              source={{ uri: profileImage || currentProfileImage }}
              style={styles.profilePhoto}
              contentFit="cover"
            />
            <TouchableOpacity 
              style={styles.changeProfileButton}
              onPress={() => pickImage('profile')}
            >
              <Camera color={Colors.text} size={18} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Name Input */}
          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <User color={Colors.textSecondary} size={18} />
              <Text style={styles.inputLabel}>Name</Text>
            </View>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Username Input */}
          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <Text style={styles.atSymbol}>@</Text>
              <Text style={styles.inputLabel}>Username</Text>
            </View>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter username"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />
          </View>

          {/* Bio Input */}
          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <Info color={Colors.textSecondary} size={18} />
              <Text style={styles.inputLabel}>Bio</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{bio.length}/150</Text>
          </View>

          {/* Website Input */}
          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <Link2 color={Colors.textSecondary} size={18} />
              <Text style={styles.inputLabel}>Website</Text>
            </View>
            <TextInput
              style={styles.input}
              value={website}
              onChangeText={setWebsite}
              placeholder="https://example.com"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          {/* Location Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>📍 Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="City, Country"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Phone Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>📱 Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 234 567 8900"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          {/* Preview Card */}
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Profile Preview</Text>
            <View style={styles.previewContent}>
              <Image 
                source={{ uri: profileImage || currentProfileImage }}
                style={styles.previewAvatar}
                contentFit="cover"
              />
              <View style={styles.previewInfo}>
                <Text style={styles.previewName}>{name || 'Your Name'}</Text>
                <Text style={styles.previewUsername}>@{username || 'username'}</Text>
                {bio && <Text style={styles.previewBio} numberOfLines={2}>{bio}</Text>}
              </View>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity 
            style={[styles.saveButton, updateProfileMutation.isPending && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  coverSection: {
    position: 'relative',
    marginBottom: 60,
  },
  coverPhoto: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.surface,
  },
  changeCoverButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  changePhotoText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  profilePhotoContainer: {
    position: 'absolute',
    bottom: -50,
    left: 20,
  },
  profilePhoto: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: Colors.background,
  },
  changeProfileButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: Colors.primary,
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: Colors.background,
  },
  formSection: {
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  atSymbol: {
    fontSize: 18,
    color: Colors.textSecondary,
    fontWeight: '700' as const,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  charCount: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    fontSize: 12,
    color: Colors.textMuted,
  },
  previewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  previewContent: {
    flexDirection: 'row',
    gap: 12,
  },
  previewAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  previewUsername: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  previewBio: {
    fontSize: 14,
    color: Colors.text,
    marginTop: 6,
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
});