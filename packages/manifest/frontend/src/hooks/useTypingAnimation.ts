import { useState, useEffect, useCallback } from 'react';

interface UseTypingAnimationOptions {
  /** The text to animate */
  text: string;
  /** Base speed in milliseconds per character (default: 50) */
  speed?: number;
  /** Random variation ± milliseconds for natural feel (default: 20) */
  randomVariation?: number;
  /** Whether animation should start immediately (default: true) */
  autoStart?: boolean;
}

interface UseTypingAnimationResult {
  /** Currently displayed text (progressively built) */
  displayedText: string;
  /** Whether the full text has been displayed */
  isComplete: boolean;
  /** Reset and restart the animation */
  restart: () => void;
}

/**
 * Hook for character-by-character typing animation
 * Uses setTimeout with random variation for a natural feel
 */
export function useTypingAnimation({
  text,
  speed = 50,
  randomVariation = 20,
  autoStart = true,
}: UseTypingAnimationOptions): UseTypingAnimationResult {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [key, setKey] = useState(0);

  const restart = useCallback(() => {
    setDisplayedText('');
    setIsComplete(false);
    setKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!text || !autoStart) {
      setDisplayedText('');
      setIsComplete(false);
      return;
    }

    let currentIndex = 0;
    let timeoutId: number;
    let isCancelled = false;

    const typeNextChar = () => {
      if (isCancelled) return;

      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;

        // Add random variation for natural typing feel
        const variance = Math.random() * randomVariation * 2 - randomVariation;
        const delay = Math.max(10, speed + variance);
        timeoutId = window.setTimeout(typeNextChar, delay);
      } else {
        setIsComplete(true);
      }
    };

    // Start typing
    typeNextChar();

    // Cleanup function to prevent memory leaks
    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [text, speed, randomVariation, autoStart, key]);

  return { displayedText, isComplete, restart };
}
