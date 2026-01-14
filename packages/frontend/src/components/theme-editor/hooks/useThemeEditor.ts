import { useState, useCallback, useMemo, useEffect } from 'react';
import type { ThemeVariables } from '@chatgpt-app-builder/shared';
import { DEFAULT_THEME_VARIABLES } from '@chatgpt-app-builder/shared';
import {
  validateHslString,
  validateRadius,
  isColorVariable,
} from '../../../lib/hsl-utils';

export interface UseThemeEditorOptions {
  /** Initial theme variables from the database */
  initialVariables: ThemeVariables;
  /** Callback when save is triggered */
  onSave: (variables: ThemeVariables) => Promise<void>;
}

export interface UseThemeEditorReturn {
  /** Current editing values */
  variables: ThemeVariables;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Map of variable keys to validation error messages */
  errors: Map<string, string>;
  /** Whether all values are valid */
  isValid: boolean;
  /** Update a single variable */
  updateVariable: (key: keyof ThemeVariables, value: string) => void;
  /** Update all variables at once (for code editor) */
  updateAllVariables: (variables: Partial<ThemeVariables>) => void;
  /** Save current variables */
  save: () => Promise<void>;
  /** Reset to default theme values */
  resetToDefaults: () => void;
  /** Discard changes and revert to saved values */
  discardChanges: () => void;
}

/**
 * Hook for managing theme editor state
 * Provides centralized state management, validation, and dirty tracking
 */
export function useThemeEditor({
  initialVariables,
  onSave,
}: UseThemeEditorOptions): UseThemeEditorReturn {
  // Current editing values
  const [variables, setVariables] = useState<ThemeVariables>(initialVariables);
  // Saved values for dirty comparison
  const [savedVariables, setSavedVariables] = useState<ThemeVariables>(initialVariables);
  // Save operation state
  const [isSaving, setIsSaving] = useState(false);
  // Validation errors
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  // Calculate if there are unsaved changes
  const isDirty = useMemo(() => {
    return JSON.stringify(variables) !== JSON.stringify(savedVariables);
  }, [variables, savedVariables]);

  // Calculate if all values are valid
  const isValid = useMemo(() => {
    return errors.size === 0;
  }, [errors]);

  // Warn user before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        // Modern browsers ignore custom messages but still show a warning
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Validate a single value
  const validateValue = useCallback((key: string, value: string): string | null => {
    if (key === '--radius') {
      return validateRadius(value);
    }
    if (isColorVariable(key)) {
      return validateHslString(value);
    }
    return null;
  }, []);

  // Update a single variable
  const updateVariable = useCallback((key: keyof ThemeVariables, value: string) => {
    setVariables((prev) => ({
      ...prev,
      [key]: value,
    }));

    // Validate and update errors
    const error = validateValue(key, value);
    setErrors((prev) => {
      const next = new Map(prev);
      if (error) {
        next.set(key, error);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, [validateValue]);

  // Update all variables at once (for code editor)
  const updateAllVariables = useCallback((newVariables: Partial<ThemeVariables>) => {
    setVariables((prev) => ({
      ...prev,
      ...newVariables,
    }));

    // Validate all new values
    setErrors((prev) => {
      const next = new Map(prev);
      for (const [key, value] of Object.entries(newVariables)) {
        if (value !== undefined) {
          const error = validateValue(key, value);
          if (error) {
            next.set(key, error);
          } else {
            next.delete(key);
          }
        }
      }
      return next;
    });
  }, [validateValue]);

  // Save current variables
  const save = useCallback(async () => {
    if (!isValid) return;

    setIsSaving(true);
    try {
      await onSave(variables);
      setSavedVariables(variables);
    } finally {
      setIsSaving(false);
    }
  }, [variables, isValid, onSave]);

  // Reset to default theme values
  const resetToDefaults = useCallback(() => {
    setVariables(DEFAULT_THEME_VARIABLES);
    setErrors(new Map());
  }, []);

  // Discard changes and revert to saved values
  const discardChanges = useCallback(() => {
    setVariables(savedVariables);
    setErrors(new Map());
  }, [savedVariables]);

  return {
    variables,
    isDirty,
    isSaving,
    errors,
    isValid,
    updateVariable,
    updateAllVariables,
    save,
    resetToDefaults,
    discardChanges,
  };
}
