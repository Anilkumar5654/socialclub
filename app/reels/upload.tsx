import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Keyboard, TouchableWithoutFeedback, StatusBar } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { X, ArrowLeft, Upload, Video as VideoIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { api } from '@/services/api';

export default function ReelUploadScreen() {
    const insets = useSafeAreaInsets();
    const [videoUri, setVideoUri] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [duration, setDuration] = useState(0);
    const queryClient = useQueryClient();

    const pickVideo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            quality: 1,
            videoMaxDuration: 60, // 60 Sec Limit for Reels
        });

        if (!result.canceled && result.assets[0]) {
            setVideoUri(result.assets[0].uri);
            setDuration(result.assets[0].duration ? result.assets[0].duration / 1000 : 0);
        }
    };

    const uploadMutation = useMutation({
        mutationFn: async () => {
            if (!videoUri) throw new Error("No video selected");
            const formData = new FormData();
            const filename = videoUri.split('/').pop() || 'reel.mp4';
            
            // @ts-ignore
            formData.append('file', { uri: videoUri, name: filename, type: 'video/mp4' });
            formData.append('caption', caption);
            formData.append('duration', Math.round(duration).toString());
            formData.append('media_type', 'video'); // Force video type for reels

            return api.reels.upload(formData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reels-feed'] });
            Alert.alert("Success", "Reel uploaded successfully!", [{ text: "OK", onPress: () => router.back() }]);
        },
        onError: (err: any) => {
            Alert.alert("Error", err.message || "Upload failed");
        }
    });

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="light-content" />
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}><ArrowLeft color="#fff" size={24} /></TouchableOpacity>
                <Text style={styles.headerTitle}>New Reel</Text>
                <View style={{ width: 24 }} />
            </View>

            {!videoUri ? (
                <View style={styles.emptyState}>
                    <TouchableOpacity style={styles.pickBtn} onPress={pickVideo}>
                        <VideoIcon size={40} color="#fff" />
                        <Text style={styles.pickText}>Select Video</Text>
                    </TouchableOpacity>
                    <Text style={styles.hint}>Max duration: 60 seconds</Text>
                </View>
            ) : (
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.content}>
                        <View style={styles.previewContainer}>
                            <Video
                                source={{ uri: videoUri }}
                                style={styles.videoPreview}
                                resizeMode={ResizeMode.COVER}
                                shouldPlay
                                isLooping
                                isMuted
                            />
                            <TouchableOpacity style={styles.removeBtn} onPress={() => setVideoUri(null)}>
                                <X color="#fff" size={20} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.form}>
                            <TextInput
                                style={styles.input}
                                placeholder="Write a caption..."
                                placeholderTextColor="#888"
                                value={caption}
                                onChangeText={setCaption}
                                multiline
                                maxLength={200}
                            />
                            <TouchableOpacity 
                                style={[styles.uploadBtn, uploadMutation.isPending && styles.disabledBtn]} 
                                onPress={() => uploadMutation.mutate()}
                                disabled={uploadMutation.isPending}
                            >
                                {uploadMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Share Reel</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pickBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    pickText: { color: '#fff', fontWeight: '600' },
    hint: { color: '#666', fontSize: 12 },
    content: { flex: 1 },
    previewContainer: { height: 400, margin: 16, borderRadius: 12, overflow: 'hidden', backgroundColor: '#111', position: 'relative' },
    videoPreview: { width: '100%', height: '100%' },
    removeBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 20 },
    form: { padding: 16 },
    input: { backgroundColor: '#111', color: '#fff', borderRadius: 8, padding: 16, minHeight: 80, textAlignVertical: 'top', fontSize: 16 },
    uploadBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 30, alignItems: 'center', marginTop: 20 },
    disabledBtn: { opacity: 0.5 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 }
});
