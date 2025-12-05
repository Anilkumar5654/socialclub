import { X, Send, Trash2 } from 'lucide-react-native';
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, FlatList, TextInput } from 'react-native';
import { Image } from 'expo-image'; 
import Colors from '@/constants/colors'; 
import { formatTimeAgo } from '@/constants/timeFormat'; 
import { api, MEDIA_BASE_URL } from '@/services/api'; // <<< FIXED: ADDED MEDIA_BASE_URL
// Note: api is needed just to access MEDIA_BASE_URL which is usually part of that services file

// Helper functions (defined here for self-containment)
const getMediaUrl = (path: string | undefined) => {
    if (!path) return '';
    return path.startsWith('http') ? path : `${MEDIA_BASE_URL}/${path}`;
};
const formatViews = (views: number | undefined | null) => {
    const safeViews = Number(views) || 0;
    if (safeViews >= 1000000) return `${(safeViews / 1000000).toFixed(1)}M`;
    if (safeViews >= 1000) return `${(safeViews / 1000).toFixed(1)}K`;
    return safeViews.toString();
};

interface VideoModalsProps {
    // Description/Video data
    videoTitle: string;
    viewsDisplay: string;
    videoCreatedAt: string;
    videoDescription: string;

    // Comment Data/State
    comments: any[];
    commentText: string;
    setCommentText: (text: string) => void;
    commentMutation: () => void;
    
    // Modal State
    showComments: boolean;
    showDescription: boolean;
    setShowComments: (show: boolean) => void;
    setShowDescription: (show: boolean) => void;

    // Options Menu State
    showMenu: boolean;
    setShowMenu: (show: boolean) => void;
    isOwner: boolean;
    handleDelete: () => void;
    handleReport: () => void;
    handleSave: () => void;
}

// --- OPTIONS MENU MODAL ---
function OptionsMenuModal({ visible, onClose, isOwner, onDelete, onReport, onSave }: any) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={menuStyles.menuOverlay} activeOpacity={1} onPress={onClose}>
                <View style={menuStyles.menuBox}>
                    
                    <TouchableOpacity style={menuStyles.menuItemNoIcon} onPress={() => { onClose(); onSave(); }}>
                        <Text style={menuStyles.menuText}>Save Video</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={menuStyles.menuItemNoIcon} onPress={() => { onClose(); onReport(); }}>
                        <Text style={menuStyles.menuText}>Report</Text>
                    </TouchableOpacity>

                    {isOwner && (
                        <TouchableOpacity style={[menuStyles.menuItem, menuStyles.menuItemDestructive]} onPress={() => { onClose(); onDelete(); }}>
                            <Trash2 size={20} color="#FF4444" /><Text style={[menuStyles.menuText, { color: '#FF4444' }]}>Delete Video</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={[menuStyles.menuItem, menuStyles.menuItemDestructive]} onPress={onClose}>
                        <X size={20} color={Colors.textSecondary} /><Text style={menuStyles.menuText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

// --- MAIN MODALS COMPONENT ---
export default function VideoModals({
    videoTitle,
    viewsDisplay,
    videoCreatedAt,
    videoDescription,
    comments,
    commentText,
    setCommentText,
    commentMutation,
    showComments,
    showDescription,
    setShowComments,
    setShowDescription,
    showMenu,
    setShowMenu,
    isOwner,
    handleDelete,
    handleReport,
    handleSave,
}: VideoModalsProps) {

    // Comment Item Renderer
    const renderCommentItem = ({ item }: { item: any }) => (
        <View style={styles.commentItem}>
            <Image source={{ uri: getMediaUrl(item.user.avatar) }} style={styles.commentAvatar} />
            <View style={{flex:1}}>
                <Text style={styles.commentUser}>
                    {item.user.username} · 
                    <Text style={{fontWeight:'400', color:'#666', fontSize:12}}>
                        {formatTimeAgo(item.created_at)}
                    </Text>
                </Text>
                <Text style={styles.commentBody}>{item.content}</Text>
            </View>
        </View>
    );

    return (
        <>
            {/* Comments Modal */}
            <Modal visible={showComments} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowComments(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Comments</Text>
                        <TouchableOpacity onPress={() => setShowComments(false)}><X color={Colors.textSecondary} size={24} /></TouchableOpacity>
                    </View>
                    <FlatList 
                        data={comments} 
                        keyExtractor={i => i.id} 
                        renderItem={renderCommentItem} 
                    />
                    <View style={styles.inputArea}>
                        <TextInput style={styles.input} placeholder="Add a comment..." value={commentText} onChangeText={setCommentText} placeholderTextColor="#888" />
                        <TouchableOpacity onPress={() => commentText.trim() && commentMutation()}><Send color={commentText.trim() ? Colors.primary : '#666'} /></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Description Modal */}
            <Modal visible={showDescription} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowDescription(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Description</Text>
                        <TouchableOpacity onPress={() => setShowDescription(false)}><X color={Colors.textSecondary} size={24} /></TouchableOpacity>
                    </View>
                    <ScrollView style={{padding: 16}}>
                        <Text style={styles.title}>{videoTitle}</Text>
                        <Text style={styles.meta}>{viewsDisplay} views · {formatTimeAgo(videoCreatedAt)}</Text>
                        <View style={{marginTop: 15, borderTopWidth:1, borderTopColor:'#222', paddingTop: 15}}>
                            <Text style={styles.descTextFull}>{videoDescription || 'No description provided for this video.'}</Text>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
            
            {/* Options Menu Modal */}
            <OptionsMenuModal 
                visible={showMenu}
                onClose={() => setShowMenu(false)}
                isOwner={isOwner}
                onDelete={handleDelete}
                onReport={handleReport}
                onSave={handleSave} 
            />
        </>
    );
}

// --- STYLES ---

const menuStyles = StyleSheet.create({
    menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'flex-end', flexDirection: 'row' },
    menuBox: { width: '100%', backgroundColor: '#1E1E1E', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 10, borderWidth: 1, borderColor: '#333' }, 
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, gap: 16 },
    menuItemNoIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 26, 
        justifyContent: 'flex-start',
    },
    menuItemDestructive: { borderTopWidth: 1, borderTopColor: '#333', marginTop: 5, paddingTop: 15 },
    menuText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
});

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#222', alignItems:'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  commentItem: { flexDirection: 'row', padding: 16, gap: 12, borderBottomWidth: 1, borderColor: '#111' },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#333' },
  commentUser: { fontWeight: '700', fontSize: 13, color: Colors.text, marginBottom: 2 },
  commentBody: { fontSize: 14, color: Colors.textSecondary },
  inputArea: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderColor: '#222', alignItems: 'center', paddingBottom: 30 },
  input: { flex: 1, backgroundColor: '#111', borderRadius: 20, padding: 10, marginRight: 10, color: Colors.text },
  
  // Description styles reused
  title: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 6, lineHeight: 24 },
  meta: { fontSize: 12, color: Colors.textSecondary },
  descTextFull: { fontSize: 14, color: Colors.text, lineHeight: 22 },
});
