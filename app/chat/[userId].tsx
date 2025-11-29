import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Send, Smile, Image as ImageIcon, Mic, MoreVertical, Phone, Video } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/colors';
import { MOCK_USERS } from '@/mocks/data';

interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  isRead: boolean;
}

const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg1',
    senderId: '2',
    text: 'Hey! How are you doing?',
    timestamp: '10:30 AM',
    isRead: true,
  },
  {
    id: 'msg2',
    senderId: '1',
    text: 'I\'m great! Just finished my morning workout 💪',
    timestamp: '10:32 AM',
    isRead: true,
  },
  {
    id: 'msg3',
    senderId: '2',
    text: 'That\'s awesome! Did you see my latest video?',
    timestamp: '10:33 AM',
    isRead: true,
  },
  {
    id: 'msg4',
    senderId: '1',
    text: 'Yes! It was amazing. Really loved the editing style',
    timestamp: '10:35 AM',
    isRead: true,
  },
  {
    id: 'msg5',
    senderId: '2',
    text: 'Thanks! Took me hours to edit 😅',
    timestamp: '10:36 AM',
    isRead: true,
  },
  {
    id: 'msg6',
    senderId: '1',
    text: 'It definitely shows! The quality is top-notch 🔥',
    timestamp: '10:38 AM',
    isRead: true,
  },
  {
    id: 'msg7',
    senderId: '2',
    text: 'When are we doing that collab we talked about?',
    timestamp: '10:40 AM',
    isRead: false,
  },
];

function MessageBubble({ message, isMe }: { message: ChatMessage; isMe: boolean }) {
  return (
    <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
      <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
        <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{message.text}</Text>
        <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>{message.timestamp}</Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{ userId: string }>();
  const userId = params.userId || '2';
  const insets = useSafeAreaInsets();
  
  const otherUser = MOCK_USERS.find((u) => u.id === userId);
  const currentUserId = '1';
  
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHAT_MESSAGES);
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (inputText.trim()) {
      const newMessage: ChatMessage = {
        id: `msg${Date.now()}`,
        senderId: currentUserId,
        text: inputText.trim(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        isRead: false,
      };
      setMessages([...messages, newMessage]);
      setInputText('');
    }
  };

  if (!otherUser) {
    return null;
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: '',
          headerStyle: {
            backgroundColor: Colors.background,
          },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
          headerTitle: () => (
            <View style={styles.headerTitle}>
              <Image source={{ uri: otherUser.avatar }} style={styles.headerAvatar} />
              <View>
                <Text style={styles.headerName}>{otherUser.name}</Text>
                <Text style={styles.headerStatus}>Online</Text>
              </View>
            </View>
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerButton}>
                <Phone color={Colors.text} size={20} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton}>
                <Video color={Colors.text} size={20} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton}>
                <MoreVertical color={Colors.text} size={20} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble message={item} isMe={item.senderId === currentUserId} />
        )}
        contentContainerStyle={[styles.messagesList, { paddingBottom: insets.bottom + 16 }]}
        inverted={false}
      />

      <View style={[styles.inputContainer, { paddingBottom: insets.bottom }]}>
        <TouchableOpacity style={styles.inputButton}>
          <ImageIcon color={Colors.textSecondary} size={24} />
        </TouchableOpacity>
        
        <View style={styles.textInputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Message..."
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity style={styles.emojiButton}>
            <Smile color={Colors.textSecondary} size={22} />
          </TouchableOpacity>
        </View>

        {inputText.trim() ? (
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Send color={Colors.primary} size={22} fill={Colors.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.inputButton}>
            <Mic color={Colors.textSecondary} size={24} />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  headerStatus: {
    fontSize: 12,
    color: Colors.success,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16,
    marginRight: 8,
  },
  headerButton: {
    padding: 4,
  },
  messagesList: {
    padding: 16,
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  messageBubbleMe: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  messageTextMe: {
    color: Colors.text,
  },
  messageTime: {
    fontSize: 11,
    color: Colors.textSecondary,
    alignSelf: 'flex-end',
  },
  messageTimeMe: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  inputButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
    maxHeight: 100,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    maxHeight: 80,
  },
  emojiButton: {
    padding: 4,
    marginLeft: 4,
  },
  sendButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
