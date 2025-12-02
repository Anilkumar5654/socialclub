import { router, Stack } from 'expo-router';
import {
  Save,
  ArrowLeft,
  Camera,
} from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
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

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { api, MEDIA_BASE_URL } from '@/services/api'; 
import { useAuth } from '@/contexts/AuthContext'; 

// DUMMY TYPES (चैनलप्रोफ़ाइल से लिया गया)
interface ChannelData {
  id: string;
  name: string;
  avatar: string;
  handle?: string;
  bio?: string;
  about_text?: string;
}

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
  
  // --- QUERY: Fetch User's Channel Details ---
  const { data: channelData, isLoading, isError } = useQuery({
    queryKey: ['my-channel-profile', currentUserId],
    queryFn: async () => {
        // First, check if the user has a channel associated
        const checkResponse = await api.channels.checkUserChannel(currentUserId || '');
        const channelId = checkResponse?.channel?.id;

        if (channelId) {
            // Then fetch the channel details using the found ID
            return api.channels.getChannel(channelId);
        }
        // If the check fails, we throw an error which lands in isError state
        throw new Error('Channel not found for current user. Please create one.');
    },
    enabled: !!currentUserId,
    select: (data) => data?.channel,
  });

  const channel: ChannelData | undefined = channelData;

  // Initialize form state when channel data is fetched
  useEffect(() => {
    if (channel) {
      setChannelName(channel.name || '');
      setChannelHandle(channel.handle || '');
      setChannelBio(channel.bio || '');
      setChannelAbout(channel.about_text || '');
    }
  }, [channel]);

  // --- MUTATION: Update Channel Details ---
  const updateChannelMutation = useMutation({
    mutationFn: (data: Partial<ChannelData>) => {
      if (!channel?.id) throw new Error('Channel ID is missing');
      return api.channels.update(channel.id, data);
    },
    onSuccess: () => {
      Alert.alert('Success', 'Channel updated successfully!');
      // Invalidate both local and public view queries
      queryClient.invalidateQueries({ queryKey: ['my-channel-profile', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['channel-profile', channel?.id] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update channel.');
    },
  });

  const handleSave = () => {
    if (!channel) {
        Alert.alert('Error', 'Cannot save, channel data missing.');
        return;
    }
    
    // Validate basic fields
    if (!channelName.trim()) {
        Alert.alert('Validation', 'Channel name cannot be empty.');
        return;
    }

    const updatedData: Partial<ChannelData> = {
        name: channelName.trim(),
        handle: channelHandle.trim(),
        bio: channelBio.trim(),
        about_text: channelAbout.trim(),
    };

    updateChannelMutation.mutate(updatedData);
  };
  
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
    // If isError is true, it means checkUserChannel failed, likely meaning no channel exists
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Edit Channel' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Channel not found. You must create one first.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => Alert.alert('Action Required', 'Navigate to /create-channel to proceed.')}
          >
            <Text style={styles.retryButtonText}>Create Channel Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          headerShown: false, // Custom header
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
            {/* Cover Photo Placeholder */}
            <View style={styles.coverPlaceholder}>
                <Text style={styles.mediaLabel}>Channel Cover (16:9)</Text>
                <TouchableOpacity style={styles.mediaEditButton}>
                    <Camera color="white" size={24} />
                </TouchableOpacity>
            </View>

            {/* Avatar */}
            <View style={styles.avatarContainer}>
                <Image
                    source={{ uri: getMediaUri(channel.avatar) }}
                    style={styles.avatar}
                    contentFit="cover"
                />
                <TouchableOpacity style={styles.avatarEditButton}>
                    <Camera color={Colors.text} size={18} />
                </TouchableOpacity>
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
            <TextInput
                style={styles.input}
                value={channelHandle}
                onChangeText={setChannelHandle}
                placeholder="@yourhandle"
                placeholderTextColor={Colors.textMuted}
            />
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

        {/* --- Save Button (Optional: Already in Header) --- */}
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
    height: 120, // 16:9 ratio approximately
    backgroundColor: Colors.surface,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: -40, // Pull avatar up over cover
  },
  mediaLabel: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  mediaEditButton: {
    position: 'absolute',
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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
