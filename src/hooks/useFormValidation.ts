import { useState, useCallback } from 'react';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => string | null;
}

export interface ValidationRules {
  [key: string]: ValidationRule;
}

export interface ValidationErrors {
  [key: string]: string;
}

export interface FormValidationResult {
  errors: ValidationErrors;
  isValid: boolean;
  validateField: (fieldName: string, value: string) => string | null;
  validateForm: (values: Record<string, string>) => boolean;
  clearErrors: () => void;
  clearFieldError: (fieldName: string) => void;
}

export const useFormValidation = (rules: ValidationRules): FormValidationResult => {
  const [errors, setErrors] = useState<ValidationErrors>({});

  const validateField = useCallback((fieldName: string, value: string): string | null => {
    const rule = rules[fieldName];
    if (!rule) return null;

    // Required validation
    if (rule.required && (!value || value.trim().length === 0)) {
      return 'Este campo é obrigatório';
    }

    // Skip other validations if field is empty and not required
    if (!value || value.trim().length === 0) {
      return null;
    }

    // Min length validation
    if (rule.minLength && value.trim().length < rule.minLength) {
      return `Deve ter pelo menos ${rule.minLength} caracteres`;
    }

    // Max length validation
    if (rule.maxLength && value.trim().length > rule.maxLength) {
      return `Deve ter no máximo ${rule.maxLength} caracteres`;
    }

    // Pattern validation
    if (rule.pattern && !rule.pattern.test(value)) {
      return 'Formato inválido';
    }

    // Custom validation
    if (rule.custom) {
      return rule.custom(value);
    }

    return null;
  }, [rules]);

  const validateForm = useCallback((values: Record<string, string>): boolean => {
    const newErrors: ValidationErrors = {};
    let isFormValid = true;

    Object.keys(rules).forEach(fieldName => {
      const value = values[fieldName] || '';
      const error = validateField(fieldName, value);
      
      if (error) {
        newErrors[fieldName] = error;
        isFormValid = false;
      }
    });

    setErrors(newErrors);
    return isFormValid;
  }, [rules, validateField]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const clearFieldError = useCallback((fieldName: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  const isValid = Object.keys(errors).length === 0;

  return {
    errors,
    isValid,
    validateField,
    validateForm,
    clearErrors,
    clearFieldError
  };
};