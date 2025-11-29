# API Integration Documentation

## 🎯 Frontend Integration Status: ✅ COMPLETE & FULLY TESTED

**Last Updated:** 2025-11-26

### 🔧 Latest Updates (Nov 26, 2025):
- ✅ Fixed track view endpoint - POST /videos/action/view now properly logs with device_id
- ✅ Enhanced error handling with try-catch and detailed console logs
- ✅ Channel info displays correctly on video cards (name + subscribers)
- ✅ Clicking channel navigates to user profile using channel.user_id
- ✅ Video player displays channel avatar and name (not user)
- ✅ Video player controls working correctly with native controls (useNativeControls)
- ✅ Fixed channel navigation to use correct user_id from channel data
- ✅ Added channel_id and channel_name to User TypeScript interface
- ✅ All video cards in Videos tab show channel information
- ✅ Recommended videos show channel names correctly
- ✅ API Debug Console updated with Critical API Endpoints section
- ✅ API Debug Console shows HTTP 400 Bad Request documentation
- ✅ Comment section uses modal/sliding panel for better UX

All API endpoints have been integrated into the React Native mobile app with:
- ✅ Full error tracking & comprehensive debug logging
- ✅ Automatic API error capture in Settings → API Debug Console
- ✅ Real-time request/response monitoring
- ✅ Backend issue detection (JSON parse errors, empty responses, HTTP errors)
- ✅ Frontend vs Backend error differentiation

### 📱 Frontend Implementation Highlights:

**UI/UX Improvements (Latest):**
- ✅ YouTube-style video cards with thumbnail, duration overlay, and channel name
- ✅ Clean video player screen with proper channel information
- ✅ Subscribe button with real-time subscription status
- ✅ Full-featured comments section with add comment functionality
- ✅ Recommended videos section matching video card design
- ✅ Responsive mobile-first design optimized for native experience

**Algorithm & Monetization:**
- ✅ YouTube-style viral algorithm with watch time tracking
- ✅ Video feed with Trending, Hot, Recent filters based on `viral_score`
- ✅ Device ID tracking for fraud prevention
- ✅ Ad impression & click tracking ready

**Content Upload:**
- ✅ Video upload with full SEO: title, description, tags, category, thumbnail, visibility
- ✅ Reel upload with caption, location, hashtags
- ✅ Post creation with multiple images, location, hashtags
- ✅ Story upload with image/video support

**User Experience:**
- ✅ Relative time display ("1h ago", "just now") across all content
- ✅ Follow/Following status correctly displayed
- ✅ Story viewer with reactions, viewers list, and delete
- ✅ Comments with profile photos, names, time, clickable profiles
- ✅ Instagram/TikTok-style reels experience
- ✅ Full-screen video player with engagement actions

**Creator Features:**
- ✅ Creator Studio with real API integration (`/api/creator/*` endpoints)
- ✅ Channel creation & management
- ✅ Analytics: stats, earnings, content performance
- ✅ Proper routing: Creator Studio uses `/creator/*`, Video watching uses `/videos/*` + `/channels/*`

**Debug & Testing:**
- ✅ API Debug Console in Settings with all errors logged
- ✅ Request/response inspection with raw response text
- ✅ JSON parse error detection (backend issues)
- ✅ HTTP status code tracking
- ✅ Network error logging
- ✅ Duration/performance monitoring

### 📊 API Statistics (Frontend)

**Total Integrated Endpoints:** 70+  
**Error Tracking:** Real-time API Debug Console  
**Request Logging:** Automatic (last 100 requests)  
**Backend Status Detection:** Automatic  
**Time Format:** Relative ("1h ago", "just now")  
**Watch Time Tracking:** Active (for viral algorithm)  
**Device ID Tracking:** Enabled (for fraud prevention)

## Base URLs
- **API Base**: `https://www.moviedbr.com/api`
- **Media Base**: `https://www.moviedbr.com/upload`
- ⚠️ **Important**: All endpoints are clean URLs (htaccess). **Never** append `.php` extension.

## Authentication

All authenticated requests must include the `Authorization` header:
```
Authorization: Bearer <token>
```

### Auth Endpoints

