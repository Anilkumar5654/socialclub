import { ApiLogger } from '@/app/api-debug';
import { getDeviceId } from '@/utils/deviceId'; // Direct import to prevent hanging

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
    return `${this.mediaUrl}/${path}`;
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
      const contentType = response.headers.get('content-type');
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
        const error: ApiError = {
          message: (responseData && typeof responseData === 'object' && responseData.message) || `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };
        
        if (apiDebugLogger) {
          apiDebugLogger({
            endpoint,
            method: options.method || 'GET',
            status: 'error',
            statusCode: response.status,
            request: requestBody,
            response: responseData,
            rawResponse: rawResponseText,
            contentType,
            parseError,
            error: error.message,
            duration,
          });
        }
        
        throw error;
      }

      if (apiDebugLogger) {
        apiDebugLogger({
          endpoint,
          method: options.method || 'GET',
          status: parseError && !response.ok ? 'error' : 'success', 
          statusCode: response.status,
          request: requestBody,
          response: responseData,
          rawResponse: rawResponseText,
          contentType,
          parseError: response.ok ? null : parseError, 
          error: parseError && !response.ok ? `JSON Parse Error: ${parseError}` : undefined,
          duration,
        });
      }

      if (parseError && !response.ok) {
        throw new Error(`JSON Parse Error: ${parseError}`);
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

  auth = {
    login: async (email: string, password: string) => {
      return this.request<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },

    register: async (
      name: string,
      username: string,
      email: string,
      password: string
    ) => {
      return this.request<{ token: string; user: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, username, email, password }),
      });
    },

    logout: async () => {
      return this.request('/auth/logout', { method: 'POST' });
    },

    forgotPassword: async (email: string) => {
      return this.request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    me: async () => {
      return this.request<{ user: any }>('/auth/me');
    },
  };

  home = {
    getFeed: async (page: number = 1, limit: number = 10) => {
      return this.request<{ posts: any[]; hasMore: boolean }>(
        `/home?page=${page}&limit=${limit}`
      );
    },

    getStories: async () => {
      return this.request<{ stories: any[] }>('/stories');
    },
  };

  stories = {
    getStories: async () => {
      return this.request<{ stories: any[] }>('/stories');
    },

    getUserStories: async (userId: string) => {
      return this.request<{ stories: any[] }>(`/stories/user?user_id=${userId}`);
    },

    getViewers: async (storyId: string) => {
      return this.request<{ viewers: any[] }>(`/stories/viewers?story_id=${storyId}`);
    },

    react: async (storyId: string, reactionType: 'heart' | 'like') => {
      return this.request(`/stories/react`, {
        method: 'POST',
        body: JSON.stringify({ story_id: storyId, reaction_type: reactionType }),
      });
    },

    upload: async (formData: FormData) => {
      return this.request('/stories/upload', {
        method: 'POST',
        body: formData,
      });
    },

    view: async (storyId: string) => {
      return this.request(`/stories/view`, {
        method: 'POST',
        body: JSON.stringify({ story_id: storyId }),
      });
    },

    delete: async (storyId: string) => {
      return this.request(`/stories/delete?id=${storyId}`, { method: 'DELETE' });
    },
  };

  posts = {
    getPost: async (id: string) => {
      return this.request<{ post: any }>(`/posts/details?id=${id}`);
    },

    create: async (formData: FormData) => {
      return this.request('/posts/create', {
        method: 'POST',
        body: formData,
      });
    },

    delete: async (id: string) => {
      return this.request(`/posts/delete?id=${id}`, { method: 'DELETE' });
    },

    like: async (id: string) => {
      return this.request<{ isLiked: boolean; likes: number }>(
        `/posts/action/like`,
        {
          method: 'POST',
          body: JSON.stringify({ post_id: id }),
        }
      );
    },

    unlike: async (id: string) => {
      return this.request<{ isLiked: boolean; likes: number }>(
        `/posts/action/unlike`,
        {
          method: 'POST',
          body: JSON.stringify({ post_id: id }),
        }
      );
    },

    comment: async (id: string, content: string) => {
      return this.request<{ comment: any }>(`/posts/action/comment`, {
        method: 'POST',
        body: JSON.stringify({ post_id: id, content }),
      });
    },

    getComments: async (id: string, page: number = 1) => {
      const params = new URLSearchParams({
        post_id: id,
        page: page.toString(),
      });

      const response = await this.request<{
        comments?: any[];
        data?: any[];
        items?: any[];
        hasMore?: boolean;
        total_pages?: number;
        pagination?: { hasMore?: boolean; total_pages?: number };
      }>(`/posts/comments?${params.toString()}`);

      const comments = response.comments ?? response.data ?? response.items ?? [];
      const hasMoreFromResponse =
        typeof response.hasMore === 'boolean'
          ? response.hasMore
          : typeof response.total_pages === 'number'
            ? page < response.total_pages
            : typeof response.pagination?.hasMore === 'boolean'
              ? response.pagination?.hasMore
              : comments.length > 0;

      return {
        comments,
        hasMore: hasMoreFromResponse,
      };
    },

    share: async (id: string) => {
      return this.request(`/posts/action/share`, {
        method: 'POST',
        body: JSON.stringify({ post_id: id }),
      });
    },
  };

  reels = {
    getReels: async (page: number = 1, limit: number = 10) => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await this.request<{
        reels?: any[];
        data?: any[];
        items?: any[];
        hasMore?: boolean;
        total_pages?: number;
        pagination?: { hasMore?: boolean; total_pages?: number };
      }>(`/reels?${params.toString()}`);

      const reels = response.reels ?? response.data ?? response.items ?? [];
      const hasMoreFromResponse =
        typeof response.hasMore === 'boolean'
          ? response.hasMore
          : typeof response.total_pages === 'number'
            ? page < response.total_pages
            : typeof response.pagination?.hasMore === 'boolean'
              ? response.pagination?.hasMore
              : reels.length === limit;

      return {
        reels,
        hasMore: hasMoreFromResponse,
      };
    },

    getDetails: async (id: string) => {
      return this.request<{ reel: any }>(`/reels/details?id=${id}`);
    },

    like: async (id: string) => {
      return this.request<{ isLiked: boolean; likes: number }>(
        `/reels/action/like`,
        {
          method: 'POST',
          body: JSON.stringify({ reel_id: id }),
        }
      );
    },

    unlike: async (id: string) => {
      return this.request<{ isLiked: boolean; likes: number }>(
        `/reels/action/unlike`,
        {
          method: 'POST',
          body: JSON.stringify({ reel_id: id }),
        }
      );
    },

    comment: async (id: string, content: string) => {
      return this.request<{ comment: any }>(`/reels/action/comment`, {
        method: 'POST',
        body: JSON.stringify({ reel_id: id, content }),
      });
    },

    getComments: async (id: string, page: number = 1) => {
      return this.request<{ comments: any[]; hasMore: boolean }>(
        `/reels/comments?reel_id=${id}&page=${page}`
      );
    },

    share: async (id: string) => {
      return this.request(`/reels/action/share`, {
        method: 'POST',
        body: JSON.stringify({ reel_id: id }),
      });
    },

    upload: async (formData: FormData) => {
      return this.request('/reels/upload', {
        method: 'POST',
        body: formData,
      });
    },
  };

  videos = {
    getVideos: async (
      page: number = 1,
      limit: number = 10,
      category?: string
    ) => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (category && category !== 'All') {
        params.append('category', category);
      }
      return this.request<{ videos: any[]; hasMore: boolean }>(
        `/videos?${params.toString()}`
      );
    },

    getRecommended: async (videoId: string) => {
      return this.request<{ videos: any[] }>(`/videos/recommended?video_id=${videoId}`);
    },

    getFeed: async (type: 'for_you' | 'following' = 'for_you', page: number = 1) => {
      return this.request<{ videos: any[]; hasMore: boolean }>(
        `/videos/feed?type=${type}&page=${page}`
      );
    },

    notInterested: async (videoId: string) => {
      return this.request(`/videos/not-interested`, {
        method: 'POST',
        body: JSON.stringify({ video_id: videoId }),
      });
    },

    getHistory: async (page: number = 1) => {
      return this.request<{ videos: any[]; hasMore: boolean }>(
        `/users/history?page=${page}`
      );
    },

    getDetails: async (id: string) => {
      return this.request<{ video: any }>(`/videos/details?id=${id}`);
    },

    like: async (id: string) => {
      return this.request<{ isLiked: boolean; likes: number }>(
        `/videos/action/like`,
        {
          method: 'POST',
          body: JSON.stringify({ video_id: id }),
        }
      );
    },

    unlike: async (id: string) => {
      return this.request<{ isLiked: boolean; likes: number }>(
        `/videos/action/unlike`,
        {
          method: 'POST',
          body: JSON.stringify({ video_id: id }),
        }
      );
    },

    comment: async (id: string, content: string) => {
      return this.request<{ comment: any }>(`/videos/action/comment`, {
        method: 'POST',
        body: JSON.stringify({ video_id: id, content }),
      });
    },

    getComments: async (id: string, page: number = 1) => {
      return this.request<{ comments: any[]; hasMore: boolean }>(
        `/videos/comments?video_id=${id}&page=${page}`
      );
    },

    share: async (id: string) => {
      return this.request(`/videos/action/share`, {
        method: 'POST',
        body: JSON.stringify({ video_id: id }),
      });
    },

    upload: async (formData: FormData) => {
      return this.request('/videos/upload', {
        method: 'POST',
        body: formData,
      });
    },

    view: async (id: string) => {
      let deviceId = 'unknown_device';

      try {
        // Safe check for device ID with 2s timeout
        const idPromise = getDeviceId();
        const timeoutPromise = new Promise<string | null>(resolve => setTimeout(() => resolve(null), 2000));
        
        const id = await Promise.race([idPromise, timeoutPromise]);
        
        if (id && typeof id === 'string') {
            deviceId = id;
        } else {
            console.log('[API] Device ID fetch timeout or failed, using fallback');
        }
      } catch (err) {
        console.log('[API] Device ID fetch error:', err);
      }

      console.log('[API] Calling POST /videos/action/view', { id, deviceId });

      return this.request(`/videos/action/view`, {
        method: 'POST',
        body: JSON.stringify({ video_id: id, device_id: deviceId }),
      });
    },

    trackWatch: async (
      videoId: string,
      videoType: 'reel' | 'video',
      watchDuration: number,
      completionRate: number,
      deviceId: string
    ) => {
      return this.request<{ message: string; updated_score?: number }>(
        `/videos/track-watch`,
        {
          method: 'POST',
          body: JSON.stringify({
            video_id: videoId,
            video_type: videoType,
            watch_duration: watchDuration,
            completion_rate: completionRate,
            device_id: deviceId,
          }),
        }
      );
    },
  };

  users = {
    getProfile: async (userId: string) => {
      const params = new URLSearchParams({ user_id: userId });
      return this.request<{ user: any }>(`/users/fetch_profile?${params.toString()}`);
    },

    updateProfile: async (formData: FormData) => {
      return this.request('/users/edit_profile', {
        method: 'POST',
        body: formData,
      });
    },

    uploadAvatar: async (formData: FormData) => {
      return this.request('/users/avatar', {
        method: 'POST',
        body: formData,
      });
    },

    uploadCover: async (formData: FormData) => {
      return this.request('/users/cover', {
        method: 'POST',
        body: formData,
      });
    },

    follow: async (userId: string) => {
      return this.request<{ isFollowing: boolean }>(
        `/users/action/follow`,
        {
          method: 'POST',
          body: JSON.stringify({ user_id: userId }),
        }
      );
    },

    unfollow: async (userId: string) => {
      return this.request<{ isFollowing: boolean }>(
        `/users/action/unfollow`,
        {
          method: 'POST',
          body: JSON.stringify({ user_id: userId }),
        }
      );
    },

    getFollowers: async (userId: string, page: number = 1) => {
      return this.request<{ users: any[]; hasMore: boolean }>(
        `/users/followers?user_id=${userId}&page=${page}`
      );
    },

    getFollowing: async (userId: string, page: number = 1) => {
      return this.request<{ users: any[]; hasMore: boolean }>(
        `/users/following?user_id=${userId}&page=${page}`
      );
    },

    getPosts: async (userId: string, page: number = 1) => {
      return this.request<{ posts: any[]; hasMore: boolean }>(
        `/users/posts?user_id=${userId}&page=${page}`
      );
    },

    getReels: async (userId: string, page: number = 1) => {
      return this.request<{ reels: any[]; hasMore: boolean }>(
        `/users/reels?user_id=${userId}&page=${page}`
      );
    },

    getVideos: async (userId: string, page: number = 1) => {
      return this.request<{ videos: any[]; hasMore: boolean }>(
        `/users/videos?user_id=${userId}&page=${page}`
      );
    },
  };

  notifications = {
    getAll: async (page: number = 1) => {
      return this.request<{ notifications: any[]; hasMore: boolean }>(
        `/notifications?page=${page}`
      );
    },

    markAsRead: async (id: string) => {
      return this.request(`/notifications/read?id=${id}`, { method: 'PUT' });
    },

    markAllAsRead: async () => {
      return this.request('/notifications/read-all', { method: 'PUT' });
    },
  };

  messages = {
    getConversations: async (page: number = 1) => {
      return this.request<{ conversations: any[]; hasMore: boolean }>(
        `/messages?page=${page}`
      );
    },

    getMessages: async (conversationId: string, page: number = 1) => {
      return this.request<{ messages: any[]; hasMore: boolean }>(
        `/messages/conversation?conversation_id=${conversationId}&page=${page}`
      );
    },

    send: async (userId: string, content: string, mediaUrl?: string) => {
      return this.request<{ message: any }>('/messages/send', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, content, media_url: mediaUrl }),
      });
    },

    markAsRead: async (conversationId: string) => {
      return this.request(`/messages/read?conversation_id=${conversationId}`, {
        method: 'PUT',
      });
    },
  };

  search = {
    all: async (query: string, page: number = 1) => {
      return this.request<{
        users: any[];
        posts: any[];
        reels: any[];
        videos: any[];
        hasMore: boolean;
      }>(`/search?q=${encodeURIComponent(query)}&page=${page}`);
    },

    users: async (query: string, page: number = 1) => {
      return this.request<{ users: any[]; hasMore: boolean }>(
        `/search/users?q=${encodeURIComponent(query)}&page=${page}`
      );
    },

    posts: async (query: string, page: number = 1) => {
      return this.request<{ posts: any[]; hasMore: boolean }>(
        `/search/posts?q=${encodeURIComponent(query)}&page=${page}`
      );
    },

    hashtags: async (tag: string, page: number = 1) => {
      return this.request<{ posts: any[]; hasMore: boolean }>(
        `/search/hashtags?tag=${encodeURIComponent(tag)}&page=${page}`
      );
    },
  };

  creator = {
    getStats: async () => {
      return this.request<{ stats: any }>('/creator/stats');
    },

    getContent: async (type: 'posts' | 'reels' | 'videos', page: number = 1) => {
      return this.request<{ content: any[]; hasMore: boolean }>(
        `/creator/content/${type}?page=${page}`
      );
    },

    getEarnings: async (period: 'week' | 'month' | 'year' = 'month') => {
      return this.request<{ earnings: any }>(`/creator/earnings?period=${period}`);
    },

    getAnalytics: async (period: 'week' | 'month' | 'year' = 'week') => {
      return this.request<{ analytics: any }>(`/creator/analytics?period=${period}`);
    },

    getVideoAnalytics: async (videoId: string) => {
      return this.request<{ analytics: any }>(`/creator/video-analytics?video_id=${videoId}`);
    },

    getVideoDetailedAnalytics: async (videoId: string) => {
      return this.request<{
        analytics: {
          video_id: string;
          title: string;
          thumbnail_url: string;
          total_views: number;
          total_watch_time: number;
          impressions: number;
          ctr: number;
          avg_view_duration: number;
          engagement_rate: number;
          likes: number;
          comments: number;
          shares: number;
          retention_data: Array<{ time: number; percentage: number }>;
          traffic_sources: Array<{ source: string; views: number; percentage: number }>;
          demographics: {
            age_groups: Array<{ age: string; percentage: number }>;
            top_countries: Array<{ country: string; percentage: number }>;
          };
          revenue: {
            estimated_revenue: number;
            rpm: number;
            cpm: number;
          };
          performance_comparison: {
            vs_last_video: { views: number; watch_time: number };
            vs_channel_avg: { views: number; watch_time: number };
          };
        };
      }>(`/creator/video-details-analytics?video_id=${videoId}`);
    },
  };

  channels = {
    checkUserChannel: async (userId: string) => {
      return this.request<{ success: boolean; has_channel: boolean; data?: any }>(
        `/channels/check-user-channel?user_id=${userId}`
      );
    },

    getChannel: async (channelId: string) => {
      return this.request<{ channel: any }>(`/channels/details?id=${channelId}`);
    },

    getChannelVideos: async (channelId: string, page: number = 1) => {
      return this.request<{ videos: any[]; hasMore: boolean }>(
        `/channels/videos?channel_id=${channelId}&page=${page}`
      );
    },

    subscribe: async (channelId: string) => {
      return this.request<{ isSubscribed: boolean; subscribers_count: number }>(
        `/channels/action/subscribe`,
        {
          method: 'POST',
          body: JSON.stringify({ channel_id: channelId }),
        }
      );
    },

    unsubscribe: async (channelId: string) => {
      return this.request<{ isSubscribed: boolean; subscribers_count: number }>(
        `/channels/action/unsubscribe`,
        {
          method: 'POST',
          body: JSON.stringify({ channel_id: channelId }),
        }
      );
    },

    create: async (data: any) => {
      return this.request<{ channel: any }>('/channels/create', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    update: async (channelId: string, data: any) => {
      return this.request<{ channel: any }>(`/channels/update`, {
        method: 'PUT',
        body: JSON.stringify({ ...data, channel_id: channelId }),
      });
    },

    getSubscriptions: async (page: number = 1) => {
      return this.request<{ channels: any[]; hasMore: boolean }>(
        `/channels/subscriptions?page=${page}`
      );
    },
  };

  reports = {
    create: async (
      reportableType: 'post' | 'reel' | 'video' | 'comment' | 'user',
      reportableId: string,
      reason: string,
      description?: string
    ) => {
      return this.request('/reports/create', {
        method: 'POST',
        body: JSON.stringify({
          reportable_type: reportableType,
          reportable_id: reportableId,
          reason,
          description,
        }),
      });
    },

    getMyReports: async (page: number = 1) => {
      return this.request<{ reports: any[]; hasMore: boolean }>(
        `/reports/my?page=${page}`
      );
    },
  };

  admin = {
    getStats: async () => {
      return this.request<{ stats: any }>('/admin/stats');
    },

    getUsers: async (page: number = 1) => {
      return this.request<{ users: any[]; hasMore: boolean }>(
        `/admin/users?page=${page}`
      );
    },

    banUser: async (userId: string) => {
      return this.request(`/admin/users/ban`, { 
        method: 'POST',
        body: JSON.stringify({ user_id: userId })
      });
    },

    unbanUser: async (userId: string) => {
      return this.request(`/admin/users/unban`, { 
        method: 'POST',
        body: JSON.stringify({ user_id: userId })
      });
    },

    verifyUser: async (userId: string) => {
      return this.request(`/admin/users/verify`, { 
        method: 'POST',
        body: JSON.stringify({ user_id: userId })
      });
    },

    deleteContent: async (type: 'post' | 'reel' | 'video', id: string) => {
      return this.request(`/admin/content/delete`, { 
        method: 'DELETE',
        body: JSON.stringify({ content_type: type, content_id: id })
      });
    },

    getReportedContent: async (page: number = 1) => {
      return this.request<{ reports: any[]; hasMore: boolean }>(
        `/admin/reports?page=${page}`
      );
    },
  };
}

export const api = new ApiClient(API_BASE_URL, MEDIA_BASE_URL);
export { API_BASE_URL, MEDIA_BASE_URL };
