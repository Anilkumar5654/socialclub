import { ApiLogger } from '@/app/api-debug';
import { getDeviceId } from '@/utils/deviceId';

const API_BASE_URL = 'https://moviedbr.com/api';
const MEDIA_BASE_URL = 'https://moviedbr.com/upload';

export interface ApiError {
  message: string;
  status: number;
}

const apiDebugLogger = ApiLogger.log;

class ApiClient {
  private baseUrl: string;
  private mediaUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string, mediaUrl: string) {
    this.baseUrl = baseUrl;
    this.mediaUrl = mediaUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  getMediaUrl(path: string): string {
    if (!path) return '';
    return path.startsWith('http') ? path : `${this.mediaUrl}/${path}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const startTime = Date.now();
    const headers: Record<string, string> = {};
    const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;

    if (!isFormDataBody) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    let requestBody: any = undefined;
    if (isFormDataBody) {
      requestBody = 'FormData (multipart/form-data)';
    } else if (options.body && typeof options.body === 'string') {
      try {
        requestBody = JSON.parse(options.body);
      } catch {
        requestBody = options.body;
      }
    }

    if (apiDebugLogger) {
      apiDebugLogger({
        endpoint,
        method: options.method || 'GET',
        status: 'pending',
        request: requestBody,
      });
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const duration = Date.now() - startTime;
      const rawResponseText = await response.text();
      
      let responseData: any = null;
      let parseError: string | null = null;
      
      try {
        responseData = rawResponseText ? JSON.parse(rawResponseText) : null;
      } catch (jsonError: any) {
        parseError = jsonError.message;
        responseData = rawResponseText;
      }

      if (!response.ok) {
        const errorMessage = (responseData && typeof responseData === 'object' && responseData.message) || `HTTP ${response.status}`;
        
        if (apiDebugLogger) {
          apiDebugLogger({
            endpoint,
            method: options.method || 'GET',
            status: 'error',
            statusCode: response.status,
            request: requestBody,
            response: responseData,
            error: errorMessage,
            duration,
          });
        }
        
        throw { message: errorMessage, status: response.status };
      }

      if (apiDebugLogger) {
        apiDebugLogger({
          endpoint,
          method: options.method || 'GET',
          status: 'success', 
          statusCode: response.status,
          request: requestBody,
          duration,
        });
      }

      return responseData;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      if (apiDebugLogger && !error.status) {
        apiDebugLogger({
          endpoint,
          method: options.method || 'GET',
          status: 'error',
          request: requestBody,
          error: error.message || 'Network error',
          duration,
        });
      }
      throw error;
    }
  }

  // --- MODULES ---

  auth = {
    login: async (email: string, password: string) => this.request<{ token: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: async (name: string, username: string, email: string, password: string) => this.request<{ token: string; user: any }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, username, email, password }) }),
    logout: async () => this.request('/auth/logout', { method: 'POST' }),
    forgotPassword: async (email: string) => this.request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    me: async () => this.request<{ user: any }>('/auth/me'),
  };

  home = {
    getFeed: async (page: number = 1, limit: number = 10, feedType: 'for-you' | 'following' = 'for-you') => this.request<{ posts: any[]; hasMore: boolean }>(`/home/feed?page=${page}&limit=${limit}&type=${feedType}`),
    getStories: async () => this.request<{ stories: any[] }>('/stories'),
  };

  stories = {
    getStories: async () => this.request<{ stories: any[] }>('/stories'),
    getUserStories: async (userId: string) => this.request<{ stories: any[] }>(`/stories/user?user_id=${userId}`),
    getViewers: async (storyId: string) => this.request<{ viewers: any[] }>(`/stories/viewers?story_id=${storyId}`),
    react: async (storyId: string, reactionType: 'heart' | 'like') => this.request(`/stories/react`, { method: 'POST', body: JSON.stringify({ story_id: storyId, reaction_type: reactionType }) }),
    upload: async (formData: FormData) => this.request('/stories/upload', { method: 'POST', body: formData }),
    view: async (storyId: string) => this.request(`/stories/view`, { method: 'POST', body: JSON.stringify({ story_id: storyId }) }),
    delete: async (storyId: string) => this.request(`/stories/delete?id=${storyId}`, { method: 'DELETE' }),
  };

  posts = {
    getPost: async (id: string) => this.request<{ post: any }>(`/posts/details?id=${id}`),
    create: async (formData: FormData) => this.request('/posts/create', { method: 'POST', body: formData }),
    
    delete: async (id: string) => this.request(`/posts/action/delete.php?id=${id}`, { method: 'POST', body: JSON.stringify({ post_id: id }) }),
    
    like: async (id: string) => this.request('/posts/action/like.php', { method: 'POST', body: JSON.stringify({ post_id: id }) }),
    unlike: async (id: string) => this.request('/posts/action/unlike.php', { method: 'POST', body: JSON.stringify({ post_id: id }) }),

    comment: async (id: string, content: string) => this.request('/posts/action/comment.php', { method: 'POST', body: JSON.stringify({ post_id: id, content }) }),
    getComments: async (id: string, page: number = 1) => this.request(`/posts/comments.php?post_id=${id}&page=${page}`),
    deleteComment: async (commentId: string) => this.request(`/posts/action/comment.php?comment_id=${commentId}`, { method: 'DELETE' }),

    share: async (id: string) => this.request(`/posts/action/share.php`, { method: 'POST', body: JSON.stringify({ post_id: id }) }),
    
    report: async (postId: string, reason: string, description?: string) => this.request('/posts/action/report.php', { method: 'POST', body: JSON.stringify({ post_id: postId, reason, description }) }),
  };

  reels = {
    getReels: async (page: number = 1, limit: number = 10) => this.request<{ reels: any[]; hasMore: boolean }>(`/reels?page=${page}&limit=${limit}`),
    getDetails: async (id: string) => this.request<{ reel: any }>(`/reels/details?id=${id}`),
    
    like: async (id: string) => this.request('/reels/action/like', { method: 'POST', body: JSON.stringify({ reel_id: id }) }),
    unlike: async (id: string) => this.request('/reels/action/unlike', { method: 'POST', body: JSON.stringify({ reel_id: id }) }),
    
    comment: async (id: string, content: string) => this.request('/reels/action/comment.php', { method: 'POST', body: JSON.stringify({ reel_id: id, content }) }),
    getComments: async (id: string, page: number = 1) => this.request(`/reels/comments?reel_id=${id}&page=${page}`),
    deleteComment: async (commentId: string) => this.request(`/reels/action/comment?comment_id=${commentId}`, { method: 'DELETE' }),

    share: async (id: string) => this.request(`/reels/action/share`, { method: 'POST', body: JSON.stringify({ reel_id: id }) }),
    report: async (reelId: string, reason: string) => this.request('/reels/action/report.php', { method: 'POST', body: JSON.stringify({ reel_id: reelId, reason }) }),
    
    delete: async (id: string) => this.request(`/posts/action/delete.php?id=${id}`, { method: 'POST', body: JSON.stringify({ post_id: id, type: 'reel' }) }),
    
    upload: async (formData: FormData) => this.request('/reels/upload', { method: 'POST', body: formData }),

    trackView: async (reelId: string, watchDuration: number, totalDuration: number) => {
      return this.request('/reels/track-view.php', {
        method: 'POST',
        body: JSON.stringify({ reel_id: reelId, watch_duration: watchDuration, total_duration: totalDuration })
      });
    }
  };

  videos = {
    getVideos: async (page: number = 1, limit: number = 10, category?: string) => {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (category && category !== 'All') params.append('category', category);
      return this.request<{ videos: any[]; hasMore: boolean }>(`/videos?${params.toString()}`);
    },
    getRecommended: async (videoId: string) => this.request<{ videos: any[] }>(`/videos/recommended?video_id=${videoId}`),
    
    trackWatch: async (videoId: string, watchDuration: number, completionRate: number) => {
      return this.request('/videos/track-watch', {
        method: 'POST',
        body: JSON.stringify({ video_id: videoId, video_type: 'video', watch_duration: watchDuration, completion_rate: completionRate })
      });
    },

    view: async (id: string) => this.request(`/videos/action/view`, { method: 'POST', body: JSON.stringify({ video_id: id }) }),
    like: async (id: string) => this.request('/videos/action/like', { method: 'POST', body: JSON.stringify({ video_id: id }) }),
    unlike: async (id: string) => this.request('/videos/action/unlike', { method: 'POST', body: JSON.stringify({ video_id: id }) }),
    comment: async (id: string, content: string) => this.request('/videos/action/comment', { method: 'POST', body: JSON.stringify({ video_id: id, content }) }),
    getComments: async (id: string, page: number = 1) => this.request(`/videos/comments?video_id=${id}&page=${page}`),
    share: async (id: string) => this.request(`/videos/action/share`, { method: 'POST', body: JSON.stringify({ video_id: id }) }),
    upload: async (formData: FormData) => this.request('/videos/upload', { method: 'POST', body: formData }),
    getDetails: async (id: string) => this.request<{ video: any }>(`/videos/details?id=${id}`),
  };

  ads = {
    trackImpression: async (data: { video_id: string; creator_id: string; ad_network: string; revenue: number }) => this.request('/ads/track-impression', { method: 'POST', body: JSON.stringify(data) }),
  };

  users = {
    getProfile: async (userId: string) => this.request<{ user: any }>(`/users/fetch_profile?user_id=${userId}`),
    updateProfile: async (formData: FormData) => this.request('/users/edit_profile', { method: 'POST', body: formData }),
    uploadAvatar: async (formData: FormData) => this.request('/users/avatar', { method: 'POST', body: formData }),
    uploadCover: async (formData: FormData) => this.request('/users/cover', { method: 'POST', body: formData }),
    follow: async (userId: string) => this.request('/users/action/follow', { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
    unfollow: async (userId: string) => this.request('/users/action/unfollow', { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
    getFollowers: async (userId: string, page: number = 1) => this.request(`/users/followers?user_id=${userId}&page=${page}`),
    getFollowing: async (userId: string, page: number = 1) => this.request(`/users/following?user_id=${userId}&page=${page}`),
    getPosts: async (userId: string, page: number = 1) => this.request(`/users/posts?user_id=${userId}&page=${page}`),
    getReels: async (userId: string, page: number = 1) => this.request(`/users/reels?user_id=${userId}&page=${page}`),
    getVideos: async (userId: string, page: number = 1) => this.request(`/users/videos?user_id=${userId}&page=${page}`),
  };

  channels = {
    checkUserChannel: async (userId: string) => this.request(`/channels/check-user-channel?user_id=${userId}`),
    getChannel: async (channelId: string) => this.request<{ channel: any }>(`/channels/details?id=${channelId}`),
    getVideos: async (channelId: string, page: number = 1) => this.request<{ videos: any[]; hasMore: boolean }>(`/channels/videos?channel_id=${channelId}&page=${page}`),
    getReels: async (channelId: string, page: number = 1) => this.request<{ reels: any[]; hasMore: boolean }>(`/channels/reels?channel_id=${channelId}&page=${page}`),
    subscribe: async (channelId: string) => this.request('/channels/action/subscribe', { method: 'POST', body: JSON.stringify({ channel_id: channelId }) }),
    unsubscribe: async (channelId: string) => this.request('/channels/action/unsubscribe', { method: 'POST', body: JSON.stringify({ channel_id: channelId }) }),
    create: async (data: any) => this.request('/channels/create', { method: 'POST', body: JSON.stringify(data) }),
    updateChannel: async (formData: FormData) => this.request('/channels/update', { method: 'POST', body: formData }),
  };
  
  creator = {
    getStats: async () => this.request<{ stats: any }>('/creator/stats'),
    getEarnings: async (period: 'week' | 'month' | 'year' = 'month') => this.request<{ earnings: any }>(`/creator/earnings?period=${period}`),
    getContent: async (type: 'posts' | 'reels' | 'videos', page: number = 1) => this.request<{ content: any[]; hasMore: boolean }>(`/creator/content/${type}?page=${page}`),
    getVideoDetailedAnalytics: async (videoId: string) => this.request<{ analytics: any }>(`/creator/video-details-analytics?video_id=${videoId}`),
  };

  search = {
      all: async (query: string, page: number = 1) => this.request(`/search?q=${encodeURIComponent(query)}&page=${page}`),
      users: async (query: string, page: number = 1) => this.request(`/search/users?q=${encodeURIComponent(query)}&page=${page}`),
      posts: async (query: string, page: number = 1) => this.request(`/search/posts?q=${encodeURIComponent(query)}&page=${page}`),
      hashtags: async (tag: string, page: number = 1) => this.request(`/search/hashtags?tag=${encodeURIComponent(tag)}&page=${page}`),
  };
}

export const api = new ApiClient(API_BASE_URL, MEDIA_BASE_URL);
export { API_BASE_URL, MEDIA_BASE_URL };