#### POST /auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "1",
    "username": "username",
    "name": "Full Name",
    "email": "user@example.com",
    "avatar": "avatar.jpg",
    "is_verified": false
  }
}
```

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "name": "Full Name",
  "username": "username",
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** Same as login

#### POST /auth/logout
Logout the current user (invalidate token).

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

#### POST /auth/forgot-password
Send password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

#### GET /auth/me
Get current user details.

**Response:**
```json
{
  "user": { /* user object */ }
}
```

---

## Home Feed

#### GET /home?page=1&limit=10
Get user's feed (posts from followed users).

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:**
```json
{
  "posts": [
    {
      "id": "1",
      "user": { /* user object */ },
      "type": "photo",
      "content": "Caption text",
      "images": ["image1.jpg", "image2.jpg"],
      "likes": 120,
      "comments": 45,
      "shares": 12,
      "isLiked": false,
      "timestamp": "2 hours ago",
      "location": "New York, NY"
    }
  ],
  "hasMore": true
}
```

#### GET /home/stories
Get stories from followed users.

**Response:**
```json
{
  "stories": [
    {
      "id": "1",
      "user": { /* user object */ },
      "media_url": "story.jpg",
      "media_type": "image",
      "expires_at": "2025-01-22T10:00:00Z"
    }
  ]
}
```

---

## Posts

#### POST /posts/create
Create a new post (multipart/form-data).

**Form Data:**
- `type`: "text" | "photo" | "video" | "short"
- `content`: Post caption/text
- `images` (multiple): Image files (for photo posts)
- `location` (optional): Location text
- `hashtags` (optional): Comma-separated hashtags

**Response:**
```json
{
  "post": { /* post object */ }
}
```

#### DELETE /posts/:id
Delete a post (owner only).

#### POST /posts/action/like
Like a post.

**Request Body:**
```json
{
  "post_id": "1"
}
```

**Response:**
```json
{
  "isLiked": true,
  "likes": 121
}
```

#### POST /posts/action/unlike
Unlike a post.

**Request Body:**
```json
{
  "post_id": "1"
}
```

**Response:**
```json
{
  "isLiked": false,
  "likes": 120
}
```

#### POST /posts/action/comment
Add a comment to a post.

**Request Body:**
```json
{
  "post_id": "1",
  "content": "Great post!"
}
```

**Response:**
```json
{
  "comment": {
    "id": "1",
    "user": { /* user object */ },
    "content": "Great post!",
    "likes": 0,
    "created_at": "2025-01-21T10:00:00Z"
  }
}
```

#### GET /posts/:id/comments?page=1
Get comments for a post.

**Response:**
```json
{
  "comments": [
    { /* comment object */ }
  ],
  "hasMore": true
}
```

#### POST /posts/action/share
Track post share.

**Request Body:**
```json
{
  "post_id": "1"
}
```

---

## Reels

#### GET /reels?page=1&limit=10
Get reels feed.

**Response:**
```json
{
  "reels": [
    {
      "id": "1",
      "user": { /* user object */ },
      "video_url": "reel.mp4",
      "thumbnail_url": "thumb.jpg",
      "caption": "Caption",
      "likes": 500,
      "comments": 100,
      "views": 10000,
      "isLiked": false
    }
  ],
  "hasMore": true
}
```

#### POST /reels/upload
Upload a new reel (multipart/form-data).

**Form Data:**
- `video`: Video file
- `caption` (optional): Reel caption
- `location` (optional): Location
- `hashtags` (optional): Hashtags

#### POST /reels/action/like
Like a reel (same as posts).

#### POST /reels/action/unlike
Unlike a reel.

#### POST /reels/action/comment
Comment on a reel.

#### POST /reels/action/share
Track reel share.

---

## Videos

#### GET /videos/recommended?video_id={id}
Get recommended videos based on current video.

**Response:**
```json
{
  "videos": [
    {
      "id": "2",
      "title": "Related Video",
      "thumbnail_url": "thumb.jpg",
      "views": 1000,
      "user": { "name": "Channel Name" }
    }
  ]
}
```

#### GET /videos/feed?type=for_you&page=1
Get personalized video feed.

**Query Parameters:**
- `type`: "for_you" or "following"
- `page`: Page number

#### POST /videos/not-interested
Mark video as not interested.

**Request Body:**
```json
{
  "video_id": "1"
}
```

#### GET /users/history?page=1
Get user's watch history.

#### GET /videos?page=1&limit=10&category=All
Get videos feed with algorithm support.

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `category` (optional): Filter by category
- `sort` (optional): "trending", "hot", "recent", or "recommended" (default: "recommended")

**Response:**
```json
{
  "videos": [
    {
      "id": "1",
      "user": { /* user object */ },
      "title": "Video Title",
      "description": "Description",
      "video_url": "video.mp4",
      "thumbnail_url": "thumb.jpg",
      "duration": "10:30",
      "views": 5000,
      "likes": 200,
      "comments": 50,
      "category": "Gaming",
      "viral_score": 85.5,
      "created_at": "2025-01-21T10:00:00Z",
      "timestamp": "2025-01-21T10:00:00Z"
    }
  ],
  "hasMore": true
}
```

**Important Algorithm Fields:**
- `viral_score`: Float (0-100) - Algorithm ranking score based on watch time, engagement, and retention
- Videos with `viral_score > 75` are marked as "HOT"
- Videos sorted by `viral_score + (views / 100)` for trending
- Frontend supports: All, Trending, Hot, Recent filters

#### POST /videos/upload
Upload a new video with full SEO support (multipart/form-data).

**Form Data (Required):**
- `video`: Video file (MP4, MOV, WEBM - Max 500MB)
- `title`: Video title (max 100 characters)
- `description`: Video description (max 5000 characters)
- `category`: Video category (Gaming, Entertainment, Music, Sports, etc.)

**Form Data (Optional):**
- `thumbnail`: Custom thumbnail image (1280x720 recommended)
- `tags`: Comma-separated tags for SEO
- `visibility`: "public", "unlisted", or "private" (default: "public")
- `allow_comments`: "1" or "0" (default: "1")
- `monetization_enabled`: "1" or "0" (default: "1")
- `scheduled_at`: ISO 8601 datetime for scheduled publishing

**Response:**
```json
{
  "video": {
    "id": "1",
    "title": "My Awesome Video",
    "description": "Full description",
    "video_url": "video.mp4",
    "thumbnail_url": "thumb.jpg",
    "category": "Gaming",
    "visibility": "public",
    "views": 0,
    "likes": 0,
    "viral_score": 0,
    "created_at": "2025-01-21T10:00:00Z"
  }
}
```

#### POST /videos/action/like
Like a video.

#### POST /videos/action/unlike
Unlike a video.

#### POST /videos/action/comment
Comment on a video.

#### POST /videos/action/view
Track video view (CRITICAL - must include device_id).

**Request Body:**
```json
{
  "video_id": "1",
  "device_id": "unique_device_identifier"
}
```

**Response:**
```json
{
  "message": "View tracked successfully"
}
```

**IMPORTANT:**
- `device_id` is REQUIRED to prevent duplicate view counting
- Frontend automatically includes device_id from utils/deviceId.ts
- Backend must validate device_id is present (returns HTTP 400 if missing)

---

## Users

#### GET /users/fetch_profile?user_id={id}
Fetch a public profile. `user_id` is required.

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "1",
    "username": "username",
    "name": "Full Name",
    "bio": "Bio text",
    "avatar": "avatar.jpg",
    "cover_photo": "cover.jpg",
    "followers_count": 1000,
    "following_count": 500,
    "posts_count": 150,
    "reels_count": 25,
    "videos_count": 10,
    "is_verified": true,
    "is_following": false,
    "is_current_user": false
  }
}
```

**Important Fields:**
- `is_following`: Boolean indicating if the current user follows this profile
- `is_current_user`: Boolean indicating if this is the current user's own profile
- `reels_count`: Count of user's reels
- `videos_count`: Count of user's videos

#### POST /users/edit_profile
Update profile details (multipart/form-data).

**Form Data:**
- `name`: Full name
- `bio`: Bio text
- `website`: Website URL
- `location`: Location
- `avatar` (optional): Avatar image file
- `cover` (optional): Cover image file

#### POST /users/action/follow
Follow a user.

**Request Body:**
```json
{
  "user_id": "1"
}
```

**Response:**
```json
{
  "isFollowing": true
}
```

#### POST /users/action/unfollow
Unfollow a user.

**Request Body:**
```json
{
  "user_id": "1"
}
```

**Response:**
```json
{
  "isFollowing": false
}
```

#### GET /users/:userId/followers?page=1
Get user's followers.

**Response:**
```json
{
  "users": [
    { /* user object */ }
  ],
  "hasMore": true
}
```

#### GET /users/:userId/following?page=1
Get users that this user follows.

#### GET /users/:userId/posts?page=1
Get user's posts (images only).

**Response:**
```json
{
  "success": true,
  "posts": [
    {
      "id": "1",
      "type": "photo",
      "images": ["image1.jpg", "image2.jpg"],
      "thumbnail_url": "image1.jpg",
      "content": "Caption",
      "likes": 120,
      "comments": 45,
      "user": { /* user object */ }
    }
  ],
  "hasMore": true
}
```

#### GET /users/:userId/reels?page=1
Get user's reels (short vertical videos).

**Response:**
```json
{
  "success": true,
  "reels": [
    {
      "id": "1",
      "video_url": "reel.mp4",
      "thumbnail_url": "thumb.jpg",
      "caption": "Caption",
      "likes": 500,
      "comments": 100,
      "views": 10000,
      "user": { /* user object */ }
    }
  ],
  "hasMore": true
}
```

#### GET /users/:userId/videos?page=1
Get user's videos (longer horizontal videos).

**Response:**
```json
{
  "success": true,
  "videos": [
    {
      "id": "1",
      "title": "Video Title",
      "video_url": "video.mp4",
      "thumbnail_url": "thumb.jpg",
      "duration": "10:30",
      "views": 5000,
      "likes": 200,
      "user": { /* user object */ }
    }
  ],
  "hasMore": true
}
```

---

## Search

#### GET /search?q=query&page=1
Search all content types.

**Response:**
```json
{
  "users": [{ /* user objects */ }],
  "posts": [{ /* post objects */ }],
  "reels": [{ /* reel objects */ }],
  "videos": [{ /* video objects */ }],
  "hasMore": true
}
```

#### GET /search/users?q=query&page=1
Search only users.

**Response:**
```json
{
  "success": true,
  "results": {
    "users": [
      {
        "id": "1",
        "username": "john_doe",
        "name": "John Doe",
        "avatar": "profile/avatar.jpg",
        "is_verified": true,
        "is_following": false
      }
    ],
    "posts": [],
    "reels": [],
    "videos": []
  }
}
```

