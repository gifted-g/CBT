# AgentOja Backend - Azure Functions

A serverless backend built with Azure Functions and TypeScript for handling contact forms and waitlist signups for the AgentOja landing page.

## 🚀 Features

- **Contact Form API** - Handle contact form submissions with email notifications
- **Waitlist API** - Manage waitlist signups with position tracking
- **Admin Dashboard** - View and manage submissions
- **Email Service** - Automated confirmation and notification emails
- **Database Integration** - Azure Cosmos DB for data persistence
- **Input Validation** - Comprehensive validation and sanitization
- **Error Handling** - Robust error handling with retry logic
- **TypeScript** - Full type safety and modern development experience

## 📁 Project Structure

```
backend/
├── functions/
│   ├── contact-form/     # Contact form submission endpoint
│   ├── waitlist/         # Waitlist signup endpoint
│   └── admin/           # Admin dashboard endpoints
├── shared/
│   ├── models/          # TypeScript type definitions
│   ├── services/        # Business logic services
│   └── utils/           # Utility functions and validation
├── host.json           # Azure Functions host configuration
├── package.json        # Dependencies and scripts
└── tsconfig.json       # TypeScript configuration
```

## 🛠️ Setup & Installation

### Prerequisites

- Node.js 18+ and npm
- Azure Functions Core Tools v4
- Azure Cosmos DB account
- Azure Communication Services account

### Installation

1. **Clone and navigate to backend directory**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   cp local.settings.json.example local.settings.json
   ```

3. **Update configuration files with your Azure credentials**
   - `COSMOS_CONNECTION_STRING` - Your Cosmos DB connection string
   - `COMMUNICATION_SERVICES_CONNECTION_STRING` - Your Communication Services connection string
   - `SENDER_EMAIL` - Email address for sending notifications
   - `ADMIN_EMAIL` - Admin email for receiving notifications
   - `ADMIN_API_KEY` - Secure key for admin endpoints

4. **Build and start the development server**
   ```bash
   npm run dev
   ```

## 🔧 Available Scripts

- `npm run build` - Build TypeScript to JavaScript
- `npm run watch` - Watch for changes and rebuild
- `npm run start` - Start Azure Functions runtime
- `npm run start:dev` - Start with CORS enabled for development
- `npm run dev` - Watch + start in parallel (recommended for development)
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run clean` - Clean build directory

## 📡 API Endpoints

### Contact Form
- **POST** `/api/contact`
- Submit contact form with name, email, and message
- Sends confirmation email to user and notification to admin

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "message": "Hello, I'm interested in AgentOja..."
}
```

### Waitlist Signup
- **POST** `/api/waitlist`
- Add user to waitlist with optional name and required email
- Sends confirmation email with position number

**Request Body:**
```json
{
  "email": "john@example.com",
  "name": "John Doe" // optional
}
```

### Admin Dashboard
- **GET** `/api/admin?action=list&type=contact` - List all contact submissions
- **GET** `/api/admin?action=list&type=waitlist` - List all waitlist submissions
- **GET** `/api/admin?action=stats` - Get statistics for both contact and waitlist

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_API_KEY
```

## 🗄️ Database Schema

### Contact Submissions
```typescript
{
  id: string;                    // Unique identifier
  name: string;                  // Contact name
  email: string;                 // Contact email
  message: string;               // Contact message
  status: 'new' | 'read' | 'replied';
  submittedAt: string;           // ISO timestamp
  _partitionKey: string;         // Email for partitioning
}
```

### Waitlist Submissions
```typescript
{
  id: string;                    // Unique identifier
  email: string;                 // User email
  name?: string;                 // Optional user name
  status: 'active' | 'notified' | 'converted';
  position: number;              // Position in waitlist
  submittedAt: string;           // ISO timestamp
  _partitionKey: string;         // Email for partitioning
}
```

## 📧 Email Templates

The backend includes professional HTML and plain text email templates for:

- **Contact Confirmation** - Sent to users after contact form submission
- **Contact Notification** - Sent to admin for new contact submissions
- **Waitlist Confirmation** - Sent to users after joining waitlist
- **Waitlist Notification** - Sent to admin for new waitlist signups

## 🔒 Security Features

- Input validation and sanitization
- SQL injection prevention
- XSS protection in email templates
- Rate limiting ready (implement at Azure level)
- Admin API key authentication
- CORS configuration for frontend integration

## 🚀 Deployment

### Azure Deployment

1. **Create Azure resources:**
   - Azure Functions App
   - Azure Cosmos DB account
   - Azure Communication Services

2. **Deploy using Azure Functions Core Tools:**
   ```bash
   npm run build
   func azure functionapp publish YOUR_FUNCTION_APP_NAME
   ```

3. **Configure application settings in Azure portal:**
   - Add all environment variables from `local.settings.json`
   - Ensure connection strings are properly configured

### Environment Variables for Production

Set these in your Azure Function App configuration:

```
COSMOS_CONNECTION_STRING=AccountEndpoint=https://...
COMMUNICATION_SERVICES_CONNECTION_STRING=endpoint=https://...
SENDER_EMAIL=noreply@yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_API_KEY=your-secure-random-key
SHOW_DETAILED_ERRORS=false
```

## 🧪 Testing

Run the test suite:
```bash
npm test
```

For development with auto-reload:
```bash
npm run test:watch
```

## 📝 Development Notes

- The backend uses Azure Functions v4 with Node.js runtime
- TypeScript is configured for strict type checking
- ESLint is configured for code quality
- All database operations include proper error handling
- Email service includes retry logic with exponential backoff
- Input validation prevents common security vulnerabilities

## 🤝 Contributing

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation as needed
4. Ensure all linting passes before committing

## 📄 License

MIT License - see LICENSE file for details