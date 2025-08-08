# IPTV Backend API Documentation

## Base URL
```
http://localhost:8000/api/v1
```

## Authentication
Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## API Endpoints

### Health Check
- **GET** `/health`
- **Description**: Check if the API is running
- **Authentication**: Not required
- **Response**:
```json
{
  "success": true,
  "message": "IPTV Backend API is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

## User Management

### Authentication

#### Register User
- **POST** `/user/register`
- **Description**: Register a new user
- **Authentication**: Not required
- **Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "1234567890"
}
```

#### Login
- **POST** `/user/login`
- **Description**: Login with SID or email
- **Authentication**: Not required
- **Body**:
```json
{
  "identifier": "john@example.com", // or SID
  "password": "password123"
}
```

#### Email Login
- **POST** `/user/email-login`
- **Description**: Login with email only
- **Authentication**: Not required
- **Body**:
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

#### SID Login
- **POST** `/user/sid-login`
- **Description**: Login with SID only
- **Authentication**: Not required
- **Body**:
```json
{
  "sid": "100001",
  "password": "password123"
}
```

#### Google OAuth
- **POST** `/user/google-auth`
- **Description**: Login/Register with Google
- **Authentication**: Not required
- **Body**:
```json
{
  "googleId": "google_user_id",
  "name": "John Doe",
  "email": "john@example.com",
  "avatar": "https://example.com/avatar.jpg"
}
```

### User Profile

#### Get Profile
- **GET** `/user/profile`
- **Description**: Get current user profile
- **Authentication**: Required

#### Update Profile
- **PUT** `/user/profile`
- **Description**: Update user profile
- **Authentication**: Required
- **Body**:
```json
{
  "name": "John Doe",
  "phone": "1234567890",
  "avatar": "https://example.com/avatar.jpg"
}
```

#### Change Password
- **PUT** `/user/change-password`
- **Description**: Change user password
- **Authentication**: Required
- **Body**:
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

#### Logout
- **POST** `/user/logout`
- **Description**: Logout user
- **Authentication**: Required

### User Utilities

#### Check SID Availability
- **GET** `/user/check-sid/:sid`
- **Description**: Check if SID is available
- **Authentication**: Not required

### User Watch History

#### Get User Watch History
- **GET** `/user/watch-history`
- **Description**: Get user's watch history
- **Authentication**: Required
- **Query Parameters**:
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 20)
  - `channel_id` (optional): Filter by channel ID

#### Clear Watch History
- **DELETE** `/user/watch-history`
- **Description**: Clear user's watch history
- **Authentication**: Required

## Channel Management

### Public Routes

#### Get All Channels
- **GET** `/channel`
- **Description**: Get all active channels
- **Authentication**: Not required
- **Query Parameters**:
  - `category` (optional): Filter by category slug
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 20)
  - `quality` (optional): Filter by quality
  - `language` (optional): Filter by language
  - `premium_only` (optional): Filter premium channels (true/false)

#### Get Free Channels
- **GET** `/channel/free`
- **Description**: Get free channels only
- **Authentication**: Not required

#### Search Channels
- **GET** `/channel/search`
- **Description**: Search channels
- **Authentication**: Not required
- **Query Parameters**:
  - `q` (required): Search query (min 2 characters)
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 20)

### Protected Routes

#### Get Channels by Category
- **GET** `/channel/category/:categoryId`
- **Description**: Get channels by category
- **Authentication**: Required
- **Query Parameters**:
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 20)

#### Get Channel Details
- **GET** `/channel/:channelId`
- **Description**: Get single channel details
- **Authentication**: Required

#### Get Streaming URL
- **GET** `/channel/:channelId/stream`
- **Description**: Get secure streaming URL
- **Authentication**: Required

### Internal Routes

#### Verify Stream Token
- **GET** `/channel/:channelId/verify-token`
- **Description**: Verify streaming token (for proxy server)
- **Authentication**: Not required
- **Query Parameters**:
  - `token` (required): Stream token
  - `user_id` (required): User ID

### Admin Routes

#### Create Channel
- **POST** `/channel`
- **Description**: Create new channel
- **Authentication**: Required
- **Body**:
```json
{
  "name": "Channel Name",
  "description": "Channel description",
  "category_id": "category_id",
  "m3u8_url": "https://example.com/stream.m3u8",
  "thumbnail": "https://example.com/thumbnail.jpg",
  "logo": "https://example.com/logo.jpg",
  "is_premium": false,
  "quality": "HD",
  "language": "Bangla",
  "country": "Bangladesh",
  "sort_order": 1
}
```