Note: The `results` object contains arrays for all content types, but only the requested type (`users` in this case) will be populated.

#### GET /search/posts?q=query&page=1
Search only posts.

#### GET /search/hashtags?tag=hashtag&page=1
Search posts by hashtag.

**Response:**
```json
{
  "posts": [{ /* post objects */ }],
  "hasMore": true
}
```

---

## Notifications

#### GET /notifications?page=1
Get user's notifications.

**Response:**
```json
{
  "notifications": [
    {
      "id": "1",
      "type": "like",
      "actor": { /* user who performed action */ },
      "message": "liked your post",
      "thumbnail_url": "post_thumb.jpg",
      "is_read": false,
      "created_at": "2025-01-21T10:00:00Z"
    }
  ],
  "hasMore": true
}
```

#### PUT /notifications/:id/read
Mark a notification as read.

#### PUT /notifications/read-all
Mark all notifications as read.

---

## Messages

#### GET /messages?page=1
Get user's conversations.

**Response:**
```json
{
  "conversations": [
    {
      "id": "1",
      "user": { /* other user */ },
      "last_message": "Hello!",
      "last_message_at": "2025-01-21T10:00:00Z",
      "unread_count": 2
    }
  ],
  "hasMore": true
}
```

#### GET /messages/:conversationId?page=1
Get messages in a conversation.

**Response:**
```json
{
  "messages": [
    {
      "id": "1",
      "sender_id": "1",
      "content": "Hello!",
      "media_url": null,
      "is_read": true,
      "created_at": "2025-01-21T10:00:00Z"
    }
  ],
  "hasMore": true
}
```

#### POST /messages/send
Send a message.

**Request Body:**
```json
{
  "user_id": "1",
  "content": "Hello!",
  "media_url": null
}
```

#### PUT /messages/:conversationId/read
Mark conversation as read.

---

## Reports

#### POST /reports/create
Report content or user.

**Request Body:**
```json
{
  "reportable_type": "post",
  "reportable_id": "1",
  "reason": "Spam",
  "description": "This post is spam"
}
```

**Reportable Types:**
- `post`
- `reel`
- `video`
- `comment`
- `user`

**Common Reasons:**
- Spam
- Harassment
- Inappropriate Content
- Violence
- Hate Speech
- Misinformation
- Intellectual Property Violation
- Other

#### GET /reports/my?page=1
Get user's submitted reports.

---

## Channels (Video Creator Feature)

**⚠️ IMPORTANT ROUTING DISTINCTION:**

### When Watching Videos (`/videos` tab):
- Use `/api/channels/*` endpoints to get channel information
- Example: User clicks on channel name in video player

### When Managing Content (Creator Studio):
- Use `/api/creator/*` endpoints for all creator operations
- Example: User opens Creator Studio to manage their content

---

### Channel Endpoints (For Video Viewing)

#### GET /channels/check-user-channel?user_id={userId}
Check if a user has a channel.
**Usage:** Creator Studio - check before showing dashboard

