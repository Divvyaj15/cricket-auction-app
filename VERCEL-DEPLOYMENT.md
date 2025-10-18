# 🚀 Vercel Deployment Guide for Cricket Auction App

This guide will help you deploy your Cricket Auction App using **Vercel** for the frontend and **Railway** for the backend.

## 📋 Prerequisites

- GitHub account
- Vercel account (free at [vercel.com](https://vercel.com))
- Railway account (free at [railway.app](https://railway.app))
- Your code pushed to GitHub

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │
│   (Vercel)      │◄──►│   (Railway)     │
│   React App     │    │   Node.js API   │
└─────────────────┘    └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   Vercel CDN    │    │   PostgreSQL    │
│   (Static Files)│    │   (Railway DB)  │
└─────────────────┘    └─────────────────┘
```

## 🎯 Step 1: Deploy Backend to Railway

### 1.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Connect your GitHub account

### 1.2 Deploy Backend
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository: `cricket-auction-app`
4. Select the `cricket-auction-backend` folder
5. Railway will automatically detect it's a Node.js app

### 1.3 Add PostgreSQL Database
1. In your Railway project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically create a PostgreSQL database
4. Copy the `DATABASE_URL` from the database service

### 1.4 Configure Environment Variables
In your Railway backend service, add these environment variables:

```env
# Database (Railway will provide this)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Server Configuration
NODE_ENV=production
PORT=5000

# CORS Configuration (we'll update this after frontend deployment)
CLIENT_ORIGIN=https://your-frontend-domain.vercel.app

# Security
JWT_SECRET=your_super_secret_jwt_key_here

# Email Configuration (for OTP verification)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### 1.5 Deploy Backend
1. Railway will automatically deploy when you push to GitHub
2. Wait for deployment to complete
3. Copy your backend URL (e.g., `https://cricket-auction-backend-production.railway.app`)

## 🎯 Step 2: Deploy Frontend to Vercel

### 2.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Connect your GitHub account

### 2.2 Deploy Frontend
1. Click "New Project"
2. Import your GitHub repository: `cricket-auction-app`
3. Set the **Root Directory** to `cricket-auction-frontend`
4. Vercel will automatically detect it's a React app

### 2.3 Configure Environment Variables
In your Vercel project settings, add these environment variables:

```env
# Backend API URL (from Railway)
REACT_APP_API_URL=https://your-backend-domain.railway.app/api
REACT_APP_SOCKET_URL=https://your-backend-domain.railway.app
```

### 2.4 Deploy Frontend
1. Click "Deploy"
2. Wait for deployment to complete
3. Copy your frontend URL (e.g., `https://cricket-auction-app.vercel.app`)

## 🔄 Step 3: Update CORS Configuration

### 3.1 Update Backend CORS
1. Go back to Railway
2. Update the `CLIENT_ORIGIN` environment variable:
   ```env
   CLIENT_ORIGIN=https://your-frontend-domain.vercel.app
   ```
3. Railway will automatically redeploy

## 🧪 Step 4: Test Your Application

### 4.1 Test Frontend
1. Visit your Vercel URL
2. Try to register a new account
3. Check if the frontend can connect to the backend

### 4.2 Test Backend
1. Visit `https://your-backend-domain.railway.app/api/health`
2. You should see a health check response

### 4.3 Test Full Flow
1. Register a new user
2. Create a tournament
3. Test the auction functionality

## 🔧 Configuration Files

### Frontend Configuration (vercel.json)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    }
  ],
  "routes": [
    {
      "src": "/static/(.*)",
      "headers": {
        "cache-control": "s-maxage=31536000,immutable"
      }
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### Backend Configuration (Railway)
Railway automatically detects Node.js apps and uses the `package.json` scripts.

## 📊 Monitoring & Maintenance

### Vercel Monitoring
- **Analytics**: Built-in performance analytics
- **Logs**: View deployment and runtime logs
- **Domains**: Custom domain management

### Railway Monitoring
- **Logs**: Real-time application logs
- **Metrics**: CPU, memory, and network usage
- **Database**: PostgreSQL monitoring

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure `CLIENT_ORIGIN` in Railway matches your Vercel domain exactly
   - Check that the frontend URL doesn't have trailing slashes

2. **Socket.io Connection Issues**
   - Verify `REACT_APP_SOCKET_URL` in Vercel matches your Railway backend URL
   - Check that WebSocket connections are allowed

3. **Database Connection Issues**
   - Verify `DATABASE_URL` is correctly set in Railway
   - Check Railway logs for database connection errors

4. **Build Failures**
   - Check Vercel build logs for specific errors
   - Ensure all dependencies are in `package.json`

### Debug Commands

```bash
# Check Railway logs
railway logs

# Check Vercel deployment status
vercel ls

# Test backend health
curl https://your-backend-domain.railway.app/api/health
```

## 💰 Cost Breakdown

### Vercel (Free Tier)
- ✅ Unlimited personal projects
- ✅ 100GB bandwidth per month
- ✅ Automatic HTTPS
- ✅ Global CDN

### Railway (Free Tier)
- ✅ $5 credit per month
- ✅ PostgreSQL database included
- ✅ Automatic deployments
- ✅ Custom domains

**Total Cost: $0/month** (within free tier limits)

## 🔄 Updates & Deployments

### Automatic Deployments
- **Frontend**: Automatically deploys when you push to GitHub
- **Backend**: Automatically deploys when you push to GitHub

### Manual Deployments
```bash
# Deploy frontend
vercel --prod

# Deploy backend (Railway auto-deploys)
git push origin main
```

## 🎉 You're Live!

Once deployed, your Cricket Auction App will be available at:
- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://your-backend.railway.app`
- **API Health**: `https://your-backend.railway.app/api/health`

## 📞 Support

If you encounter issues:
1. Check the logs in both Vercel and Railway dashboards
2. Verify environment variables are set correctly
3. Test the backend health endpoint
4. Check CORS configuration

---

**Happy Deploying! 🚀**
