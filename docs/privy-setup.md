# Privy Configuration Guide

This guide walks you through setting up Privy for authentication and embedded wallet functionality in the MoonEx application.

## Prerequisites

- A Privy account (sign up at [https://privy.io](https://privy.io))
- Node.js 18+ installed
- Basic understanding of environment variables

## Step 1: Create a Privy Application

1. Log in to your Privy dashboard
2. Navigate to "Applications" and click "Create Application"
3. Fill in the application details:
   - **Application Name**: MoonEx
   - **Description**: Decentralized exchange with Privy authentication
   - **Environment**: Select "Development" for initial setup
4. Click "Create Application"

## Step 2: Configure Authentication Methods

1. In your application dashboard, go to "Authentication"
2. Enable the following authentication methods:
   - **Email**: Enable email-based authentication
   - **Social**: Enable Google, Twitter, Discord as needed
   - **Wallet**: Enable wallet-based authentication
3. Configure each provider with your API keys if required

## Step 3: Configure Wallet Settings

1. Navigate to "Wallets" in your application dashboard
2. Enable "Embedded Wallets"
3. Configure the following settings:
   - **Supported Chains**: Ethereum Mainnet, Polygon, Arbitrum
   - **Default Chain**: Ethereum Mainnet
   - **Gas Sponsorship**: Enable if you want to sponsor user transactions
4. Save your configuration

## Step 4: Get API Credentials

1. Navigate to "API Keys" in your application dashboard
2. Copy the following credentials:
   - **App ID**: Your unique application identifier
   - **App Secret**: Your secret key for server-side authentication
3. Keep these credentials secure and never expose them in client-side code

## Step 5: Configure Environment Variables

Create a `.env` file in your project root with the following variables:

```env
# Privy Configuration
PRIVY_APP_ID=your_app_id_here
PRIVY_APP_SECRET=your_app_secret_here

# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Database Configuration (if applicable)
DATABASE_URL=your_database_url_here
```

## Step 6: Install Dependencies

Install the required Privy packages:

```bash
npm install @privy-io/server-auth @privy-io/react-auth
# or
yarn add @privy-io/server-auth @privy-io/react-auth
# or
pnpm add @privy-io/server-auth @privy-io/react-auth
```

## Step 7: Server-Side Configuration

The server-side configuration is already implemented in the MoonEx application. Here's how it works:

### 1. Initialize Privy Client

```typescript
// src/config/index.ts
import { PrivyClient } from "@privy-io/server-auth";

export const privyClient = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);
```

### 2. Authentication Service

The authentication service (`src/services/auth.ts`) handles:

- User authentication with Privy
- Token generation and validation
- Session management

### 3. Wallet Service

The wallet service (`src/services/wallet.ts`) handles:

- Embedded wallet creation
- Balance retrieval
- Transaction signing and sending
- Gas fee estimation

## Step 8: Client-Side Integration (Frontend)

For frontend integration, you'll need to:

1. Install the React SDK:

```bash
npm install @privy-io/react-auth
```

2. Wrap your app with the PrivyProvider:

```tsx
import { PrivyProvider } from "@privy-io/react-auth";

function App() {
  return (
    <PrivyProvider appId={process.env.REACT_APP_PRIVY_APP_ID!}>
      {/* Your app components */}
    </PrivyProvider>
  );
}
```

3. Use the authentication hooks:

```tsx
import { usePrivy } from "@privy-io/react-auth";

function LoginButton() {
  const { login, authenticated } = usePrivy();

  return (
    <button onClick={() => login()}>
      {authenticated ? "Connected" : "Login"}
    </button>
  );
}
```

## Step 9: Testing Your Configuration

1. Start your development server:

```bash
npm run dev
```

2. Test the authentication endpoints:

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test login endpoint
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

3. Test wallet creation (after authentication):

```bash
curl -X POST http://localhost:3000/wallets/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Step 10: Production Configuration

For production deployment:

1. Create a production application in Privy dashboard
2. Update your environment variables with production credentials
3. Configure proper CORS settings in your Privy application
4. Enable additional security features:
   - Rate limiting
   - IP whitelisting
   - Advanced fraud detection

## Troubleshooting

### Common Issues

1. **Authentication Fails**

   - Check that your PRIVY_APP_ID and PRIVY_APP_SECRET are correct
   - Ensure your environment variables are properly loaded
   - Verify your application is configured correctly in Privy dashboard

2. **Wallet Creation Fails**

   - Ensure embedded wallets are enabled in your Privy application
   - Check that the user is properly authenticated
   - Verify the supported chains are configured correctly

3. **CORS Errors**
   - Add your frontend domain to the CORS settings in Privy dashboard
   - Ensure your server CORS configuration allows your frontend domain

### Debug Mode

Enable debug mode by setting:

```env
DEBUG=privy:*
```

This will provide detailed logs for troubleshooting Privy-related issues.

## Security Best Practices

1. **Never expose secrets**: Keep your PRIVY_APP_SECRET and JWT_SECRET secure
2. **Use HTTPS**: Always use HTTPS in production
3. **Validate inputs**: Always validate user inputs on the server side
4. **Monitor usage**: Set up monitoring for authentication and wallet operations
5. **Regular updates**: Keep Privy SDKs updated to the latest versions

## Support

For additional support:

- Privy Documentation: [https://docs.privy.io](https://docs.privy.io)
- Privy Support: support@privy.io
- MoonEx Documentation: [https://docs.moonex.com](https://docs.moonex.com)
