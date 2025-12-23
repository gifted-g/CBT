import { EmailClient, EmailMessage } from '@azure/communication-email';
import escapeHtml from 'escape-html';
import { ContactSubmission, WaitlistSubmission } from '../models/types';

/**
 * Email Service for Azure Communication Services
 * Handles sending confirmation and notification emails for contact form
 */
export class EmailService {
  // Add jitter (random variation ±25%). Jitter can be negative (reducing delay) or positive (increasing delay)
  // to intentionally prevent thundering herd problems where multiple retries happen simultaneously.
  sendWaitlistConfirmationEmail(submission: any) {
    throw new Error('Method not implemented.');
  }
  sendWaitlistNotificationEmail(submission: any) {
    throw new Error('Method not implemented.');
  }
  private client: EmailClient;
  private senderAddress: string;
  private adminEmail: string;

  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_DELAY_MS = 1000; // 1 second
  private readonly MAX_DELAY_MS = 30000; // 30 seconds
  private readonly BACKOFF_MULTIPLIER = 2;
  private readonly JITTER_PERCENTAGE = 0.25;

  constructor() {
    const connectionString = process.env.COMMUNICATION_SERVICES_CONNECTION_STRING;
    this.senderAddress = process.env.SENDER_EMAIL || 'noreply@agentoja.com';
    this.adminEmail = process.env.ADMIN_EMAIL || 'info@agentoja.com';

    if (!connectionString) {
      throw new Error('COMMUNICATION_SERVICES_CONNECTION_STRING environment variable is not set');
    }

    this.client = new EmailClient(connectionString);
  }

