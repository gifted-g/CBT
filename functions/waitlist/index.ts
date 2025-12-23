import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { DatabaseService } from '../../shared/services/database.service';
import { EmailService } from '../../shared/services/email.service';
import {
  validateWaitlistSubmission,
  ValidationError,
  sanitizeString
} from '../../shared/utils/validation';
import { WaitlistRequest, WaitlistResponse } from '../../shared/models/types';

/**
 * Azure Function: Waitlist
 * Handles waitlist submissions from the landing page
 */
export async function waitlist(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('📝 Waitlist submission received');

  try {
    // Parse request body
    const body = (await request.json()) as unknown;

    // Type-safe email logging
    const emailForLog = typeof body === 'object' && body !== null && 'email' in body
      ? (body as Record<string, unknown>).email
      : 'unknown';
    context.log(`Waitlist signup from: ${emailForLog}`);

    // Validate input
    try {
      validateWaitlistSubmission(body);
    } catch (error) {
      if (error instanceof ValidationError) {
        context.warn(`❌ Validation failed: ${error.message}`);
        return {
          status: 400,
          jsonBody: {
            success: false,
            message: 'Validation failed',
            error: error.message
          } as WaitlistResponse
        };
      }
      throw error;
    }

    const requestData: WaitlistRequest = body as WaitlistRequest;

    // Initialize services
    const dbService = new DatabaseService();
    const emailService = new EmailService();

    // Check if email already exists in waitlist
    const existingSubmission: any = await dbService.getWaitlistSubmissionByEmail(
      requestData.email.toLowerCase().trim()
    );

    if (existingSubmission !== null && existingSubmission !== undefined) {
      context.log(`⚠️ Email already exists in waitlist: ${requestData.email}`);
      return {
        status: 200,
        jsonBody: {
          success: true,
          message: 'You are already on our waitlist! We will notify you when we launch.',
          data: {
            submissionId: existingSubmission.id,
            email: existingSubmission.email,
            position: existingSubmission.position
          }
        } as WaitlistResponse
      };
    }

    // Create submission in database
    const submission = await dbService.createWaitlistSubmission({
      email: requestData.email.toLowerCase().trim(),
      name: requestData.name ? sanitizeString(requestData.name, 100) : undefined,
      status: 'active',
      submittedAt: new Date().toISOString()
    }) as any;

    context.log(`✅ Waitlist submission saved to database: ${submission.id}`);

    // Send confirmation email (CRITICAL - user expects this)
    try {
      await emailService.sendWaitlistConfirmationEmail(submission);
      context.log('✅ Waitlist confirmation email sent successfully');
    } catch (error) {
      context.error(
        `❌ Failed to send waitlist confirmation email after retries: ${error}`
      );

      // If confirmation email fails, return error and suggest retry
      return {
        status: 500,
        jsonBody: {
          success: false,
          message:
            'You have been added to the waitlist, but we could not send the confirmation email. Please try again or contact us directly.',
          error: 'Failed to send confirmation email',
          data: {
            submissionId: submission.id,
            email: submission.email,
            position: submission.position
          }
        } as WaitlistResponse
      };
    }

    // Send admin notification (NON-CRITICAL - internal use only)
    try {
      await emailService.sendWaitlistNotificationEmail(submission);
      context.log('✅ Waitlist admin notification sent successfully');
    } catch (error) {
      context.warn(
        `⚠️ Failed to send waitlist admin notification (non-critical): ${error}`
      );
    }

    // Return success response
    return {
      status: 200,
      jsonBody: {
        success: true,
        message:
          'Welcome to the waitlist! You will be notified when AgentOja launches.',
        data: {
          submissionId: submission.id,
          email: submission.email,
          position: submission.position
        }
      } as WaitlistResponse
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    context.error('❌ Error processing waitlist submission:', errorMessage);

    // Use explicit flag for showing detailed errors instead of NODE_ENV
    const showDetailedErrors = process.env.SHOW_DETAILED_ERRORS === 'true';

    // Handle database connectivity/availability issues
    if (
      error instanceof Error &&
      error.message?.includes('Resource Not Found')
    ) {
      return {
        status: 503,
        jsonBody: {
          success: false,
          message:
            'We could not process your request right now. Please try again.',
          error: showDetailedErrors
            ? errorMessage
            : 'Service temporarily unavailable'
        } as WaitlistResponse
      };
    }

    // Generic error response
    return {
      status: 500,
      jsonBody: {
        success: false,
        message:
          'An error occurred while processing your waitlist signup. Please try again later.',
        error: showDetailedErrors ? errorMessage : 'Internal server error'
      } as WaitlistResponse
    };
  }
}

// Register the HTTP trigger function
app.http('waitlist', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'waitlist',
  handler: waitlist
});