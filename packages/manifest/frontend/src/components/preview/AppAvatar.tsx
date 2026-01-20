import { useState } from 'react';

interface AppAvatarProps {
  name: string;
  logoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Generate a consistent color based on the app name
 */
function getColorFromName(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Get the first letter of the app name for fallback display
 */
function getInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : 'A';
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

/**
 * AppAvatar component - displays app logo or fallback initial
 * Gracefully handles missing or failed logo loads
 */
export function AppAvatar({ name, logoUrl, size = 'md', className = '' }: AppAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const showFallback = !logoUrl || imageError;
  const colorClass = getColorFromName(name);
  const sizeClass = sizeClasses[size];

  if (showFallback) {
    return (
      <div
        className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center text-white font-semibold ${className}`}
      >
        {getInitial(name)}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${name} logo`}
      className={`${sizeClass} rounded-full object-cover ${className}`}
      onError={() => setImageError(true)}
    />
  );
}