#### Update Channel
- **PUT** `/channel/:channelId`
- **Description**: Update channel
- **Authentication**: Required
- **Body**: Same as create channel

#### Delete Channel
- **DELETE** `/channel/:channelId`
- **Description**: Delete channel
- **Authentication**: Required

#### Update Channel Status
- **PUT** `/channel/:channelId/status`
- **Description**: Update channel status
- **Authentication**: Required
- **Body**:
```json
{
  "status": "active" // active, inactive, maintenance
}
```

#### Update Online Status
- **PUT** `/channel/:channelId/online-status`
- **Description**: Update channel online status
- **Authentication**: Required
- **Body**:
```json
{
  "is_online": true
}
```

## Category Management

### Public Routes

#### Get All Categories
- **GET** `/category`
- **Description**: Get all active categories with channel counts

#### Get Category by ID
- **GET** `/category/:categoryId`
- **Description**: Get category with channels
- **Query Parameters**:
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 20)

#### Get Category by Slug
- **GET** `/category/slug/:slug`
- **Description**: Get category by slug
- **Query Parameters**:
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 20)

### Admin Routes

#### Create Category
- **POST** `/category`
- **Description**: Create new category
- **Authentication**: Required
- **Body**:
```json
{
  "name": "Category Name",
  "description": "Category description",
  "icon": "icon-class",
  "sort_order": 1
}
```

#### Update Category
- **PUT** `/category/:categoryId`
- **Description**: Update category
- **Authentication**: Required
- **Body**: Same as create category

#### Delete Category
- **DELETE** `/category/:categoryId`
- **Description**: Delete category
- **Authentication**: Required

#### Update Category Status
- **PUT** `/category/:categoryId/status`
- **Description**: Update category status
- **Authentication**: Required
- **Body**:
```json
{
  "status": "active" // active, inactive
}
```

## Subscription Management

### Protected Routes

#### Get User Subscription
- **GET** `/subscription/my-subscription`
- **Description**: Get current user's subscription
- **Authentication**: Required

#### Get Subscription Plans
- **GET** `/subscription/plans`
- **Description**: Get available subscription plans
- **Authentication**: Not required

#### Subscribe to Plan
- **POST** `/subscription/subscribe`
- **Description**: Subscribe to a plan
- **Authentication**: Required
- **Body**:
```json
{
  "plan_id": "basic_monthly",
  "payment_method": "bkash"
}
```

#### Cancel Subscription
- **POST** `/subscription/cancel`
- **Description**: Cancel current subscription
- **Authentication**: Required

#### Renew Subscription
- **POST** `/subscription/renew`
- **Description**: Renew current subscription
- **Authentication**: Required

### Admin Routes

#### Get All Subscriptions
- **GET** `/subscription/all`
- **Description**: Get all subscriptions
- **Authentication**: Required
- **Query Parameters**:
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 20)
  - `status` (optional): Filter by status
  - `subscription_type` (optional): Filter by type

#### Get Subscription by ID
- **GET** `/subscription/:subscriptionId`
- **Description**: Get subscription details
- **Authentication**: Required

#### Update Subscription
- **PUT** `/subscription/:subscriptionId`
- **Description**: Update subscription
- **Authentication**: Required

#### Delete Subscription
- **DELETE** `/subscription/:subscriptionId`
- **Description**: Delete subscription
- **Authentication**: Required

#### Update Subscription Status
- **PUT** `/subscription/:subscriptionId/status`
- **Description**: Update subscription status
- **Authentication**: Required
- **Body**:
```json
{
  "status": "active" // active, inactive, expired
}
```

#### Get Subscription Stats
- **GET** `/subscription/stats/overview`
- **Description**: Get subscription statistics
- **Authentication**: Required

## Payment Management

### Protected Routes

#### Create Payment
- **POST** `/payment/create`
- **Description**: Create new payment
- **Authentication**: Required
- **Body**:
```json
{
  "subscription_type": "basic",
  "subscription_duration": 30,
  "payment_method": "bkash",
  "amount": 199,
  "coupon_code": "DISCOUNT10"
}
```

#### Get User Payments
- **GET** `/payment/history`
- **Description**: Get user's payment history
- **Authentication**: Required
- **Query Parameters**:
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 20)
  - `status` (optional): Filter by status

#### Get Payment by ID
- **GET** `/payment/:paymentId`
- **Description**: Get payment details
- **Authentication**: Required

