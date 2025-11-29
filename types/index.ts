export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  avatar: string;
  bio?: string;
  isVerified: boolean;
  is_verified?: boolean;
  followersCount: number;
  followers_count?: number;
  followingCount: number;
  following_count?: number;
  postsCount: number;
  posts_count?: number;
  coverPhoto?: string;
  cover_photo?: string;
  website?: string;
  location?: string;
  phone?: string;
  isFollowing?: boolean;
  is_following?: boolean;
  channel_id?: string;
  channel_name?: string;
}

export interface Post {
  id: string;
  user: User;
  type: 'text' | 'photo' | 'video' | 'reel' | 'short';
  content?: string;
  images?: string[];
  videoUrl?: string;
  thumbnailUrl?: string;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  timestamp: string;
  created_at?: string;
  location?: string;
  hashtags?: string[];
  duration?: string;
  views?: number;
}

export interface Reel {
  id: string;
  user: User;
  videoUrl: string;
  thumbnailUrl: string;
  caption: string;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  music?: {
    title: string;
    artist: string;
  };
  views: number;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  cover_photo?: string;
  subscribers_count: number;
  videos_count?: number;
  user_id?: string;
  is_verified?: boolean;
  created_at?: string;
}

export interface Video {
  id: string;
  user: User;
  title: string;
  description: string;
  thumbnailUrl: string;
  thumbnail_url?: string;
  videoUrl: string;
  video_url?: string;
  duration: string;
  views: number;
  likes: number;
  comments: number;
  uploadDate: string;
  category: string;
  viral_score?: number;
  created_at?: string;
  timestamp?: string;
  isLiked?: boolean;
  isSubscribed?: boolean;
  caption?: string;
  channel?: Channel;
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'video';
  user: User;
  content: string;
  timestamp: string;
  isRead: boolean;
  postId?: string;
  postThumbnail?: string;
}

export interface Message {
  id: string;
  user: User;
  lastMessage: string;
  timestamp: string;
  isOnline: boolean;
  unreadCount: number;
}

export interface Comment {
  id: string;
  user: User;
  content: string;
  likes: number;
  timestamp: string;
  created_at?: string;
  replies?: Comment[];
}

export interface CreatorStats {
  totalFollowers: number;
  totalViews: number;
  totalLikes: number;
  engagementRate: number;
  topPost?: Post;
  topReel?: Reel;
  topVideo?: Video;
  monthlyGrowth: {
    followers: number;
    views: number;
    engagement: number;
  };
  earnings?: {
    adRevenue: number;
    reelsBonus: number;
    liveGifts: number;
    total: number;
  };
}

export interface VideoPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isFullscreen: boolean;
  quality: '360p' | '480p' | '720p' | '1080p' | 'auto';
}
