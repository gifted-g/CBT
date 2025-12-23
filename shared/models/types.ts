/**
 * Shared TypeScript types for landing page
 * Single source of truth for contact form data models
 */

// ============================================
// CONTACT FORM TYPES (Landing Page)
// ============================================

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  message: string;
  status: 'new' | 'read' | 'replied';
  submittedAt: string;
  _partitionKey: string; // Email for Cosmos DB partitioning
}

export interface ContactRequest {
  name: string;
  email: string;
  message: string;
}

export interface ContactResponse {
  success: boolean;
  message: string;
  data?: {
    submissionId: string;
    email: string;
  };
  error?: string;
}

// ============================================
// WAITLIST TYPES
// ============================================

export interface WaitlistSubmission {
  id: string;
  email: string;
  name?: string;
  status: 'active' | 'notified' | 'converted';
  position: number;
  submittedAt: string;
  _partitionKey: string; // Email for Cosmos DB partitioning
}

export interface WaitlistRequest {
  email: string;
  name?: string;
}

export interface WaitlistResponse {
  success: boolean;
  message: string;
  data?: {
    submissionId: string;
    email: string;
    position: number;
  };
  error?: string;
}

// ============================================
// GENERIC API RESPONSE TYPE
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}