  /**
   * Utility method to pause execution for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format error for logging with full context
   * @param error - Error object to format
   * @returns Formatted error string with message and stack trace
   */
  private formatErrorForLogging(error: unknown): string {
    if (error instanceof Error) {
      return `${error.message}\nStack: ${error.stack || 'No stack trace'}`;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  /**
   * Retry helper with exponential backoff and jitter
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | unknown;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
        }
        return result;
      } catch (error) {
        lastError = error;

        // Don't retry on certain error types (e.g., validation errors)
        if (this.isNonRetryableError(error)) {
          console.error(
            `❌ ${operationName} failed with non-retryable error:\n${this.formatErrorForLogging(error)}`
          );
          throw error;
        }

        if (attempt < this.MAX_RETRIES) {
          // Calculate delay with exponential backoff
          const baseDelay = this.INITIAL_DELAY_MS * Math.pow(this.BACKOFF_MULTIPLIER, attempt);

          // Cap the delay at MAX_DELAY_MS
          const cappedDelay = Math.min(baseDelay, this.MAX_DELAY_MS);

          // Add jitter (random variation ±25%). Jitter can be negative (reducing delay) or positive (increasing delay)
          // to intentionally prevent thundering herd problems where multiple retries happen simultaneously.
          const jitter = cappedDelay * this.JITTER_PERCENTAGE * (Math.random() * 2 - 1);
          const delayMs = Math.round(cappedDelay + jitter);

          console.log(
            `🔄 ${operationName} failed (attempt ${attempt}/${this.MAX_RETRIES}). ` +
            `Retrying in ${delayMs}ms...`
          );
          console.error(`Error details:\n${this.formatErrorForLogging(error)}`);

          await this.sleep(delayMs);
        } else {
          console.error(
            `❌ ${operationName} failed after ${this.MAX_RETRIES} attempts:\n${this.formatErrorForLogging(error)}`
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: unknown): boolean {
    // Add logic to identify non-retryable errors
    // For example: 400 Bad Request, 401 Unauthorized, 403 Forbidden
    if (typeof error === 'object' && error !== null && 'statusCode' in error) {
      const nonRetryableStatusCodes = [400, 401, 403, 404];
      return nonRetryableStatusCodes.includes((error as { statusCode: number }).statusCode);
    }
    return false;
  }

  /**
   * Escape HTML special characters to prevent XSS in email templates
   * @param unsafe - Unsafe string that may contain HTML
   * @returns HTML-safe string
   */
  private escapeHtml(unsafe: string): string {
    return escapeHtml(unsafe);
  }

  /**
   * Convert status to uppercase in a type-safe manner
   * @param status - The submission status
   * @returns Uppercase status string
   */
  private getUppercaseStatus(status: string): string {
    const statusMap: Record<string, string> = {
      new: 'NEW',
      read: 'READ',
      replied: 'REPLIED'
    };
    return statusMap[status] || 'UNKNOWN';
  }

  /**
   * Send confirmation email to user after contact form submission
   */
  async sendContactConfirmationEmail(submission: ContactSubmission): Promise<void> {
    const emailMessage: EmailMessage = {
      senderAddress: this.senderAddress,
      recipients: {
        to: [{ address: submission.email }]
      },
      content: {
        subject: 'Thank You for Contacting AgentOja',
        plainText: this.getContactConfirmationTextContent(submission),
        html: this.getContactConfirmationHtmlContent(submission)
      }
    };

    try {
      await this.retryWithBackoff(
        async () => {
          const poller = await this.client.beginSend(emailMessage);
          await poller.pollUntilDone();
        },
        `Contact confirmation email to ${submission.email}`
      );
      console.log(`✅ Confirmation email sent to: ${submission.email}`);
    } catch (error) {
      console.error('❌ Failed to send contact confirmation email after all retries:', error);
      throw new Error(
        `Failed to send confirmation email: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Send notification email to admin about new contact submission
   */
  async sendContactNotificationEmail(submission: ContactSubmission): Promise<void> {
    const emailMessage: EmailMessage = {
      senderAddress: this.senderAddress,
      recipients: {
        to: [{ address: this.adminEmail }]
      },
      content: {
        subject: `New Contact Form Submission - ${submission.name}`,
        plainText: this.getContactNotificationTextContent(submission),
        html: this.getContactNotificationHtmlContent(submission)
      }
    };

    try {
      await this.retryWithBackoff(
        async () => {
          const poller = await this.client.beginSend(emailMessage);
          await poller.pollUntilDone();
        },
        `Contact notification email to ${this.adminEmail}`
      );
      console.log(`✅ Contact notification sent to: ${this.adminEmail}`);
    } catch (error) {
      console.error(
        '❌ Contact notification failed after all retries. Logging for further investigation.',
        error
      );
    }
  }

  /**
   * Generate plain text confirmation email content for contact
   */
  private getContactConfirmationTextContent(submission: ContactSubmission): string {
    return `
Dear ${submission.name},

Thank you for reaching out to AgentOja!

We have received your message and our team will get back to you within 24-48 hours.

Your Message:
-------------
${submission.message}

Submission Details:
------------------
Submission ID: ${submission.id}
Email: ${submission.email}
Submitted: ${new Date(submission.submittedAt).toLocaleString()}

If you have any urgent questions, feel free to reply to this email.

Best regards,
The AgentOja Team

---
This is an automated message.
For support, contact us at ${this.adminEmail}
    `.trim();
  }

  /**
   * Generate HTML confirmation email content for contact
   */
  private getContactConfirmationHtmlContent(submission: ContactSubmission): string {
    const name = this.escapeHtml(submission.name);
    const email = this.escapeHtml(submission.email);
    const message = this.escapeHtml(submission.message);
    const id = this.escapeHtml(submission.id);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .message-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">✉️ Thank You!</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">We've received your message</p>
    </div>
    
    <div class="content">
      <p>Dear <strong>${name}</strong>,</p>
      
      <p>Thank you for reaching out to AgentOja! We appreciate your interest.</p>
      
      <p>Our team has received your message and will get back to you within <strong>24-48 hours</strong>.</p>
      
      <div class="message-box">
        <h3 style="margin-top: 0; color: #667eea;">Your Message:</h3>
        <p style="white-space: pre-wrap;">${message}</p>
      </div>
      
      <p style="font-size: 14px; color: #666;">
        <strong>Submission ID:</strong> ${id}<br>
        <strong>Email:</strong> ${email}<br>
        <strong>Submitted:</strong> ${new Date(submission.submittedAt).toLocaleString()}
      </p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>The AgentOja Team</strong>
      </p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} AgentOja. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text admin notification content
   */
  private getContactNotificationTextContent(submission: ContactSubmission): string {
    return `
New Contact Form Submission
===========================

Someone has reached out through the AgentOja contact form.

Contact Details:
---------------
Name: ${submission.name}
Email: ${submission.email}

Message:
--------
${submission.message}

Submission Info:
---------------
Submission ID: ${submission.id}
Submitted At: ${new Date(submission.submittedAt).toLocaleString()}
Status: ${submission.status}

Action Required:
---------------
Please respond to this inquiry within 24-48 hours.
Reply directly to: ${submission.email}
    `.trim();
  }

  /**
   * Generate HTML admin notification content
   */
  private getContactNotificationHtmlContent(submission: ContactSubmission): string {
    const name = this.escapeHtml(submission.name);
    const email = this.escapeHtml(submission.email);
    const message = this.escapeHtml(submission.message);
    const id = this.escapeHtml(submission.id);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #667eea; color: white; padding: 20px; border-radius: 5px; }
    .content { background: #f8f9fa; padding: 20px; margin-top: 20px; border-radius: 5px; }
    .message-box { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; }
    .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">📧 New Contact Form Submission</h2>
    </div>
    
    <div class="content">
      <p>Someone has reached out through the AgentOja contact form.</p>
      
      <h3>Contact Details:</h3>
      <p>
        <strong>Name:</strong> ${name}<br>
        <strong>Email:</strong> <a href="mailto:${email}">${email}</a>
      </p>
      
      <div class="message-box">
        <h3 style="margin-top: 0;">Message:</h3>
        <p style="white-space: pre-wrap;">${message}</p>
      </div>
      
      <h3>Submission Info:</h3>
      <p>
        <strong>Submission ID:</strong> ${id}<br>
        <strong>Submitted At:</strong> ${new Date(submission.submittedAt).toLocaleString()}<br>
        <strong>Status:</strong> ${this.getUppercaseStatus(submission.status)}
      </p>
      
      <div class="alert">
        <strong>⏰ Action Required:</strong> Please respond to this inquiry within 24-48 hours.
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}
  /**
   * Send confirmation email to user after waitlist signup
   */
  async sendWaitlistConfirmationEmail(submission: WaitlistSubmission): Promise<void> {
    const emailMessage: EmailMessage = {
      senderAddress: this.senderAddress,
      recipients: {
        to: [{ address: submission.email }]
      },
      content: {
        subject: 'Welcome to the AgentOja Waitlist!',
        plainText: this.getWaitlistConfirmationTextContent(submission),
        html: this.getWaitlistConfirmationHtmlContent(submission)
      }
    };

    try {
      await this.retryWithBackoff(
        async () => {
          const poller = await this.client.beginSend(emailMessage);
          await poller.pollUntilDone();
        },
        `Waitlist confirmation email to ${submission.email}`
      );
      console.log(`✅ Waitlist confirmation email sent to: ${submission.email}`);
    } catch (error) {
      console.error('❌ Failed to send waitlist confirmation email after all retries:', error);
      throw new Error(
        `Failed to send waitlist confirmation email: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Send notification email to admin about new waitlist signup
   */
  async sendWaitlistNotificationEmail(submission: WaitlistSubmission): Promise<void> {
    const emailMessage: EmailMessage = {
      senderAddress: this.senderAddress,
      recipients: {
        to: [{ address: this.adminEmail }]
      },
      content: {
        subject: `New Waitlist Signup - Position #${submission.position}`,
        plainText: this.getWaitlistNotificationTextContent(submission),
        html: this.getWaitlistNotificationHtmlContent(submission)
      }
    };

    try {
      await this.retryWithBackoff(
        async () => {
          const poller = await this.client.beginSend(emailMessage);
          await poller.pollUntilDone();
        },
        `Waitlist notification email to ${this.adminEmail}`
      );
      console.log(`✅ Waitlist notification sent to: ${this.adminEmail}`);
    } catch (error) {
      console.error(
        '❌ Waitlist notification failed after all retries. Logging for further investigation.',
        error
      );
    }
  }

  /**
   * Generate plain text waitlist confirmation email content
   */
  private getWaitlistConfirmationTextContent(submission: WaitlistSubmission): string {
    const name = submission.name || 'there';
    
    return `
Hi ${name},

Welcome to the AgentOja waitlist!

You're now position #${submission.position} on our exclusive waitlist. We're excited to have you join us on this journey!

What happens next:
- You'll be among the first to know when AgentOja launches
- Get early access to our platform before the general public
- Receive exclusive updates and behind-the-scenes content
- Special launch benefits and pricing

Waitlist Details:
-----------------
Email: ${submission.email}
Position: #${submission.position}
Joined: ${new Date(submission.submittedAt).toLocaleString()}

Stay tuned for updates! We'll keep you posted on our progress.

Best regards,
The AgentOja Team

---
This is an automated message.
For support, contact us at ${this.adminEmail}
    `.trim();
  }

  /**
   * Generate HTML waitlist confirmation email content
   */
  private getWaitlistConfirmationHtmlContent(submission: WaitlistSubmission): string {
    const name = submission.name ? this.escapeHtml(submission.name) : 'there';
    const email = this.escapeHtml(submission.email);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .position-badge { background: #667eea; color: white; padding: 15px 25px; border-radius: 50px; font-size: 18px; font-weight: bold; text-align: center; margin: 20px 0; }
    .benefits { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .benefit-item { margin: 10px 0; padding-left: 20px; position: relative; }
    .benefit-item:before { content: "✓"; position: absolute; left: 0; color: #667eea; font-weight: bold; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🎉 Welcome to the Waitlist!</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">You're in! Get ready for something amazing.</p>
    </div>
    
    <div class="content">
      <p>Hi <strong>${name}</strong>,</p>
      
      <p>Welcome to the AgentOja waitlist! We're thrilled to have you join us on this exciting journey.</p>
      
      <div class="position-badge">
        You're position #${submission.position}
      </div>
      
      <div class="benefits">
        <h3 style="margin-top: 0; color: #667eea;">What happens next:</h3>
        <div class="benefit-item">First to know when AgentOja launches</div>
        <div class="benefit-item">Early access before the general public</div>
        <div class="benefit-item">Exclusive updates and behind-the-scenes content</div>
        <div class="benefit-item">Special launch benefits and pricing</div>
      </div>
      
      <p style="font-size: 14px; color: #666; margin-top: 30px;">
        <strong>Waitlist Details:</strong><br>
        Email: ${email}<br>
        Position: #${submission.position}<br>
        Joined: ${new Date(submission.submittedAt).toLocaleString()}
      </p>
      
      <p style="margin-top: 30px;">
        Stay tuned for updates! We'll keep you posted on our progress.
      </p>
      
      <p>
        Best regards,<br>
        <strong>The AgentOja Team</strong>
      </p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} AgentOja. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text waitlist admin notification content
   */
  private getWaitlistNotificationTextContent(submission: WaitlistSubmission): string {
    return `
New Waitlist Signup
===================

Someone new has joined the AgentOja waitlist!

Signup Details:
--------------
Email: ${submission.email}
Name: ${submission.name || 'Not provided'}
Position: #${submission.position}

Submission Info:
---------------
Submission ID: ${submission.id}
Submitted At: ${new Date(submission.submittedAt).toLocaleString()}
Status: ${submission.status}

Waitlist Stats:
--------------
This person is now position #${submission.position} on the waitlist.
    `.trim();
  }

  /**
   * Generate HTML waitlist admin notification content
   */
  private getWaitlistNotificationHtmlContent(submission: WaitlistSubmission): string {
    const email = this.escapeHtml(submission.email);
    const name = submission.name ? this.escapeHtml(submission.name) : 'Not provided';
    const id = this.escapeHtml(submission.id);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #667eea; color: white; padding: 20px; border-radius: 5px; }
    .content { background: #f8f9fa; padding: 20px; margin-top: 20px; border-radius: 5px; }
    .position-highlight { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .stats { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">🎯 New Waitlist Signup</h2>
    </div>
    
    <div class="content">
      <p>Someone new has joined the AgentOja waitlist!</p>
      
      <h3>Signup Details:</h3>
      <p>
        <strong>Email:</strong> <a href="mailto:${email}">${email}</a><br>
        <strong>Name:</strong> ${name}
      </p>
      
      <div class="position-highlight">
        <strong>🏆 Position: #${submission.position}</strong>
      </div>
      
      <h3>Submission Info:</h3>
      <p>
        <strong>Submission ID:</strong> ${id}<br>
        <strong>Submitted At:</strong> ${new Date(submission.submittedAt).toLocaleString()}<br>
        <strong>Status:</strong> ${this.getUppercaseStatus(submission.status)}
      </p>
      
      <div class="stats">
        <strong>📊 Waitlist Stats:</strong><br>
        This person is now position #${submission.position} on the waitlist.
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
  }