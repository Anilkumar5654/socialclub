import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import Colors from '@/constants/colors';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}: SkeletonLoaderProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function VideoCardSkeleton() {
  return (
    <View style={styles.videoCardSkeleton}>
      <SkeletonLoader
        width="100%"
        height={200}
        borderRadius={12}
        style={{ marginBottom: 8 }}
      />
      <SkeletonLoader width="90%" height={16} style={{ marginBottom: 6 }} />
      <SkeletonLoader width="70%" height={14} />
    </View>
  );
}

export function PostCardSkeleton() {
  return (
    <View style={styles.postCardSkeleton}>
      <View style={styles.postHeaderSkeleton}>
        <SkeletonLoader width={40} height={40} borderRadius={20} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SkeletonLoader width="40%" height={14} style={{ marginBottom: 6 }} />
          <SkeletonLoader width="30%" height={12} />
        </View>
      </View>
      <SkeletonLoader
        width="100%"
        height={400}
        borderRadius={0}
        style={{ marginBottom: 12 }}
      />
      <SkeletonLoader width="60%" height={14} style={{ marginBottom: 8 }} />
      <SkeletonLoader width="80%" height={12} />
    </View>
  );
}

export function StoryCardSkeleton() {
  return (
    <View style={styles.storyCardSkeleton}>
      <SkeletonLoader width={64} height={64} borderRadius={32} />
      <SkeletonLoader width={64} height={10} style={{ marginTop: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.surface,
  },
  videoCardSkeleton: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  postCardSkeleton: {
    marginBottom: 16,
  },
  postHeaderSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  storyCardSkeleton: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
});
