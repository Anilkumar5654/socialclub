import { ThumbsUp, ThumbsDown, Share2, MessageCircle, Download, MoreVertical } from 'lucide-react-native';
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Colors from '@/constants/colors'; // Adjusted Path

// Helper function (must be defined or imported in player.tsx if used directly there)
const formatViews = (views: number | undefined | null) => {
    const safeViews = Number(views) || 0;
    if (safeViews >= 1000000) return `${(safeViews / 1000000).toFixed(1)}M`;
    if (safeViews >= 1000) return `${(safeViews / 1000).toFixed(1)}K`;
    return safeViews.toString();
};

interface VideoActionsProps {
    likesCount: number;
    isLiked: boolean;
    isDisliked: boolean;
    handleLike: () => void;
    handleDislike: () => void;
    handleShare: () => void;
    setShowComments: (show: boolean) => void;
    setShowMenu: (show: boolean) => void;
}

export default function VideoActions({
    likesCount,
    isLiked,
    isDisliked,
    handleLike,
    handleDislike,
    handleShare,
    setShowComments,
    setShowMenu
}: VideoActionsProps) {
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsScroll}>
            
            {/* 1. LIKE/DISLIKE PILL */}
            <View style={styles.actionPill}>
                <TouchableOpacity style={styles.likeBtn} onPress={handleLike}>
                    <ThumbsUp size={20} color={isLiked ? Colors.primary : Colors.text} fill={isLiked ? Colors.primary : "transparent"} />
                    <Text style={[styles.actionTextLike, isLiked && {color: Colors.primary}]}>{formatViews(likesCount)}</Text>
                </TouchableOpacity>

                <View style={styles.separator} />

                <TouchableOpacity style={styles.dislikeBtn} onPress={handleDislike}>
                    <ThumbsDown size={20} color={isDisliked ? Colors.primary : Colors.text} fill={isDisliked ? Colors.primary : "transparent"} />
                </TouchableOpacity>
            </View>

            {/* 2. Comment Button */}
            <TouchableOpacity style={styles.iconBtnRound} onPress={() => setShowComments(true)}>
                <MessageCircle size={20} color={Colors.text} />
            </TouchableOpacity>

            {/* 3. Download Button (Placeholder) */}
            <TouchableOpacity style={styles.iconBtnRound} onPress={() => {}}>
                <Download size={20} color={Colors.text} />
            </TouchableOpacity>

            {/* 4. Share Button */}
            <TouchableOpacity style={styles.iconBtnRound} onPress={handleShare}>
                <Share2 size={20} color={Colors.text} />
            </TouchableOpacity>

            {/* 5. Menu Button */}
            <TouchableOpacity style={styles.iconBtnRound} onPress={() => { setShowMenu(true) }}>
                <MoreVertical size={20} color={Colors.text} />
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    actionsScroll: { paddingHorizontal: 12, paddingVertical: 12, gap: 12 },
    actionPill: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#222', 
        borderRadius: 24, 
        overflow: 'hidden'
    },
    likeBtn: {
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16, 
        paddingVertical: 10, 
        gap: 8,
    },
    dislikeBtn: {
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16, 
        paddingVertical: 10, 
        gap: 8,
    },
    actionTextLike: { color: '#fff', fontSize: 14, fontWeight: '600' },
    separator: { width: 1, height: 18, backgroundColor: '#444' },

    iconBtnRound: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#222',
        justifyContent: 'center', alignItems: 'center'
    },
});