#### Update Payment Status
- **PUT** `/payment/:paymentId/status`
- **Description**: Update payment status
- **Authentication**: Required
- **Body**:
```json
{
  "payment_status": "completed",
  "bkash_transaction_id": "TXN123456",
  "gateway_response": {}
}
```

### Webhook Routes

#### Process Payment Webhook
- **POST** `/payment/webhook`
- **Description**: Process payment gateway webhook
- **Authentication**: Not required
- **Body**:
```json
{
  "transaction_id": "TXN123456",
  "payment_status": "completed",
  "bkash_transaction_id": "TXN123456",
  "amount": 199,
  "gateway_response": {}
}
```

### Admin Routes

#### Get All Payments
- **GET** `/payment/admin/all`
- **Description**: Get all payments
- **Authentication**: Required
- **Query Parameters**:
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 20)
  - `status` (optional): Filter by status
  - `payment_method` (optional): Filter by payment method
  - `start_date` (optional): Filter by start date
  - `end_date` (optional): Filter by end date

#### Get Payment Stats
- **GET** `/payment/admin/stats`
- **Description**: Get payment statistics
- **Authentication**: Required
- **Query Parameters**:
  - `start_date` (optional): Start date for stats
  - `end_date` (optional): End date for stats

## Watch History Management

### Protected Routes

#### Get User Watch History
- **GET** `/watch-history/my-history`
- **Description**: Get user's watch history
- **Authentication**: Required
- **Query Parameters**:
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 20)
  - `channel_id` (optional): Filter by channel ID

#### Add Watch History
- **POST** `/watch-history/add`
- **Description**: Add watch history entry
- **Authentication**: Required
- **Body**:
```json
{
  "channel_id": "channel_id",
  "watch_duration": 3600,
  "device_type": "mobile",
  "session_id": "session_123"
}
```

#### Update Watch Duration
- **PUT** `/watch-history/:historyId/duration`
- **Description**: Update watch duration
- **Authentication**: Required
- **Body**:
```json
{
  "additional_duration": 300
}
```

#### Clear Watch History
- **DELETE** `/watch-history/clear`
- **Description**: Clear user's watch history
- **Authentication**: Required

#### Remove Watch History Entry
- **DELETE** `/watch-history/:historyId`
- **Description**: Remove specific watch history entry
- **Authentication**: Required

#### Get User Watch Stats
- **GET** `/watch-history/stats/my-stats`
- **Description**: Get user's watch statistics
- **Authentication**: Required

### Admin Routes

#### Get All Watch History
- **GET** `/watch-history/admin/all`
- **Description**: Get all watch history
- **Authentication**: Required
- **Query Parameters**:
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 20)
  - `user_id` (optional): Filter by user ID
  - `channel_id` (optional): Filter by channel ID
  - `start_date` (optional): Filter by start date
  - `end_date` (optional): Filter by end date

#### Get Channel Analytics
- **GET** `/watch-history/admin/channel/:channelId/analytics`
- **Description**: Get channel analytics
- **Authentication**: Required
- **Query Parameters**:
  - `start_date` (optional): Start date for analytics
  - `end_date` (optional): End date for analytics

## Admin User Management

### Admin Routes

#### Get All Users
- **GET** `/user/admin/all`
- **Description**: Get all users
- **Authentication**: Required
- **Query Parameters**:
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 20)
  - `status` (optional): Filter by status
  - `search` (optional): Search by name, email, or SID

#### Get User by ID
- **GET** `/user/admin/:userId`
- **Description**: Get user details
- **Authentication**: Required

#### Update User
- **PUT** `/user/admin/:userId`
- **Description**: Update user
- **Authentication**: Required
- **Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "status": "active",
  "avatar": "https://example.com/avatar.jpg"
}
```

#### Delete User
- **DELETE** `/user/admin/:userId`
- **Description**: Delete user
- **Authentication**: Required

#### Get User Stats
- **GET** `/user/admin/:userId/stats`
- **Description**: Get user statistics
- **Authentication**: Required

#### Get User by SID
- **GET** `/user/admin/user/:sid`
- **Description**: Get user by SID
- **Authentication**: Required

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {},
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_records": 100,
    "per_page": 20
  }
}
```

## Error Responses

```json
{
  "success": false,
  "message": "Error message",
  "statusCode": 400
}
```

## Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `500`: Internal Server Error

## Environment Variables

```env
NODE_ENV=development
PORT=8000
MONGODB_URI=mongodb://localhost:27017/iptv
JWT_SECRET=your-jwt-secret
STREAMING_BASE_URL=http://localhost:8000
PAYMENT_GATEWAY_URL=https://payment.example.com
``` 