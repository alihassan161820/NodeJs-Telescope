import { useState, useEffect } from 'react';

interface TimeAgoProps {
  date: string | Date;
}

function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatAbsolute(date: Date): string {
  return date.toLocaleString();
}

export function TimeAgo({ date }: TimeAgoProps) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <time
      dateTime={dateObj.toISOString()}
      title={formatAbsolute(dateObj)}
      className="text-gray-500 text-sm whitespace-nowrap"
    >
      {formatTimeAgo(dateObj)}
    </time>
  );
}
