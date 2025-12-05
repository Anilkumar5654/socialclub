import React, { useState, useRef } from 'react';
import { 
    View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, 
    Keyboard, TouchableWithoutFeedback, StatusBar, Modal, ScrollView, Platform, KeyboardAvoidingView 
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router'; // Correct Import
import { X, ArrowLeft, Upload, Video as VideoIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { api } from '@/services/api';

// --- CUSTOM ALERT COMPONENT ---
const CustomAlert = ({ visible, title, message, onConfirm, confirmText = 'OK' }: any) => {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.alertOverlay}>
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          <TouchableOpacity onPress={onConfirm} style={styles.alertBtnConfirm}>
            <Text style={styles.alertBtnTextConfirm}>{confirmText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function ReelUploadScreen() {
    const insets = useSafeAreaInsets();
    const [videoUri, setVideoUri] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [duration, setDuration] = useState(0);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
    const queryClient = useQueryClient();

    const showAlert = (title: string, message: string, onConfirm: () => void) => {
        setAlertConfig({ visible: true, title, message, onConfirm: () => { setAlertConfig({ visible: false }); onConfirm(); } });
    };

    const pickVideo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            quality: 1,
            videoMaxDuration: 60, 
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
            formData.append('media_type', 'video');

            return api.reels.upload(formData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reels-feed'] });
            showAlert("Success", "Reel uploaded successfully!", () => router.back());
        },
        onError: (err: any) => {
            showAlert("Error", err.message || "Upload failed", () => {});
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

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
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
                                    <Text style={styles.label}>Caption</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Write a caption..."
                                        placeholderTextColor="#666"
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
                </ScrollView>
            </KeyboardAvoidingView>

            <CustomAlert 
                visible={alertConfig.visible} 
                title={alertConfig.title} 
                message={alertConfig.message} 
                onConfirm={alertConfig.onConfirm} 
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 400 },
    pickBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    pickText: { color: '#fff', fontWeight: '600' },
    hint: { color: '#666', fontSize: 12 },
    content: { flex: 1 },
    previewContainer: { height: 400, margin: 16, borderRadius: 12, overflow: 'hidden', backgroundColor: '#111', position: 'relative' },
    videoPreview: { width: '100%', height: '100%' },
    removeBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 20 },
    form: { padding: 16, paddingBottom: 50 },
    label: { color: '#888', marginBottom: 8, fontWeight: '600' },
    input: { backgroundColor: '#111', color: '#fff', borderRadius: 8, padding: 16, minHeight: 100, textAlignVertical: 'top', fontSize: 16, borderWidth: 1, borderColor: '#333' },
    uploadBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 30, alignItems: 'center', marginTop: 20 },
    disabledBtn: { opacity: 0.5 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    // Alert Styles
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
    alertBox: { width: '80%', backgroundColor: '#1E1E1E', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    alertTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
    alertMessage: { color: '#AAA', fontSize: 14, textAlign: 'center', marginBottom: 20 },
    alertBtnConfirm: { width: '100%', paddingVertical: 12, borderRadius: 8, backgroundColor: '#333', alignItems: 'center' },
    alertBtnTextConfirm: { color: Colors.primary, fontWeight: '600' }
});
