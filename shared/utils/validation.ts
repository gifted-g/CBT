import { ContactRequest, WaitlistRequest } from '../models/types';

/**
 * Validation utility for contact form submissions
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Simple email validation using regex
 * NOTE: Keep this regex in sync with frontend/assets/js/contact-form.js
 * @param email Email string to validate
 * @returns true if valid email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Validate contact form submission
 * @param data Contact form request
 * @throws ValidationError if validation fails
 */
export function validateContactSubmission(data: unknown): asserts data is ContactRequest {
  const errors: string[] = [];

  // Type guard to check if data is an object
  if (typeof data !== 'object' || data === null) {
    throw new ValidationError('Invalid request data');
  }

  const body = data as Record<string, unknown>;

  // Required fields
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    errors.push('Name is required');
  }

  if (body.name && typeof body.name === 'string' && body.name.length > 100) {
    errors.push('Name must be less than 100 characters');
  }

  if (!body.email || typeof body.email !== 'string' || !isValidEmail(body.email)) {
    errors.push('Valid email address is required');
  }

  if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
    errors.push('Message is required');
  }

  if (body.message && typeof body.message === 'string' && body.message.length > 2000) {
    errors.push('Message must be less than 2000 characters');
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join(', '));
  }
}

/**
 * Sanitize string input (trim and limit length)
 * @param input Input string
 * @param maxLength Maximum allowed length
 * @returns Sanitized string
 */
export function sanitizeString(input: string, maxLength: number = 500): string {
  return input.trim().substring(0, maxLength);
}

/**
 * Validate waitlist submission
 * @param data Waitlist request
 * @throws ValidationError if validation fails
 */
export function validateWaitlistSubmission(data: unknown): asserts data is WaitlistRequest {
  const errors: string[] = [];

  // Type guard to check if data is an object
  if (typeof data !== 'object' || data === null) {
    throw new ValidationError('Invalid request data');
  }

  const body = data as Record<string, unknown>;

  // Required fields
  if (!body.email || typeof body.email !== 'string' || !isValidEmail(body.email)) {
    errors.push('Valid email address is required');
  }

  // Optional name validation
  if (body.name && typeof body.name === 'string' && body.name.length > 100) {
    errors.push('Name must be less than 100 characters');
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join(', '));
  }
}