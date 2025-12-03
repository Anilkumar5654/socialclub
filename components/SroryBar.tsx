import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { formatTimeAgo } from '@/constants/timeFormat';
import { useAuth } from '@/contexts/AuthContext';
import { api, MEDIA_BASE_URL } from '@/services/api';

const { width } = Dimensions.get('window');

// ----------------------------------------------------------------
// StoryBar Component Logic
// ----------------------------------------------------------------

export default function StoryBar() {
  const { user: currentUser } = useAuth();
  const { data: storiesData, isLoading } = useQuery({
    queryKey: ['stories'],
    queryFn: () => api.stories.getStories(),
  });

  const stories = useMemo(() => {
    if (!storiesData?.stories) return [];
    
    // Grouping stories by user and sorting logic (kept as is)
    const groupedStories: { [key: string]: any } = {};
    
    storiesData.stories.forEach((story: any) => {
      const userId = story.user?.id || story.user_id;
      
      if (!groupedStories[userId]) {
        groupedStories[userId] = {
          userId,
          user: story.user || { id: userId, username: 'Unknown', avatar: '' },
          stories: [],
          hasUnwatched: false,
          latestStoryTime: story.created_at,
        };
      }
      
      groupedStories[userId].stories.push(story);
      
      if (new Date(story.created_at) > new Date(groupedStories[userId].latestStoryTime)) {
        groupedStories[userId].latestStoryTime = story.created_at;
      }
      
      if (!story.is_viewed && userId !== currentUser?.id) {
        groupedStories[userId].hasUnwatched = true;
      }
    });
    
    const storyArray = Object.values(groupedStories);
    
    storyArray.forEach((group: any) => {
      group.stories.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
    
    const myStory = storyArray.find((s: any) => s.userId === currentUser?.id);
    const otherStories = storyArray.filter((s: any) => s.userId !== currentUser?.id);
    
    const unwatchedStories = otherStories.filter((s: any) => s.hasUnwatched);
    const watchedStories = otherStories.filter((s: any) => !s.hasUnwatched);
    
    unwatchedStories.sort((a: any, b: any) => 
      new Date(b.latestStoryTime).getTime() - new Date(a.latestStoryTime).getTime()
    );
    watchedStories.sort((a: any, b: any) => 
      new Date(b.latestStoryTime).getTime() - new Date(a.latestStoryTime).getTime()
    );
    
    if (myStory) {
      return [myStory, ...unwatchedStories, ...watchedStories];
    }
    
    return [...unwatchedStories, ...watchedStories];
  }, [storiesData, currentUser]);

  const handleStoryPress = (userId: string) => {
    router.push({ pathname: '/story-viewer', params: { userId } });
  };

  const handleYourStoryPress = () => {
    router.push('/story-upload');
  };

  const getImageUri = (uri: string) => {
    if (!uri) return '';
    return uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`;
  };

  if (isLoading) {
    return (
      <View style={styles.storyBar}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const hasCurrentUserStory = stories.length > 0 && stories[0].userId === currentUser?.id;

  return (
    <View style={styles.storyBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {/* Your Story Button (if not already present in stories array) */}
        {!hasCurrentUserStory && (
          <TouchableOpacity 
            style={styles.storyItem}
            onPress={handleYourStoryPress}
          >
            <View style={styles.storyImageContainer}>
              <Image 
                source={{ uri: getImageUri(currentUser?.avatar || '') }} 
                style={[styles.storyImage, styles.yourStoryBorder]} 
              />
              <View style={styles.addStoryButton}>
                <Text style={styles.addStoryText}>+</Text>
              </View>
            </View>
            <Text style={styles.storyUsername} numberOfLines={1}>
              Your Story
            </Text>
          </TouchableOpacity>
        )}
        
        {/* Other Stories */}
        {stories.map((storyGroup: any) => {
          const isYourStory = storyGroup.userId === currentUser?.id;
          return (
            <TouchableOpacity 
              key={storyGroup.userId} 
              style={styles.storyItem}
              onPress={() => isYourStory ? handleYourStoryPress() : handleStoryPress(storyGroup.userId)}
            >
              <View style={styles.storyImageContainer}>
                <Image 
                  source={{ uri: getImageUri(storyGroup.user.avatar) }} 
                  style={[
                    styles.storyImage,
                    isYourStory ? styles.yourStoryBorder : storyGroup.hasUnwatched ? styles.unwatchedBorder : styles.watchedBorder,
                  ]} 
                />
                {isYourStory && (
                  <View style={styles.addStoryButton}>
                    <Text style={styles.addStoryText}>+</Text>
                  </View>
                )}
              </View>
              <Text style={styles.storyUsername} numberOfLines={1}>
                {isYourStory ? 'Your Story' : storyGroup.user.username}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ----------------------------------------------------------------
// StoryBar Styles (Extracted from previous HomeScreen styles)
// ----------------------------------------------------------------

const styles = StyleSheet.create({
  storyBar: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 12,
    minHeight: 100,
    justifyContent: 'center',
  },
  storyItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 72,
  },
  storyImageContainer: {
    position: 'relative',
  },
  storyImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: Colors.border,
  },
  yourStoryBorder: {
    borderColor: Colors.border,
  },
  unwatchedBorder: {
    borderColor: Colors.primary,
  },
  watchedBorder: {
    borderColor: Colors.border,
  },
  addStoryButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  addStoryText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
    lineHeight: 14,
  },
  storyUsername: {
    color: Colors.text,
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
});
