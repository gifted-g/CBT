import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { DatabaseService } from '../../shared/services/database.service';
import { EmailService } from '../../shared/services/email.service';
import {
  validateContactSubmission,
  ValidationError,
  sanitizeString
} from '../../shared/utils/validation';
import { ContactRequest, ContactResponse } from '../../shared/models/types';

/**
 * Azure Function: Contact Form
 * Handles contact form submissions from the landing page
 */
export async function contactForm(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('📝 Contact form submission received');

  try {
    // Parse request body
    const body = (await request.json()) as unknown;
    
    // Type-safe email logging
    const emailForLog = typeof body === 'object' && body !== null && 'email' in body 
      ? (body as Record<string, unknown>).email 
      : 'unknown';
    context.log(`Contact from: ${emailForLog}`);

    // Validate input
    try {
      validateContactSubmission(body);
    } catch (error) {
      if (error instanceof ValidationError) {
        context.warn(`❌ Validation failed: ${error.message}`);
        return {
          status: 400,
          jsonBody: {
            success: false,
            message: 'Validation failed',
            error: error.message
          } as ContactResponse
        };
      }
      throw error;
    }

    const requestData: ContactRequest = body as ContactRequest;

    // Initialize services
    const dbService = new DatabaseService();
    const emailService = new EmailService();

    // Create submission in database
    const submission = await dbService.createContactSubmission({
      name: sanitizeString(requestData.name, 100),
      email: requestData.email.toLowerCase().trim(),
      message: sanitizeString(requestData.message, 2000),
      status: 'new',
      submittedAt: new Date().toISOString()
    });

    context.log(`✅ Contact submission saved to database: ${submission.id}`);

    // Send confirmation email (CRITICAL - user expects this)
    try {
      await emailService.sendContactConfirmationEmail(submission);
      context.log('✅ Confirmation email sent successfully');
    } catch (error) {
      context.error(
        `❌ Failed to send confirmation email after retries: ${error}`
      );

      // If confirmation email fails, return error and suggest retry
      return {
        status: 500,
        jsonBody: {
          success: false,
          message:
            'Your message was saved, but we could not send the confirmation email. Please try again or contact us directly.',
          error: 'Failed to send confirmation email',
          data: {
            submissionId: submission.id,
            email: submission.email
          }
        } as ContactResponse
      };
    }

    // Send admin notification (NON-CRITICAL - internal use only)
    emailService
      .sendContactNotificationEmail(submission)
      .then(() => {
        context.log('✅ Admin notification sent successfully');
      })
      .catch((error) => {
        context.warn(
          `⚠️ Failed to send admin notification (non-critical): ${error}`
        );
      });

    // Return success response
    return {
      status: 200,
      jsonBody: {
        success: true,
        message:
          'Thank you for contacting us! We will get back to you within 24-48 hours.',
        data: {
          submissionId: submission.id,
          email: submission.email
        }
      } as ContactResponse
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    context.error('❌ Error processing contact form:', errorMessage);

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
        } as ContactResponse
      };
    }

    // Generic error response
    return {
      status: 500,
      jsonBody: {
        success: false,
        message:
          'An error occurred while processing your message. Please try again later.',
        error: showDetailedErrors ? errorMessage : 'Internal server error'
      } as ContactResponse
    };
  }
}

// Register the HTTP trigger function
app.http('contactForm', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'contact',
  handler: contactForm
});
