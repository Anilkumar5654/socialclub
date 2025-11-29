import { MEDIA_BASE_URL } from '@/services/api';

const MOVIEDBR_BASE_URL = 'https://www.moviedbr.com';

export const MEDIA_FALLBACKS = {
  userProfile: `${MOVIEDBR_BASE_URL}/assets/profile.jpg`,
  userCover: `${MOVIEDBR_BASE_URL}/assets/p_cover.jpg`,
  channelProfile: `${MOVIEDBR_BASE_URL}/assets/c_profile.jpg`,
  channelCover: `${MOVIEDBR_BASE_URL}/assets/c_cover.jpg`,
} as const;

type MediaFallbackKey = keyof typeof MEDIA_FALLBACKS;

export function buildMediaUrl(
  path?: string | null,
  fallback: MediaFallbackKey = 'userProfile'
): string {
  if (typeof path === 'string' && path.trim().length > 0) {
    const sanitizedPath = path.trim();
    if (sanitizedPath.startsWith('http')) {
      return sanitizedPath;
    }
    const normalizedPath = sanitizedPath.replace(/^\/+/u, '');
    return `${MEDIA_BASE_URL}/${normalizedPath}`;
  }

  return MEDIA_FALLBACKS[fallback];
}

export function buildAbsoluteAsset(relativePath: string): string {
  const normalizedPath = relativePath.startsWith('/')
    ? relativePath
    : `/${relativePath}`;

  return `${MOVIEDBR_BASE_URL}${normalizedPath}`;
}
