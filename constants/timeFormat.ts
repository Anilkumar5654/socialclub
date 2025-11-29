export function formatTimeAgo(timestamp: string | Date | undefined | null): string {
  if (!timestamp) return 'just now';

  let date: Date;

  if (typeof timestamp === 'string') {
    date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      return 'just now';
    }
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    return 'just now';
  }

  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(days / 365);
  return `${years}y ago`;
}
