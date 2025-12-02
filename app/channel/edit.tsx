import { router, Stack } from 'expo-router';
import {
  Save,
  ArrowLeft,
  Camera,
  RotateCcw,
} from 'lucide-react-native';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker'; 

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { api, MEDIA_BASE_URL } from '@/services/api'; 
import { useAuth } from '@/contexts/AuthContext'; 

// DUMMY TYPES
interface ChannelData {
  id: string;
  name: string;
  avatar: string;
  handle?: string;
  bio?: string;
  about_text?: string;
  last_handle_update?: string;
  cover_photo?: string;
}

const HANDLE_CHANGE_DAYS = 20;
const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;
const RESTRICTION_MILLIS = HANDLE_CHANGE_DAYS * MILLIS_PER_DAY;

const getMediaUri = (uri: string | undefined) => {
    if (!uri) return '';
    return uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`;
};

export default function EditChannelScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id;
  
  // --- LOCAL STATES ---
  const [channelName, setChannelName] = useState('');
  const [channelHandle, setChannelHandle] = useState('');
  const [channelBio, setChannelBio] = useState('');
  const [channelAbout, setChannelAbout] = useState('');
  
  // States to hold local URI for pending uploads
  const [newAvatarUri, setNewAvatarUri] = useState<string | null>(null);
  const [newCoverUri, setNewCoverUri] = useState<string | null>(null);
  
  // --- QUERY: Fetch User's Channel Details ---
  const { data: channelData, isLoading, isError } = useQuery({
    queryKey: ['my-channel-profile', currentUserId],
    queryFn: async () => {
        const checkResponse = await api.channels.checkUserChannel(currentUserId || '');
        const channelId = checkResponse?.channel?.id;

        if (channelId) {
            return api.channels.getChannel(channelId);
        }
        throw new Error('Channel not found for current user. Please create one.');
    },
    enabled: !!currentUserId,
    select: (data) => data?.channel as ChannelData,
  });

  const channel: ChannelData | undefined = channelData;
  const initialHandle = channel?.handle;

  // --- HANDLE RESTRICTION LOGIC ---
  const timeSinceLastUpdate = useMemo(() => {
    if (!channel?.last_handle_update) return RESTRICTION_MILLIS;
    
    const lastUpdateDate = new Date(channel.last_handle_update).getTime();
    const timeElapsed = Date.now() - lastUpdateDate;
    return timeElapsed;
  }, [channel?.last_handle_update]);

  const canChangeHandle = timeSinceLastUpdate >= RESTRICTION_MILLIS;

  const daysRemaining = useMemo(() => {
    if (canChangeHandle) return 0;
    const remainingMillis = RESTRICTION_MILLIS - timeSinceLastUpdate;
    return Math.ceil(remainingMillis / MILLIS_PER_DAY);
  }, [canChangeHandle, timeSinceLastUpdate]);
  // --- END HANDLE RESTRICTION LOGIC ---


  // Initialize form state when channel data is fetched
  useEffect(() => {
    if (channel) {
      setChannelName(channel.name || '');
      setChannelHandle(channel.handle || '');
      setChannelBio(channel.bio || '');
      setChannelAbout(channel.about_text || '');
    }
  }, [channel]);

  // --- MEDIA PICKERS (MOCK) ---
  const pickMedia = async (type: 'avatar' | 'cover') => {
    try {
        // Request permissions if needed
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
            Alert.alert("Permission required", "Permission to access media library is needed to upload images.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: type === 'avatar' ? [1, 1] : [16, 9],
            quality: 0.5,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const uri = result.assets[0].uri;
            if (type === 'avatar') {
                setNewAvatarUri(uri);
            } else {
                setNewCoverUri(uri);
            }
        }
    } catch (e) {
        Alert.alert('Error', 'Failed to pick media.');
    }
  };


  // --- MUTATION: Update Channel Details (Now sends FormData) ---
  const updateChannelMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      // NOTE: We assume api.channels.update is now configured in services/api.ts
      // to correctly handle FormData, like the user profile update endpoint.
      return api.channels.updateChannel(formData); // Assume a dedicated FormData function
    },
    onSuccess: (response: any) => {
      Alert.alert('Success', 'Channel updated successfully!');
      // Update local states based on successful server response path
      if (response.avatar_path) channel.avatar = response.avatar_path;
      if (response.cover_path) channel.cover_photo = response.cover_path;

      queryClient.invalidateQueries({ queryKey: ['my-channel-profile', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['channel-profile', channel?.id] });
      setNewAvatarUri(null);
      setNewCoverUri(null);
    },
    onError: (error: any) => {
      // Server-side validation errors (like handle restriction) are caught here
      Alert.alert('Update Failed', error.message || 'Failed to update channel.');
    },
  });

  const handleSave = () => {
    if (!channel) {
        Alert.alert('Error', 'Cannot save, channel data missing.');
        return;
    }
    
    if (!channelName.trim()) {
        Alert.alert('Validation', 'Channel name cannot be empty.');
        return;
    }

    // 1. Construct FormData
    const formData = new FormData();
    formData.append('channel_id', channel.id);
    
    // Append text fields
    formData.append('name', channelName.trim());
    formData.append('handle', channelHandle.trim());
    formData.append('bio', channelBio.trim());
    formData.append('about_text', channelAbout.trim());

    // 2. Handle Handle Time Restriction Check
    if (initialHandle !== channelHandle.trim()) {
        if (!canChangeHandle) {
            Alert.alert('Restriction', `Handle can be changed again in ${daysRemaining} days.`);
            return;
        }
        // Send flag to PHP to update handle time
        formData.append('updateHandleTime', 'true');
    }

    // 3. Append Media Files (If URIs are set)
    if (newAvatarUri) {
        // Expo needs to know the type for FormData
        formData.append('avatar', {
            uri: newAvatarUri,
            name: `avatar_${channel.id}.jpg`,
            type: 'image/jpeg',
        } as any);
    }
    if (newCoverUri) {
        formData.append('cover_photo', {
            uri: newCoverUri,
            name: `cover_${channel.id}.jpg`,
            type: 'image/jpeg',
        } as any);
    }
    
    updateChannelMutation.mutate(formData);
  };
  
  // --- RENDER STATES ---
  if (isLoading || !currentUserId) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Edit Channel' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Channel data is loading...</Text>
        </View>
      </View>
    );
  }

  if (isError || !channel) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Edit Channel' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Channel not found. You must create one first.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.push('/create-channel')} 
          >
            <Text style={styles.retryButtonText}>Create Channel Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentAvatar = newAvatarUri || getMediaUri(channel.avatar);
  const currentCover = newCoverUri || getMediaUri(channel.cover_photo);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Channel</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerButton} disabled={updateChannelMutation.isPending}>
          {updateChannelMutation.isPending ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Save color={Colors.primary} size={24} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* --- Avatar and Cover --- */}
        <View style={styles.mediaSection}>
            {/* Cover Photo */}
            <View style={styles.coverPlaceholder}>
                <Image
                    source={{ uri: currentCover }}
                    style={styles.coverImage}
                    contentFit="cover"
                />
                <TouchableOpacity style={styles.mediaEditButton} onPress={() => pickMedia('cover')}>
                    <Camera color="white" size={24} />
                </TouchableOpacity>
                {newCoverUri && <Text style={styles.pendingMediaText}>Cover pending upload</Text>}
            </View>

            {/* Avatar */}
            <View style={styles.avatarContainer}>
                <Image
                    source={{ uri: currentAvatar }}
                    style={styles.avatar}
                    contentFit="cover"
                />
                <TouchableOpacity style={styles.avatarEditButton} onPress={() => pickMedia('avatar')}>
                    <Camera color={Colors.text} size={18} />
                </TouchableOpacity>
                {newAvatarUri && <Text style={styles.pendingMediaTextAvatar}>Avatar pending upload</Text>}
            </View>
        </View>

        {/* --- Form Fields --- */}
        <Text style={styles.sectionTitle}>Channel Details</Text>
        
        <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
                style={styles.input}
                value={channelName}
                onChangeText={setChannelName}
                placeholder="Enter channel name"
                placeholderTextColor={Colors.textMuted}
            />
        </View>

        <View style={styles.inputGroup}>
            <Text style={styles.label}>Handle (Unique URL)</Text>
            
            {/* Handle Input with Restriction Logic */}
            <TextInput
                style={[styles.input, !canChangeHandle && styles.inputDisabled]}
                value={channelHandle}
                onChangeText={setChannelHandle}
                placeholder="@yourhandle"
                placeholderTextColor={Colors.textMuted}
                editable={canChangeHandle}
            />
            {!canChangeHandle && (
                <View style={styles.handleRestrictionNotice}>
                    <RotateCcw color={Colors.warning} size={14} />
                    <Text style={styles.handleRestrictionText}>
                        Handle can be changed again in {daysRemaining} days.
                    </Text>
                </View>
            )}
        </View>

        <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio (Short Description)</Text>
            <TextInput
                style={[styles.input, styles.textArea]}
                value={channelBio}
                onChangeText={setChannelBio}
                placeholder="Tell users what your channel is about (max 80 chars)"
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={80}
            />
        </View>
        
        <View style={styles.inputGroup}>
            <Text style={styles.label}>About Section (Detailed)</Text>
            <TextInput
                style={[styles.input, styles.textArea, { height: 120 }]}
                value={channelAbout}
                onChangeText={setChannelAbout}
                placeholder="Detailed description for the 'About' tab"
                placeholderTextColor={Colors.textMuted}
                multiline
            />
        </View>

        {/* --- Save Button --- */}
        <TouchableOpacity 
            style={[styles.saveButton, updateChannelMutation.isPending && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={updateChannelMutation.isPending}
        >
            <Text style={styles.saveButtonText}>
                {updateChannelMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: Colors.textSecondary, marginTop: 10 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: Colors.text, fontSize: 16, textAlign: 'center', marginBottom: 20 },
  retryButton: { backgroundColor: Colors.primary, padding: 10, borderRadius: 8 },
  retryButtonText: { color: Colors.text, fontWeight: '600' },
  
  // Custom Header Styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  headerButton: {
    padding: 8,
  },

  // Content Styles
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 20,
    marginTop: 10,
  },

  // Media (Avatar/Cover) Styles
  mediaSection: {
    marginBottom: 30,
    alignItems: 'center',
  },
  coverPlaceholder: {
    width: '100%',
    height: 120, // 16:9 ratio
    backgroundColor: Colors.surface,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: -40, 
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  mediaLabel: {
    color: Colors.textMuted,
    fontSize: 14,
    position: 'absolute',
    zIndex: 2,
  },
  mediaEditButton: {
    position: 'absolute',
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    zIndex: 3,
  },
  pendingMediaText: {
    position: 'absolute',
    bottom: 5,
    color: Colors.warning,
    fontSize: 12,
    zIndex: 3,
  },
  pendingMediaTextAvatar: {
    position: 'absolute',
    top: -10,
    right: -50,
    color: Colors.warning,
    fontSize: 12,
    zIndex: 3,
  },
  avatarContainer: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: Colors.background,
    backgroundColor: Colors.surface,
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    padding: 6,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  
  // Form Styles
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputDisabled: {
    backgroundColor: Colors.surface,
    opacity: 0.7,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  handleRestrictionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  handleRestrictionText: {
    fontSize: 13,
    color: Colors.warning,
  },
  
  // Save Button Styles
  saveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
