import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { DatabaseService } from '../../shared/services/database.service';
import { ApiResponse } from '../../shared/models/types';

/**
 * Azure Function: Admin Dashboard
 * Provides admin endpoints for managing contact and waitlist submissions
 */
export async function adminDashboard(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('📊 Admin dashboard request received');

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const type = url.searchParams.get('type'); // 'contact' or 'waitlist'

    // Basic authentication check (in production, use proper auth)
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY;
    
    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return {
        status: 401,
        jsonBody: {
          success: false,
          message: 'Unauthorized access',
          error: 'Invalid or missing authorization'
        } as ApiResponse
      };
    }

    const dbService = new DatabaseService();

    switch (action) {
      case 'list':
        if (type === 'contact') {
          const contacts = await dbService.getAllContactSubmissions();
          return {
            status: 200,
            jsonBody: {
              success: true,
              message: 'Contact submissions retrieved successfully',
              data: contacts
            } as ApiResponse
          };
        } else if (type === 'waitlist') {
          const waitlist = await dbService.getAllWaitlistSubmissions();
          return {
            status: 200,
            jsonBody: {
              success: true,
              message: 'Waitlist submissions retrieved successfully',
              data: waitlist
            } as ApiResponse
          };
        } else {
          return {
            status: 400,
            jsonBody: {
              success: false,
              message: 'Invalid type parameter. Use "contact" or "waitlist"',
              error: 'Bad request'
            } as ApiResponse
          };
        }

      case 'stats':
        const contactCount = (await dbService.getAllContactSubmissions()).length;
        const waitlistCount = await dbService.getWaitlistCount();
        
        return {
          status: 200,
          jsonBody: {
            success: true,
            message: 'Statistics retrieved successfully',
            data: {
              contacts: {
                total: contactCount,
                new: (await dbService.getAllContactSubmissions('new')).length,
                read: (await dbService.getAllContactSubmissions('read')).length,
                replied: (await dbService.getAllContactSubmissions('replied')).length
              },
              waitlist: {
                total: waitlistCount,
                active: (await dbService.getAllWaitlistSubmissions('active')).length,
                notified: (await dbService.getAllWaitlistSubmissions('notified')).length,
                converted: (await dbService.getAllWaitlistSubmissions('converted')).length
              }
            }
          } as ApiResponse
        };

      default:
        return {
          status: 400,
          jsonBody: {
            success: false,
            message: 'Invalid action parameter. Use "list" or "stats"',
            error: 'Bad request'
          } as ApiResponse
        };
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    context.error('❌ Error in admin dashboard:', errorMessage);

    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Internal server error',
        error: errorMessage
      } as ApiResponse
    };
  }
}

// Register the HTTP trigger function
app.http('adminDashboard', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'admin',
  handler: adminDashboard
});