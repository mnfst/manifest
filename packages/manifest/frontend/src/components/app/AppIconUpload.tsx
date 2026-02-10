import { useRef, useState } from 'react';
import { Camera, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { Spinner } from '@/components/ui/shadcn/spinner';

interface AppIconUploadProps {
  currentIconUrl?: string;
  appName: string;
  onUpload: (file: File) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Validate image dimensions (128x128 minimum)
 * Non-square images are allowed - they will be center-cropped on the server
 */
async function validateImageDimensions(file: File): Promise<{ valid: boolean; error?: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      if (img.width < 128 || img.height < 128) {
        resolve({ valid: false, error: 'Image must be at least 128x128 pixels' });
      } else {
        resolve({ valid: true });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      resolve({ valid: false, error: 'Invalid image file' });
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * App icon with hover-to-upload functionality
 * Shows upload overlay on hover, handles file selection and validation
 */
export function AppIconUpload({
  currentIconUrl,
  appName,
  onUpload,
  isLoading = false,
}: AppIconUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (!isLoading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!file.type.match(/^image\/(png|jpeg|gif|webp)$/)) {
      setError('Invalid file type. Supported formats: PNG, JPG, GIF, WebP');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB');
      return;
    }

    // Validate dimensions
    const validation = await validateImageDimensions(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid image');
      return;
    }

    try {
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }

    // Reset file input
    e.target.value = '';
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={isLoading}
        className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 transition-shadow hover:shadow-md"
        aria-label="Upload app icon"
      >
        {/* Current icon */}
        {currentIconUrl ? (
          <img
            src={currentIconUrl}
            alt={`${appName} icon`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-gray-400" />
          </div>
        )}

        {/* Hover overlay */}
        {(isHovered || isLoading) && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            {isLoading ? (
              <Spinner className="w-6 h-6 text-white" />
            ) : (
              <Camera className="w-6 h-6 text-white" />
            )}
          </div>
        )}
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Error message */}
      {error && (
        <div className="absolute left-0 top-full mt-2 z-10 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 whitespace-nowrap shadow-lg">
          {error}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="ml-2 p-0 h-auto text-red-500 hover:text-red-700 hover:bg-transparent"
            aria-label="Dismiss error"
          >
            &times;
          </Button>
        </div>
      )}
    </div>
  );
}