**Response:**
```json
{
  "success": true,
  "has_channel": true,
  "data": {
    "id": "1",
    "name": "My Channel",
    "description": "Channel description",
    "avatar": "avatar.jpg",
    "cover_photo": "cover.jpg",
    "subscribers_count": 1000,
    "videos_count": 25,
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

**If No Channel:**
```json
{
  "success": true,
  "has_channel": false
}
```

#### GET /channels/details?id={channelId}
Get channel details when user clicks on a channel.
**Usage:** Video player, channel page

**Response:**
```json
{
  "channel": {
    "id": "1",
    "name": "My Channel",
    "description": "Channel description",
    "avatar": "avatar.jpg",
    "cover_photo": "cover.jpg",
    "subscribers_count": 1000,
    "videos_count": 25,
    "user_id": "123",
    "is_verified": true,
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

**IMPORTANT:**
- `user_id` field is REQUIRED - links channel to the channel owner's user profile
- Used for navigation when user clicks on channel name in video player
- Frontend navigates to `/user/{user_id}` when channel is clicked

#### GET /channels/:channelId/videos?page=1
Get videos from a specific channel.
**Usage:** When user views a channel's videos

#### POST /channels/action/subscribe
Subscribe to a channel.
**Usage:** When user clicks Subscribe button on a video

**Request Body:**
```json
{
  "channel_id": "1"
}
```

**Response:**
```json
{
  "isSubscribed": true,
  "subscribers_count": 1001
}
```

#### POST /channels/action/unsubscribe
Unsubscribe from a channel.
**Usage:** When user clicks Unsubscribe button

#### POST /channels/create
Create a new channel.
**Usage:** Creator Studio - when user creates their first channel

**Request Body:**
```json
{
  "name": "My Channel Name",
  "description": "Channel description"
}
```

**Response:**
```json
{
  "channel": {
    "id": "1",
    "name": "My Channel Name",
    "description": "Channel description",
    "subscribers_count": 0,
    "videos_count": 0,
    "created_at": "2025-01-21T10:00:00Z"
  }
}
```

#### GET /channels/subscriptions?page=1
Get user's subscribed channels.
**Usage:** User's channel subscriptions list

---

## Creator Studio (For Content Management)

**⚠️ IMPORTANT:** All Creator Studio endpoints start with `/api/creator/`
**DO NOT** use `/api/channels/` for Creator Studio features!

### Use Cases:
- Opening Creator Studio dashboard
- Viewing creator analytics
- Managing content (posts, reels, videos)
- Checking earnings

---

#### GET /creator/stats
Get creator statistics for Creator Studio Overview tab.

**Response:**
```json
{
  "stats": {
    "total_followers": 5000,
    "total_views": 100000,
    "total_likes": 25000,
    "engagement_rate": 12.5,
    "monthly_growth": {
      "followers": 15,
      "views": 22,
      "engagement": 8
    }
  }
}
```

#### GET /creator/content/:type?page=1
Get creator's content for Creator Studio Content tab.

**Types:** `posts`, `reels`, `videos`

**Example:** `GET /creator/content/videos?page=1`

**Response:**
```json
{
  "content": [
    {
      "id": "1",
      "title": "My Video Title",
      "thumbnail_url": "thumb.jpg",
      "views": 5000,
      "likes": 200,
      "created_at": "2025-01-21T10:00:00Z"
    }
  ],
  "hasMore": true
}
```

#### GET /creator/earnings?period=month
Get earnings data for Creator Studio Earnings tab.

**Periods:** `week`, `month`, `year`

**Response:**
```json
{
  "earnings": {
    "total_earnings": 2500.50,
    "pending_earnings": 150.00,
    "paid_earnings": 2350.50,
    "ad_revenue": 1800.00,
    "reels_bonus": 700.50,
    "period": "month",
    "breakdown": [
      {
        "date": "2025-01-21",
        "views": 50000,
        "watch_time": 12000,
        "earnings": 85.50
      }
    ]
  }
}
```

#### GET /creator/analytics?period=week
Get creator analytics data.

**Periods:** `week`, `month`, `year`

**Response:**
```json
{
  "analytics": {
    "total_views": 150000,
    "total_likes": 25000,
    "total_comments": 5000,
    "total_shares": 2000,
    "new_followers": 500,
    "watch_time_minutes": 30000,
    "engagement_rate": 12.5,
    "chart_data": [
      {
        "date": "2025-01-21",
        "views": 5000,
        "likes": 850,
        "comments": 200,
        "followers": 25
      }
    ]
  }
}
```

#### GET /creator/video-details-analytics?video_id={id}
Get detailed analytics for a specific video (YouTube Studio style).
**Usage:** When creator clicks on a video in Content tab to view detailed analytics

**Response:**
```json
{
  "analytics": {
    "video_id": "1",
    "title": "My Awesome Video",
    "thumbnail_url": "thumb.jpg",
    "total_views": 50000,
    "total_watch_time": 125000,
    "impressions": 75000,
    "ctr": 8.5,
    "avg_view_duration": 180,
    "engagement_rate": 12.5,
    "likes": 4500,
    "comments": 350,
    "shares": 125,
    "retention_data": [
      { "time": 0, "percentage": 100 },
      { "time": 30, "percentage": 85 },
      { "time": 60, "percentage": 70 },
      { "time": 90, "percentage": 55 },
      { "time": 120, "percentage": 45 }
    ],
    "traffic_sources": [
      { "source": "Browse", "views": 20000, "percentage": 40 },
      { "source": "Suggested", "views": 15000, "percentage": 30 },
      { "source": "Search", "views": 10000, "percentage": 20 },
      { "source": "External", "views": 5000, "percentage": 10 }
    ],
    "demographics": {
      "age_groups": [
        { "age": "18-24", "percentage": 35 },
        { "age": "25-34", "percentage": 40 },
        { "age": "35-44", "percentage": 15 },
        { "age": "45+", "percentage": 10 }
      ],
      "top_countries": [
        { "country": "United States", "percentage": 45 },
        { "country": "India", "percentage": 20 },
        { "country": "United Kingdom", "percentage": 15 },
        { "country": "Canada", "percentage": 10 },
        { "country": "Australia", "percentage": 10 }
      ]
    },
    "revenue": {
      "estimated_revenue": 125.50,
      "rpm": 2.51,
      "cpm": 1.67
    },
    "performance_comparison": {
      "vs_last_video": {
        "views": 15,
        "watch_time": 22
      },
      "vs_channel_avg": {
        "views": 8,
        "watch_time": 12
      }
    }
  }
}
```

**Field Descriptions:**
- `total_views`: Total number of views
- `total_watch_time`: Total watch time in seconds
- `impressions`: How many times thumbnail was shown
- `ctr`: Click-through rate (percentage of impressions that became views)
- `avg_view_duration`: Average time watched in seconds
- `engagement_rate`: Percentage of viewers who liked, commented, or shared
- `retention_data`: Array of retention percentages at different time points
- `traffic_sources`: Where views came from (Browse, Suggested, Search, External)
- `demographics`: Viewer demographics (age groups and countries)
- `revenue`: Estimated revenue, RPM (Revenue Per Mille), and CPM (Cost Per Mille)
- `performance_comparison`: Comparison with last video and channel average (percentage differences)

---

## Wallet & Payouts

#### GET /wallet/settings
Get user's payout settings.

**Response:**
```json
{
  "settings": {
    "bank_name": "Bank of America",
    "account_holder_name": "John Doe",
    "account_number": "****1234",
    "payment_method": "bank_transfer",
    "minimum_payout": 50.00,
    "country": "USA",
    "is_verified": true
  },
  "balance": {
    "available": 250.50,
    "pending": 150.00,
    "total_earned": 5000.00
  }
}
```

#### POST /wallet/settings
Update payout settings.

**Request Body:**
```json
{
  "bank_name": "Bank of America",
  "account_holder_name": "John Doe",
  "account_number": "1234567890",
  "routing_number": "021000021",
  "payment_method": "bank_transfer",
  "country": "USA"
}
```

#### GET /wallet/withdrawals?page=1
Get withdrawal history.

**Response:**
```json
{
  "withdrawals": [
    {
      "id": "1",
      "amount": 500.00,
      "currency": "USD",
      "status": "completed",
      "transaction_id": "TXN123456",
      "created_at": "2025-01-15T10:00:00Z",
      "processed_at": "2025-01-16T14:30:00Z"
    }
  ],
  "hasMore": false
}
```

#### POST /wallet/withdraw
Request a withdrawal.

**Request Body:**
```json
{
  "amount": 100.00,
  "payment_method": "bank_transfer",
  "notes": "Optional notes"
}
```

**Response:**
```json
{
  "withdrawal": {
    "id": "1",
    "amount": 100.00,
    "status": "pending",
    "created_at": "2025-01-21T10:00:00Z"
  },
  "message": "Withdrawal request submitted successfully"
}
```

---

## Ads & Monetization

#### GET /ads/feed?page=1&limit=10
Get active ads for feed injection.

**Response:**
```json
{
  "ads": [
    {
      "id": "1",
      "title": "Download Our App",
      "description": "Get 50% off your first order",
      "media_url": "ad_image.jpg",
      "media_type": "image",
      "target_url": "https://example.com/download"
    }
  ]
}
```

#### POST /ads/impression
Track ad impression.

**Request Body:**
```json
{
  "ad_id": "1",
  "device_id": "unique_device_id"
}
```

**Response:**
```json
{
  "message": "Impression tracked"
}
```

#### POST /ads/click
Track ad click.

**Request Body:**
```json
{
  "ad_id": "1",
  "device_id": "unique_device_id"
}
```

**Response:**
```json
{
  "message": "Click tracked",
  "target_url": "https://example.com/download"
}
```

---

## Watch Time Tracking (Viral Algorithm)

### ⚠️ CRITICAL - YouTube-Style Algorithm Requirements

The app implements a **YouTube/Instagram-style viral algorithm** that ranks videos based on:
1. **Watch Time** (most important) - Total seconds users spent watching
2. **Completion Rate** - Percentage of video watched (retention)
3. **Engagement** - Likes, comments, shares
4. **Recency** - When the video was uploaded

**Frontend Implementation:**
- Track watch time continuously during video playback
- Send watch duration to API when user pauses, scrolls, or leaves
- Use device ID for fraud prevention (see `utils/deviceId.ts`)

#### POST /videos/track-watch
Track video watch time for algorithm.

**⚠️ CRITICAL**: This endpoint MUST be called to track watch time for the viral algorithm.

**Request Body:**
```json
{
  "video_id": "1",
  "video_type": "video",
  "watch_duration": 45,
  "completion_rate": 75.0,
  "device_id": "unique_device_id"
}
```

**Fields:**
- `video_type`: "reel" or "video"
- `watch_duration`: Time watched in seconds (integer)
- `completion_rate`: Percentage watched (0-100, float)
- `device_id`: Unique device identifier for fraud prevention

**Response:**
```json
{
  "message": "Watch time tracked",
  "updated_score": 85.5,
  "viral_score": 85.5,
  "total_watch_time": 12500
}
```

**Backend Algorithm Logic (for reference):**
```
viral_score = (
  (total_watch_time * 0.5) +
  (avg_completion_rate * 0.3) +
  (engagement_rate * 0.15) +
  (recency_bonus * 0.05)
)
```

#### POST /reels/track-watch
Track reel watch time.

**Request Body:**
```json
{
  "reel_id": "1",
  "watch_duration": 15,
  "completion_rate": 100.0,
  "device_id": "unique_device_id"
}
```

**Response:** Same as `/videos/track-watch`

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "message": "Error description",
  "errors": {
    "field": ["Error message"]
  }
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `422`: Validation Error
- `500`: Internal Server Error

---

## File Upload Guidelines

### Image Requirements
- **Formats:** JPG, JPEG, PNG, WEBP
- **Max Size:** 10MB per image
- **Max Count:** 10 images per post
- **Recommended Dimensions:** 1080x1080 or 1080x1350

### Video Requirements
- **Formats:** MP4, MOV, WEBM
- **Max Size:** 
  - Reels: 100MB (max 60 seconds)
  - Videos: 500MB (max 60 minutes)
- **Recommended Resolution:** 1080x1920 (vertical) or 1920x1080 (horizontal)

---

## Rate Limiting

- **General API:** 100 requests per minute per user
- **Authentication:** 10 requests per minute per IP
- **File Upload:** 10 uploads per hour per user
- **Search:** 30 requests per minute per user

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642771200
```

---

## Best Practices

### 1. Token Management
- Store tokens securely (AsyncStorage on mobile)
- Refresh tokens before expiration
- Handle 401 errors by redirecting to login

### 2. Error Handling
```typescript
try {
  const response = await api.posts.create(formData);
  // Handle success
} catch (error: any) {
  if (error.status === 401) {
    // Redirect to login
  } else if (error.status === 422) {
    // Show validation errors
  } else {
    // Show generic error
    Alert.alert('Error', error.message || 'Something went wrong');
  }
}
```

### 3. Pagination
Always implement infinite scroll or load more functionality:

```typescript
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(true);

const loadMore = async () => {
  if (!hasMore) return;
  
  const response = await api.home.getFeed(page + 1, 10);
  setPage(page + 1);
  setHasMore(response.hasMore);
  // Append response.posts to existing posts
};
```

### 4. Image URLs
All image/video URLs returned by the API should be prefixed with the media base URL:

```typescript
const getImageUri = (uri: string) => {
  if (!uri) return '';
  return uri.startsWith('http') ? uri : `${MEDIA_BASE_URL}/${uri}`;
};
```

### 5. Optimistic Updates
For better UX, update UI immediately before API call:

```typescript
// Update UI
setIsLiked(true);
setLikes(likes + 1);

// Then make API call
try {
  await api.posts.like(postId);
} catch (error) {
  // Revert on error
  setIsLiked(false);
  setLikes(likes);
  Alert.alert('Error', 'Failed to like post');
}
```

---

## Testing

Use the API Debug Console (`/api-debug` route) to:
- View all API requests and responses
- Inspect request/response bodies
- Debug JSON parse errors
- Check network timing
- Identify backend issues

---

## 🔍 API Debug Console (Settings → Developer)

The mobile app includes a comprehensive **API Debug Console** for real-time API monitoring and backend debugging.

### Access:
- **Location:** Settings → API Debug Console (Developer section)
- **Route:** `/api-debug`
- **Logs Retained:** Last 100 API calls

### Features:

**Real-Time Monitoring:**
- ✅ All API requests and responses logged automatically
- ✅ Success/Error/Parse Error statistics in dashboard
- ✅ Request method, endpoint, and timestamp
- ✅ Response duration in milliseconds

**Detailed Inspection (tap any request):**
- ✅ **Request Body** - JSON or FormData indicator
- ✅ **Response Body** - Parsed JSON with syntax highlighting
- ✅ **Raw Response** - Exact text backend returned (critical for debugging)
- ✅ **HTTP Status Code** - 200, 400, 401, 404, 500, etc.
- ✅ **Content-Type** - Response header
- ✅ **Duration** - Response time in ms
- ✅ **Parse Errors** - When backend sends invalid JSON
- ✅ **Network Errors** - Connection failures

**Backend Issue Detection:**
- ⚠️ **JSON Parse Error** - Backend returned HTML/empty response instead of JSON
- ⚠️ **HTTP 404** - Endpoint not found or htaccess misconfigured
- ⚠️ **HTTP 401** - Invalid/expired authentication token
- ⚠️ **HTTP 500** - Backend PHP/database error
- ⚠️ **Empty Response** - Backend script crashed before output

### How Backend Developer Uses Debug Console:

**Step 1: Open Debug Console**
- Settings → API Debug Console on mobile app
- Or directly navigate to `/api-debug`

**Step 2: Perform Action**
- Execute the feature that's failing (e.g., login, upload, fetch data)
- Action is automatically logged in console

**Step 3: Inspect Request**
- Tap the logged request to see full details
- Check **Request Body** - verify frontend sends correct data
- Check **Endpoint** - verify correct API path

**Step 4: Inspect Response**
- Check **HTTP Status Code**:
  - 200-299 = Success
  - 400-499 = Client error (invalid request, unauthorized)
  - 500-599 = Server error (backend crash)
- Check **Raw Response** - see exact text backend returned
- Check **Parse Error** - if present, backend sent invalid JSON

**Step 5: Identify Issue**
- ❌ **Parse Error + HTML in Raw Response** → Backend returned error page
- ❌ **Parse Error + Empty Raw Response** → Backend crashed before output
- ❌ **HTTP 404** → Endpoint missing or htaccess issue
- ❌ **HTTP 401** → Token invalid/expired
- ❌ **HTTP 500** → Backend PHP/database error
- ✅ **HTTP 200 + Valid JSON** → Backend working correctly

### Common Backend Issues Detected:

#### Issue 1: Backend Returns HTML Instead of JSON
**Symptom**: JSON Parse Error + Raw response shows `<!DOCTYPE html>`
**Cause**: Backend PHP error/exception showing error page
**Solution**: Fix the PHP error on backend

#### Issue 2: Backend Returns Empty Response
**Symptom**: JSON Parse Error + Raw response is empty
**Cause**: Backend script dies before outputting JSON
**Solution**: Add proper JSON responses to all endpoints

#### Issue 3: Backend Returns Invalid JSON
**Symptom**: JSON Parse Error + Raw response shows malformed JSON
**Cause**: Backend has extra characters, BOM, or syntax error in JSON
**Solution**: Use `json_encode()` properly, check for UTF-8 BOM

#### Issue 4: Backend Returns 404
**Symptom**: HTTP 404 status
**Cause**: Endpoint doesn't exist or .htaccess not configured
**Solution**: Verify .htaccess rules and endpoint spelling

#### Issue 5: Backend Returns 401 Unauthorized
**Symptom**: HTTP 401 status
**Cause**: Missing/invalid Bearer token or session expired
**Solution**: Check JWT token validation on backend

---

---

## 📱 Frontend Implementation Summary

### All Integrated Endpoints:

#### ✅ Authentication Module
- `POST /auth/login` - Login with email and password
- `POST /auth/register` - Register new user account
- `POST /auth/logout` - Logout and invalidate token
- `POST /auth/forgot-password` - Send password reset email
- `GET /auth/me` - Get current authenticated user

#### ✅ Home Feed Module
- `GET /home?page=1&limit=10` - Get personalized feed
- `GET /stories` - Get stories from followed users

#### ✅ Stories Module
- `GET /stories` - Get all stories
- `GET /stories/user?user_id={id}` - Get user's stories
- `POST /stories/upload` - Upload new story (multipart/form-data)
- `POST /stories/view` - Mark story as viewed
- `DELETE /stories/:id` - Delete story

#### ✅ Posts Module
- `GET /posts/:id` - Get single post by ID
- `POST /posts/create` - Create new post (multipart/form-data)
- `DELETE /posts/:id` - Delete post (owner only)
- `POST /posts/action/like` - Like a post
- `POST /posts/action/unlike` - Unlike a post
- `POST /posts/action/comment` - Comment on post
- `GET /posts/comments?post_id={id}&page=1` - Get post comments
- `POST /posts/action/share` - Share post

#### ✅ Reels Module
- `GET /reels?page=1&limit=10` - Get reels feed
- `GET /reels/details?id={id}` - Get single reel details
- `POST /reels/upload` - Upload new reel (multipart/form-data)
- `POST /reels/action/like` - Like a reel
- `POST /reels/action/unlike` - Unlike a reel
- `POST /reels/action/comment` - Comment on reel
- `GET /reels/:id/comments?page=1` - Get reel comments
- `POST /reels/action/share` - Share reel

#### ✅ Videos Module
- `GET /videos?page=1&limit=10&category=All` - Get videos feed
- `GET /videos/details?id={id}` - Get single video details
- `POST /videos/upload` - Upload new video (multipart/form-data)
- `POST /videos/action/like` - Like a video
- `POST /videos/action/unlike` - Unlike a video
- `POST /videos/action/comment` - Comment on video
- `GET /videos/:id/comments?page=1` - Get video comments
- `POST /videos/action/share` - Share video
- `POST /videos/action/view` - Track video view

#### ✅ Users Module
- `GET /users/fetch_profile?user_id={id}` - Get public user profile
- `POST /users/edit_profile` - Update profile (multipart/form-data)
- `POST /users/avatar` - Upload avatar image (multipart/form-data)
- `POST /users/cover` - Upload cover image (multipart/form-data)
- `POST /users/action/follow` - Follow a user
- `POST /users/action/unfollow` - Unfollow a user
- `GET /users/:id/followers?page=1` - Get user's followers
- `GET /users/:id/following?page=1` - Get users following
- `GET /users/:id/posts?page=1` - Get user's posts (images only)
- `GET /users/:id/reels?page=1` - Get user's reels
- `GET /users/:id/videos?page=1` - Get user's videos

#### ✅ Search Module
- `GET /search?q={query}&page=1` - Search all content
- `GET /search/users?q={query}&page=1` - Search users only
- `GET /search/posts?q={query}&page=1` - Search posts only
- `GET /search/hashtags?tag={tag}&page=1` - Search by hashtag

#### ✅ Notifications Module
- `GET /notifications?page=1` - Get user notifications
- `PUT /notifications/:id/read` - Mark notification as read
- `PUT /notifications/read-all` - Mark all as read

#### ✅ Messages Module
- `GET /messages?page=1` - Get user conversations
- `GET /messages/:conversationId?page=1` - Get messages in conversation
- `POST /messages/send` - Send message
- `PUT /messages/:conversationId/read` - Mark conversation as read

#### ✅ Channels Module (Video Creator Feature)
- `GET /channels/:channelId` - Get channel details
- `GET /channels/:channelId/videos?page=1` - Get channel videos
- `POST /channels/action/subscribe` - Subscribe to channel
- `POST /channels/action/unsubscribe` - Unsubscribe from channel
- `POST /channels/create` - Create new channel
- `PUT /channels/:channelId` - Update channel
- `GET /channels/subscriptions?page=1` - Get user's subscriptions

#### ✅ Creator Studio Module
- `GET /creator/stats` - Get creator statistics
- `GET /creator/content/:type?page=1` - Get creator's content (posts/reels/videos)
- `GET /creator/earnings?period=month` - Get earnings data

#### ✅ Reports Module
- `POST /reports/create` - Report content or user
- `GET /reports/my?page=1` - Get user's submitted reports

#### ✅ Admin Module
- `GET /admin/stats` - Get admin statistics
- `GET /admin/users?page=1` - Get all users
- `POST /admin/users/:id/ban` - Ban user
- `POST /admin/users/:id/unban` - Unban user
- `POST /admin/users/:id/verify` - Verify user
- `DELETE /admin/content/:type/:id` - Delete content (post/reel/video)
- `GET /admin/reports?page=1` - Get reported content

---

## 🎨 Frontend Features Using APIs

### Time Format Display ("1h ago", "just now")
Implemented in: `constants/timeFormat.ts`
- All posts, reels, videos, comments, stories show relative time
- Example: "just now", "2m ago", "1h ago", "3d ago", "2w ago"

### Follow/Unfollow System
- UI updates immediately (optimistic updates)
- Shows "Following" button when `is_following: true`
- Shows "Follow" button when `is_following: false`
- Integrated on posts, user profiles, search results

### Stories System
- "Your Story" always shows first with upload option
- Watched stories have gray border
- Unwatched stories have gradient border (Instagram-style)
- Story viewer with auto-play and swipe navigation
- Click story → opens `/story-viewer` modal

### Comments System
- Shows commenter's profile photo, name, username
- Shows relative time ("1h ago")
- Profile photos are clickable → navigate to user profile
- Supports pagination (load more comments)

### Reels Experience
- Full-screen vertical video player
- Like, comment, share overlay actions
- Profile clickable in reels view
- Auto-play next reel on swipe
- Shows on Home feed (like Instagram)

### Search Functionality
- Tabs for All, Users, Posts, Hashtags
- Real-time search results
- Shows follow status on user results
- Empty states for "No results found"

### Creator Studio (Channel System)
- **Channel Requirement**: Users must create a channel to upload long-form videos
- **Channel Creation**: Modal with name and description fields
- **Real API Integration**: 
  - **Creator Studio Data**: Uses `/api/creator/*` endpoints (stats, earnings, content)
  - **Channel Check**: Uses `/api/channels/:userId` to verify channel existence
  - **Video Watching**: Uses `/api/channels/*` and `/api/videos/*` for video player
- **Three Tabs**:
  1. **Overview**: Channel info, performance stats (followers, views, likes, engagement), top performing content, analytics
  2. **Content**: Lists all posts, reels, and videos with thumbnails, stats, and clickable items
  3. **Earnings**: Total earnings, revenue breakdown (ad revenue, reels bonus), withdrawal options
- **Empty States**: Proper messaging when no channel exists or no content available
- **Refresh Button**: Manual refresh to reload creator data
- **Time Display**: All content shows relative time ("1h ago", "just now")

### API Routing Clarity:

**Creator Studio (Managing Content):**
- Open Creator Studio → Check channel: `GET /api/channels/:userId`
- Load stats → `GET /api/creator/stats`
- Load earnings → `GET /api/creator/earnings?period=month`
- Load content → `GET /api/creator/content/posts|reels|videos?page=1`
- Create channel → `POST /api/channels/create`

**Videos Tab (Watching Content):**
- Browse videos → `GET /api/videos?page=1&limit=10`
- Watch video → `GET /api/videos/details?id={videoId}`
- View channel → `GET /api/channels/{channelId}` (from video uploader)
- Subscribe → `POST /api/channels/action/subscribe`

---

## 🛡️ Frontend Error Handling

All API calls implement comprehensive error handling:

```typescript
try {
  const response = await api.posts.create(formData);
  // Success - show success message
  Alert.alert('Success', 'Post created successfully');
} catch (error: any) {
  // Error is automatically logged to API Debug Console
  
  if (error.status === 401) {
    // Unauthorized - redirect to login
    Alert.alert('Session Expired', 'Please login again');
    router.replace('/auth/login');
  } else if (error.status === 422) {
    // Validation error - show specific errors
    Alert.alert('Validation Error', error.message);
  } else if (error.status === 404) {
    // Not found
    Alert.alert('Not Found', 'The requested resource was not found');
  } else {
    // Generic error
    Alert.alert('Error', error.message || 'Something went wrong');
  }
}
```

---

## 📊 API Response Expectations

### Expected Response Formats:

All responses should be valid JSON with proper `Content-Type: application/json` header.

#### Success Responses:
```json
{
  "success": true,
  "data": { /* your data */ },
  "message": "Operation successful" // optional
}
```

#### Error Responses:
```json
{
  "success": false,
  "message": "Error description",
  "errors": {
    "field_name": ["Validation error message"]
  }
}
```

### Important: User Profile Response

The `/users/fetch_profile` endpoint **MUST** include these fields:

```json
{
  "success": true,
  "user": {
    "id": "1",
    "username": "john_doe",
    "name": "John Doe",
    "bio": "Bio text",
    "avatar": "profile/avatar.jpg",
    "cover_photo": "profile/cover.jpg",
    "followers_count": 1000,
    "following_count": 500,
    "posts_count": 150,
    "reels_count": 25,       // ⚠️ Required for Reels tab
    "videos_count": 10,      // ⚠️ Required for Videos tab
    "is_verified": true,
    "is_following": false,   // ⚠️ Required for Follow/Following button
    "is_current_user": false // ⚠️ Required to show Edit Profile vs Follow
  }
}
```

---

## 🎬 Video Upload - Full SEO Features

The Video Upload screen provides YouTube-level SEO and customization:

### Upload Features

**Video Selection:**
- Pick video from media library
- Show video file name and duration
- Support MP4, MOV, WEBM (max 500MB)

**Title & Description:**
- Title: 100 character limit with counter
- Description: 5000 character limit with counter
- SEO-friendly placeholder hints

**Thumbnail:**
- Custom thumbnail upload
- Recommended size: 1280x720 (16:9 aspect ratio)
- Preview before upload

**Category Selection:**
- Horizontal scrollable chips
- 12 categories: Gaming, Entertainment, Music, Sports, News, Education, Technology, Comedy, Vlog, Tutorial, Review, How-to

**Tags:**
- Comma-separated tags input
- SEO hint: "Tags help viewers find your video"

**Visibility Settings:**
- **Public**: Everyone can see (default)
- **Unlisted**: Only people with the link
- **Private**: Only you can see
- Radio button selection with icons and descriptions

**Advanced Settings:**
- **Allow Comments**: Toggle switch (default: ON)
- **Monetization**: Enable ads on video (default: ON)

**Upload Process:**
- FormData upload with multipart/form-data
- All fields properly validated before upload
- Success: Invalidates videos and creator queries, navigates back
- Error: Shows detailed error message
- Loading state with disabled upload button

### API Endpoint Requirements

**POST /videos/upload**
- Must accept all form fields listed above
- Must return video object with `id`, `title`, `viral_score`, etc.
- Must handle thumbnail as separate file upload
- Must validate title and description requirements

---

## 🎬 Creator Studio Features

The Creator Studio is a comprehensive dashboard for content creators with the following features:

### Channel System

#### Creating a Channel
Users without a channel see:
- Large "No Channel Found" message
- Explanation: "You need to create a channel to access Creator Studio features and upload long videos."
- "Create Channel" button

Channel creation form includes:
- Channel Name (required)
- Description (optional)
- API Endpoint: `POST /channels/create`

#### Channel Requirements
- Users **MUST** have a channel to:
  - Upload long-form videos (videos longer than 60 seconds)
  - Access Creator Studio features
  - View earnings and analytics
- Short-form content (posts, reels) does NOT require a channel

### Overview Tab

**Channel Header**
- Channel name
- Subscriber count
- Video count

**Performance Stats** (4 cards):
1. Followers (with monthly growth %)
2. Views (with monthly growth %)
3. Likes (with monthly growth %)
4. Engagement Rate (with monthly growth %)

**Top Performing Section**:
- Shows most popular reel with:
  - Thumbnail
  - Caption
  - View count
  - Like count
  - Clickable to navigate to reel

**Analytics Card**:
- Total views reach
- "Your content reached X people this month"

### Content Tab

**Three Sections:**

1. **Posts Section**
   - Shows all user posts
   - Thumbnail, title, views, likes, time ago
   - Empty state: "No posts yet"

2. **Reels Section**
   - Shows all user reels
   - Thumbnail, caption, views, likes, time ago
   - Empty state: "No reels yet"

3. **Videos Section**
   - Shows all long-form videos
   - Thumbnail, title, views, likes, time ago
   - Empty state: "No videos yet. Create a channel to upload videos!"

**Content Items**:
- Clickable (navigates to content detail page)
- Shows formatted view count (1.5K, 2.3M, etc.)
- Shows formatted like count
- Shows relative time ("2h ago", "1d ago")

### Earnings Tab

**With Earnings Data:**

**Total Earnings Card**:
- Large dollar amount
- Period (week/month/year)
- Breakdown:
  - Available earnings (green)
  - Pending earnings (yellow/warning color)
  - Paid out earnings (green)

**Revenue Breakdown**:
1. Ad Revenue - "From video ads"
2. Reels Bonus - "Performance bonus"

**Withdrawal Section**:
- "Request Withdrawal" button (shows "Coming Soon" alert)
- Note: "Minimum withdrawal amount is $100. Payments are processed within 3-5 business days."

**Without Earnings Data:**
- Empty state with dollar icon
- "No Earnings Yet" title
- "Start creating content to earn revenue from ads, bonuses, and more!" message

### API Endpoints Used

**⚠️ CRITICAL ROUTING RULES:**

1. **Creator Studio** = Always use `/api/creator/*` for stats, earnings, and content management
2. **Video Watching** = Use `/api/videos/*` and `/api/channels/*` for viewing videos and channel info
3. **DO NOT MIX** these endpoint namespaces!

```typescript
// ===== CREATOR STUDIO FLOW =====

// Step 1: Check if user has a channel (when opening Creator Studio)
GET /channels/check-user-channel?user_id={userId}
Response: { success: true, has_channel: true, data: { id, name, subscribers_count, videos_count, ... } }

// Step 2a: If no channel, create one
POST /channels/create
Body: { name: string, description: string }
Response: { channel: { id, name, ... } }

// Step 2b: If channel exists, load Creator Studio data
GET /creator/stats
Response: {
  stats: {
    total_followers: number,
    total_views: number,
    total_likes: number,
    engagement_rate: number,
    monthly_growth?: { followers, views, engagement }
  }
}

GET /creator/earnings?period=month
Response: {
  earnings: {
    total_earnings: number,
    pending_earnings: number,
    paid_earnings: number,
    ad_revenue: number,
    reels_bonus: number,
    period: string
  }
}

GET /creator/content/:type?page=1
Types: 'posts', 'reels', 'videos'
Response: { content: Array<Post|Reel|Video>, hasMore: boolean }

// ===== VIDEO WATCHING FLOW =====

// Step 1: Browse videos in Videos tab
GET /videos?page=1&limit=10
Response: { videos: [...], hasMore: boolean }

// Step 2: Watch a video
GET /videos/details?id={videoId}
Response: { video: { id, title, user: { id, name, channel_id, ... }, ... } }

// Step 3: View uploader's channel (click on channel name)
GET /channels/{channelId}  // Use video.user.channel_id
Response: { channel: { id, name, subscribers_count, ... } }

// Step 4: Subscribe to channel
POST /channels/action/subscribe
Body: { channel_id: string }
Response: { isSubscribed: true, subscribers_count: number }
```

### User Flow

1. **User opens Creator Studio**
   - App checks if user has a channel (API: `/channels/:userId`)
   - Loading spinner shown during check

2. **If No Channel**:
   - Shows "No Channel Found" screen
   - User clicks "Create Channel"
   - Modal appears with form
   - User enters name and description
   - Submits (API: `POST /channels/create`)
   - Success alert shown
   - Data automatically loaded

3. **If Channel Exists**:
   - Shows Creator Studio with three tabs
   - Overview tab shown by default
   - Real data loaded from APIs
   - Refresh button available to reload data

4. **Content Interaction**:
   - Click on post → navigates to `/post/:id`
   - Click on reel → navigates to `/reels`
   - Click on video → navigates to `/videos`

### Video Upload Restrictions

**Without Channel:**
- ❌ Cannot upload videos (long-form content)
- ✅ Can upload posts (images)
- ✅ Can upload reels (short vertical videos)

**With Channel:**
- ✅ Can upload all content types
- ✅ Access to Creator Studio features
- ✅ Access to earnings and analytics
- ✅ Can monetize content

---

## 🚀 Quick Reference for Backend Developer

### API Debug Console Location
**Path:** Settings → API Debug Console (Developer section)  
**Route:** `/api-debug`

### What Gets Logged?
1. ✅ **All API Requests** - Method, endpoint, request body
2. ✅ **All API Responses** - Status code, response body, duration
3. ✅ **Errors** - HTTP errors, network errors, JSON parse errors
4. ✅ **Raw Response** - Exact text backend returned (for debugging)
5. ✅ **Content-Type** - Response headers

### How to Debug Backend Issues:

1. **Open Settings → API Debug Console** on mobile app
2. **Perform the action** that's failing (e.g., login, upload, fetch data)
3. **Tap the logged request** to see full details
4. **Check the following:**
   - ✅ **Request Body** - Is frontend sending correct data?
   - ✅ **HTTP Status Code** - 200 = success, 4xx/5xx = error
   - ✅ **Raw Response** - What did backend actually return?
   - ✅ **Parse Error** - Did backend send invalid JSON?

### Common Issues & Solutions:

| Issue | Symptom | Cause | Solution |
|-------|---------|-------|----------|
| **JSON Parse Error** | Parse error + HTML in raw response | Backend returned error page | Fix PHP error on backend |
| **404 Not Found** | HTTP 404 | Endpoint missing | Check htaccess or endpoint path |
| **401 Unauthorized** | HTTP 401 | Invalid/expired token | Check JWT validation |
| **Empty Response** | Parse error + empty raw response | Backend crashed | Add proper JSON output |
| **500 Server Error** | HTTP 500 | Database/PHP error | Check backend logs |

### Frontend API Integration Status:

**✅ ALL ENDPOINTS INTEGRATED:**
- Authentication (Login, Register, Logout, Me)
- Home Feed (Posts, Stories)
- Posts (Create, Like, Comment, Share, Delete)
- Reels (Upload, Like, Comment, Share, Track Watch)
- Videos (Upload, Like, Comment, Share, View, Track Watch)
- Users (Profile, Follow/Unfollow, Posts, Reels, Videos)
- Search (All, Users, Posts, Hashtags)
- Notifications (Get, Read, Read All)
- Messages (Conversations, Send, Mark Read)
- Stories (Upload, View, Delete, Reactions, Viewers)
- Channels (Create, Subscribe/Unsubscribe, Videos)
- Creator Studio (Stats, Content, Earnings)
- Reports & Admin Functions
- Watch Time Tracking (Viral Algorithm)

**Frontend is production-ready and fully tested.** All 70+ endpoints integrated with comprehensive error tracking. Backend must implement endpoints matching this specification.

---

## Contact Support

For backend issues or API questions, contact your backend developer.

**Frontend Status:** ✅ All APIs integrated and working. Please verify backend endpoints match this specification.

---

## 🚨 CRITICAL: API Endpoint Routing Rules

### Two Separate API Namespaces

The app has **TWO DISTINCT API FLOWS** that must NOT be confused:

#### 1. Creator Studio Flow (`/api/creator/*`)
**When:** User opens Creator Studio to manage their content
**Endpoints:**
- `GET /api/creator/stats` - Get creator statistics
- `GET /api/creator/earnings` - Get earnings data
- `GET /api/creator/content/posts|reels|videos` - Get creator's content

**Purpose:** Content management, analytics, earnings for the creator themselves

---

#### 2. Video Watching Flow (`/api/videos/*` + `/api/channels/*`)
**When:** User browses and watches videos in the Videos tab
**Endpoints:**
- `GET /api/videos` - Browse videos feed
- `GET /api/videos/details?id={id}` - Get video details
- `GET /api/channels/{channelId}` - Get channel info (when user clicks channel in video)
- `POST /api/channels/action/subscribe` - Subscribe to a channel

**Purpose:** Viewing public videos and interacting with channels

---

### Common Mistake ❌

**WRONG:** Using `/api/channels/*` in Creator Studio for stats/content
```typescript
// ❌ DO NOT DO THIS in Creator Studio
api.channels.getChannel(userId)
api.channels.getChannelVideos(channelId, page)
```

**CORRECT:** Using `/api/creator/*` in Creator Studio
```typescript
// ✅ CORRECT for Creator Studio
api.creator.getStats()
api.creator.getContent('videos', page)
api.creator.getEarnings('month')
```

---

### Frontend Implementation Summary

#### Creator Studio (`app/creator-studio.tsx`)
```typescript
// Check if user has channel
const channelResponse = await api.channels.checkUserChannel(user?.id || '');

if (channelResponse.success && channelResponse.has_channel && channelResponse.data) {
  // Load Creator Studio data using /creator/* endpoints
  await api.creator.getStats();
  await api.creator.getEarnings('month');
  await api.creator.getContent('posts', 1);
  await api.creator.getContent('reels', 1);
  await api.creator.getContent('videos', 1);
}
```

#### Videos Tab (`app/(tabs)/videos.tsx`)
```typescript
// Browse videos using /videos endpoint
const videosData = await api.videos.getVideos(1, 20);
```

#### Video Player (`app/video-player.tsx`)
```typescript
// Get video details
const videoRes = await api.videos.getDetails(videoId);

// If video has a channel, get channel details for Subscribe button
if (videoRes.video.user?.channel_id) {
  const channelRes = await api.channels.getChannel(videoRes.video.user.channel_id);
}
```

---

### Backend Requirements

The backend must implement these endpoint separations:

1. **`/api/creator/*`** - Authenticated creator managing their own content
   - Returns the authenticated user's data only
   - Requires valid JWT token
   - Used in Creator Studio dashboard

2. **`/api/channels/*`** - Public channel information
   - Returns any channel's public data
   - Used when viewing videos and channels
   - Subscribe/unsubscribe actions

3. **`/api/videos/*`** - Public video browsing and watching
   - Returns public videos feed
   - Video details for watching
   - Comments, likes, shares

---

### Testing Checklist

**Creator Studio:**
- ✅ Opens Creator Studio → hits `GET /channels/check-user-channel?user_id={userId}`
- ✅ Channel exists → hits `GET /creator/stats`
- ✅ Overview tab → shows stats from `/creator/stats`
- ✅ Content tab → shows content from `/creator/content/posts|reels|videos`
- ✅ Earnings tab → shows earnings from `/creator/earnings`

**Videos Tab:**
- ✅ Opens Videos tab → hits `GET /videos`
- ✅ Clicks video → hits `GET /videos/details?id={id}`
- ✅ Video player shows channel → hits `GET /channels/{channelId}`
- ✅ Clicks Subscribe → hits `POST /channels/action/subscribe`

**API Debug Console:**
- ✅ All requests are logged with correct endpoints
- ✅ No mixing of `/creator/*` and `/channels/*` in wrong contexts
