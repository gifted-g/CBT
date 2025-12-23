import { CosmosClient, Container } from '@azure/cosmos';
import { randomUUID } from 'node:crypto';
import { ContactSubmission, WaitlistSubmission } from '../models/types';

/**
 * Type guard to check if an error is a CosmosError with a status code
 * @param error The error to check
 * @returns True if the error is a CosmosError with a code property
 */
function isCosmosError(error: unknown): error is { code: number } {
  return typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: unknown }).code === 'number';
}

/**
 * Cosmos DB Service for Contact Submissions and Waitlist
 * Handles all database operations for landing page forms
 */
export class DatabaseService {
  private client: CosmosClient;
  private databaseName: string;

  constructor() {
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    
    if (!connectionString) {
      throw new Error('COSMOS_CONNECTION_STRING environment variable is not set');
    }

    this.client = new CosmosClient(connectionString);
    this.databaseName = 'AgentOjaDB';
  }

  /**
   * Get the Cosmos DB container
   */
  private getContainer(containerName: string): Container {
    return this.client
      .database(this.databaseName)
      .container(containerName);
  }

  /**
   * Create a new contact submission in Cosmos DB
   * @param submission Contact submission data
   * @returns Created submission with ID
   */
  async createContactSubmission(
    submission: Omit<ContactSubmission, 'id' | '_partitionKey'>
  ): Promise<ContactSubmission> {
    const container = this.getContainer('ContactSubmissions');

    // Generate unique ID
    const id = `contact-${randomUUID()}`;
    
    const submissionData: ContactSubmission = {
      ...submission,
      id,
      _partitionKey: submission.email // Partition by email
    };

    try {
      const { resource } = await container.items.create(submissionData);
      
      if (!resource) {
        throw new Error('Failed to create contact submission in database');
      }

      return resource as ContactSubmission;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error creating contact submission:', error.message);
      } else {
        console.error('Unknown error occurred while creating contact submission');
      }
      throw error;
    }
  }

  /**
   * Get a contact submission by ID
   * @param id Submission ID
   * @param email Email (partition key)
   * @returns Contact submission or null
   */
  async getContactSubmission(
    id: string,
    email: string
  ): Promise<ContactSubmission | null> {
    const container = this.getContainer('ContactSubmissions');

    try {
      const { resource } = await container.item(id, email).read<ContactSubmission>();
      return resource || null;
    } catch (error: unknown) {
      if (isCosmosError(error) && error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all contact submissions (for admin use)
   * @param status Optional status filter
   * @param limit Maximum number of results
   * @returns Array of contact submissions
   */
  async getAllContactSubmissions(
    status?: 'new' | 'read' | 'replied',
    limit: number = 100
  ): Promise<ContactSubmission[]> {
    const container = this.getContainer('ContactSubmissions');

    try {
      let query = 'SELECT * FROM c ORDER BY c.submittedAt DESC';
      const parameters: Array<{ name: string; value: string }> = [];

      if (status) {
        query = 'SELECT * FROM c WHERE c.status = @status ORDER BY c.submittedAt DESC';
        parameters.push({ name: '@status', value: status });
      }

      const querySpec = {
        query,
        parameters
      };

      const { resources } = await container.items
        .query(querySpec, { maxItemCount: limit })
        .fetchAll();

      return resources as ContactSubmission[];
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error fetching contact submissions:', error.message);
      } else {
        console.error('Unknown error occurred while fetching contact submissions');
      }
      throw error;
    }
  }

  /**
   * Create a new waitlist submission in Cosmos DB
   * @param submission Waitlist submission data
   * @returns Created submission with ID and position
   */
  async createWaitlistSubmission(
    submission: Omit<WaitlistSubmission, 'id' | '_partitionKey' | 'position'>
  ): Promise<WaitlistSubmission> {
    const container = this.getContainer('WaitlistSubmissions');

    // Generate unique ID
    const id = `waitlist-${randomUUID()}`;
    
    // Get current waitlist count to determine position
    const position = await this.getWaitlistCount() + 1;
    
    const submissionData: WaitlistSubmission = {
      ...submission,
      id,
      position,
      _partitionKey: submission.email // Partition by email
    };

    try {
      const { resource } = await container.items.create(submissionData);
      
      if (!resource) {
        throw new Error('Failed to create waitlist submission in database');
      }

      return resource as WaitlistSubmission;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error creating waitlist submission:', error.message);
      } else {
        console.error('Unknown error occurred while creating waitlist submission');
      }
      throw error;
    }
  }

  /**
   * Get a waitlist submission by email
   * @param email Email address
   * @returns Waitlist submission or null
   */
  async getWaitlistSubmissionByEmail(
    email: string
  ): Promise<WaitlistSubmission | null> {
    const container = this.getContainer('WaitlistSubmissions');

    try {
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.email = @email',
        parameters: [{ name: '@email', value: email }]
      };

      const { resources } = await container.items
        .query(querySpec, { maxItemCount: 1 })
        .fetchAll();

      return resources.length > 0 ? (resources[0] as WaitlistSubmission) : null;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error fetching waitlist submission by email:', error.message);
      } else {
        console.error('Unknown error occurred while fetching waitlist submission');
      }
      throw error;
    }
  }

  /**
   * Get waitlist count for position calculation
   * @returns Current number of active waitlist submissions
   */
  async getWaitlistCount(): Promise<number> {
    const container = this.getContainer('WaitlistSubmissions');

    try {
      const querySpec = {
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.status = @status',
        parameters: [{ name: '@status', value: 'active' }]
      };

      const { resources } = await container.items
        .query(querySpec)
        .fetchAll();

      return resources.length > 0 ? resources[0] : 0;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error getting waitlist count:', error.message);
      } else {
        console.error('Unknown error occurred while getting waitlist count');
      }
      throw error;
    }
  }

  /**
   * Get all waitlist submissions (for admin use)
   * @param status Optional status filter
   * @param limit Maximum number of results
   * @returns Array of waitlist submissions
   */
  async getAllWaitlistSubmissions(
    status?: 'active' | 'notified' | 'converted',
    limit: number = 100
  ): Promise<WaitlistSubmission[]> {
    const container = this.getContainer('WaitlistSubmissions');

    try {
      let query = 'SELECT * FROM c ORDER BY c.position ASC';
      const parameters: Array<{ name: string; value: string }> = [];

      if (status) {
        query = 'SELECT * FROM c WHERE c.status = @status ORDER BY c.position ASC';
        parameters.push({ name: '@status', value: status });
      }

      const querySpec = {
        query,
        parameters
      };

      const { resources } = await container.items
        .query(querySpec, { maxItemCount: limit })
        .fetchAll();

      return resources as WaitlistSubmission[];
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error fetching waitlist submissions:', error.message);
      } else {
        console.error('Unknown error occurred while fetching waitlist submissions');
      }
      throw error;
    }
  }
}