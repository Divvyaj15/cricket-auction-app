# Email Verification Setup

This document explains how to set up email verification with OTP for the Cricket Auction app.

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000
```

## Gmail Setup

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this password as `EMAIL_PASS` in your `.env` file

## Database Migration

Run the following SQL commands to add email verification support:

```sql
-- Add email_verified column to users table
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;

-- Create OTP table for email verification
CREATE TABLE email_otps (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used BOOLEAN DEFAULT FALSE
);

-- Create indexes for better performance
CREATE INDEX idx_email_otps_email ON email_otps(email);
CREATE INDEX idx_email_otps_expires_at ON email_otps(expires_at);
```

## Features Implemented

### Backend
- ✅ Email service with nodemailer
- ✅ OTP generation and storage
- ✅ Email verification endpoints
- ✅ Resend OTP functionality
- ✅ Login protection for unverified users

### Frontend
- ✅ OTP verification component
- ✅ Updated registration flow
- ✅ Updated login flow
- ✅ Resend OTP functionality
- ✅ Beautiful email templates

## API Endpoints

### New Endpoints
- `POST /api/auth/verify-otp` - Verify OTP code
- `POST /api/auth/resend-otp` - Resend OTP code

### Updated Endpoints
- `POST /api/auth/register` - Now sends OTP instead of immediate login
- `POST /api/auth/login` - Now checks for email verification

## Email Templates

The system includes beautiful HTML email templates for:
- OTP verification emails
- Welcome emails after successful verification

## Security Features

- OTP expires in 10 minutes
- OTP can only be used once
- Rate limiting on resend functionality
- Secure email templates with security tips

## Testing

1. Start the backend server: `npm run dev`
2. Start the frontend: `npm start`
3. Try registering a new user
4. Check your email for the OTP
5. Verify the OTP to complete registration

## Troubleshooting

### Email not sending
- Check your Gmail app password
- Ensure 2FA is enabled on Gmail
- Check the console for error messages

### OTP not working
- Check if OTP has expired (10 minutes)
- Ensure you're using the latest OTP sent
- Check database for OTP records

### Database errors
- Run the migration SQL commands
- Check database connection
- Verify table structure
