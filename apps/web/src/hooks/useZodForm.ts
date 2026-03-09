'use client';

import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseZodFormOptions<T extends z.ZodTypeAny> {
  schema: T;
  initialValues?: Partial<z.infer<T>>;
  onSubmit?: (values: z.infer<T>) => void | Promise<void>;
}

export interface UseZodFormReturn<T extends z.ZodTypeAny> {
  values: Partial<z.infer<T>>;
  errors: Partial<Record<keyof z.infer<T>, string>>;
  handleChange: (
    field: keyof z.infer<T>,
  ) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleBlur: (
    field: keyof z.infer<T>,
  ) => () => void;
  handleSubmit: (e?: React.FormEvent) => Promise<boolean>;
  setFieldValue: (field: keyof z.infer<T>, value: any) => void;
  setFieldError: (field: keyof z.infer<T>, error: string) => void;
  setValues: (values: Partial<z.infer<T>>) => void;
  clearErrors: () => void;
  reset: () => void;
  isValid: boolean;
  isValidating: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * A reusable form hook that integrates Zod validation with React state management.
 * Provides real-time field-level validation on blur and form-level validation on submit.
 *
 * @example
 * ```tsx
 * const form = useZodForm({
 *   schema: loginSchema,
 *   initialValues: { email: '', password: '' },
 *   onSubmit: async (values) => {
 *     await login(values);
 *   }
 * });
 *
 * return (
 *   <form onSubmit={form.handleSubmit}>
 *     <input
 *       value={form.values.email || ''}
 *       onChange={form.handleChange('email')}
 *       onBlur={form.handleBlur('email')}
 *     />
 *     {form.errors.email && <span>{form.errors.email}</span>}
 *   </form>
 * );
 * ```
 */
export function useZodForm<T extends z.ZodTypeAny>({
  schema,
  initialValues = {} as Partial<z.infer<T>>,
  onSubmit,
}: UseZodFormOptions<T>): UseZodFormReturn<T> {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [values, setValuesState] = useState<Partial<z.infer<T>>>(initialValues);
  const [errors, setErrorsState] = useState<Partial<Record<keyof z.infer<T>, string>>>({});
  const [touchedFields, setTouchedFields] = useState<Set<keyof z.infer<T>>>(new Set());
  const [isValidating, setIsValidating] = useState(false);

  // ---------------------------------------------------------------------------
  // Validation helpers
  // ---------------------------------------------------------------------------

  /**
   * Validate a single field using Zod schema
   */
  const validateField = useCallback(
    (field: keyof z.infer<T>, value: any): string | null => {
      try {
        // Try to validate just this field if schema supports shape (object schema)
        if ('shape' in schema && schema.shape) {
          const fieldSchema = (schema.shape as any)[field];
          if (fieldSchema) {
            fieldSchema.parse(value);
          }
        } else {
          // For non-object schemas, validate the whole form
          schema.parse({ ...values, [field]: value });
        }
        return null;
      } catch (error) {
        if (error instanceof z.ZodError) {
          const fieldError = error.issues.find((e) => {
            // Check if error path matches the field
            return e.path.length > 0 && e.path[0] === field;
          });
          return fieldError?.message || error.issues[0]?.message || 'Invalid value';
        }
        return 'Invalid value';
      }
    },
    [schema, values],
  );

  /**
   * Validate all fields in the form
   */
  const validateForm = useCallback((): boolean => {
    try {
      schema.parse(values);
      setErrorsState({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formErrors: Partial<Record<keyof z.infer<T>, string>> = {};
        error.issues.forEach((err) => {
          const field = err.path[0] as keyof z.infer<T>;
          if (field && !formErrors[field]) {
            formErrors[field] = err.message;
          }
        });
        setErrorsState(formErrors);
      }
      return false;
    }
  }, [schema, values]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /**
   * Handle input change for a specific field
   */
  const handleChange = useCallback(
    (field: keyof z.infer<T>) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const value = e.target.type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : e.target.value;

        setValuesState((prev) => ({
          ...prev,
          [field]: value,
        }));

        // Clear error for this field if it exists
        if (errors[field]) {
          setErrorsState((prev) => {
            const newErrors = { ...prev };
            delete newErrors[field];
            return newErrors;
          });
        }
      },
    [errors],
  );

  /**
   * Handle blur event for a specific field - triggers validation
   */
  const handleBlur = useCallback(
    (field: keyof z.infer<T>) => () => {
      // Mark field as touched
      setTouchedFields((prev) => {
        const newSet = new Set(prev);
        newSet.add(field);
        return newSet;
      });

      // Validate the field
      const fieldValue = values[field];
      const error = validateField(field, fieldValue);

      if (error) {
        setErrorsState((prev) => ({
          ...prev,
          [field]: error,
        }));
      } else {
        setErrorsState((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    },
    [values, validateField],
  );

  /**
   * Handle form submission with full validation
   */
  const handleSubmit = useCallback(
    async (e?: React.FormEvent): Promise<boolean> => {
      if (e) {
        e.preventDefault();
      }

      setIsValidating(true);

      // Validate entire form
      const isFormValid = validateForm();

      setIsValidating(false);

      if (!isFormValid) {
        return false;
      }

      // Call onSubmit callback if provided
      if (onSubmit) {
        try {
          await onSubmit(values as z.infer<T>);
        } catch (error) {
          // Allow parent component to handle submission errors
          return false;
        }
      }

      return true;
    },
    [values, validateForm, onSubmit],
  );

  /**
   * Programmatically set a field value
   */
  const setFieldValue = useCallback((field: keyof z.infer<T>, value: any) => {
    setValuesState((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  /**
   * Programmatically set a field error
   */
  const setFieldError = useCallback((field: keyof z.infer<T>, error: string) => {
    setErrorsState((prev) => ({
      ...prev,
      [field]: error,
    }));
  }, []);

  /**
   * Set multiple form values at once
   */
  const setValues = useCallback((newValues: Partial<z.infer<T>>) => {
    setValuesState(newValues);
  }, []);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrorsState({});
  }, []);

  /**
   * Reset form to initial values
   */
  const reset = useCallback(() => {
    setValuesState(initialValues);
    setErrorsState({});
    setTouchedFields(new Set());
  }, [initialValues]);

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  /**
   * Check if form is valid (no errors and all required fields have values)
   */
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0 && validateForm();
  }, [errors, validateForm]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    values,
    errors,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setFieldError,
    setValues,
    clearErrors,
    reset,
    isValid,
    isValidating,
  };
}
