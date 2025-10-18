# Cricket Auction App - Deployment Guide

This guide provides comprehensive instructions for deploying your Cricket Auction App to various platforms.

## 🏗️ Architecture Overview

The application consists of:
- **Frontend**: React.js application (Port 80/3000)
- **Backend**: Node.js/Express API with Socket.io (Port 5000)
- **Database**: PostgreSQL (Port 5432)

## 📋 Prerequisites

### Required Software
- [Docker](https://www.docker.com/get-started) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)
- [Git](https://git-scm.com/downloads)

### Required Services
- PostgreSQL database (or use the included Docker setup)
- Email service (Gmail, SendGrid, etc.) for OTP verification

## 🚀 Quick Start (Local Development)

1. **Clone and Setup**
   ```bash
   cd cricket-auction-app
   cp cricket-auction-backend/.env.example .env
   ```

2. **Configure Environment**
   Edit `.env` file with your settings:
   ```env
   # Database
   PGPASSWORD=your_secure_password
   
   # JWT Secret
   JWT_SECRET=your_super_secret_jwt_key_here
   
   # Email Configuration
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   ```

3. **Deploy**
   ```bash
   # On Linux/Mac
   ./deploy.sh
   
   # On Windows
   deploy.bat
   ```

4. **Access Application**
   - Frontend: http://localhost
   - Backend API: http://localhost:5000
   - Health Check: http://localhost:5000/api/health

## 🌐 Production Deployment Options

### Option 1: VPS/Cloud Server (Recommended)

#### Using DigitalOcean, AWS EC2, or similar:

1. **Server Setup**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **Deploy Application**
   ```bash
   git clone <your-repo-url>
   cd cricket-auction-app
   cp cricket-auction-backend/.env.example .env
   # Edit .env with production values
   ./deploy.sh
   ```

3. **Configure Domain & SSL**
   ```bash
   # Install Nginx (if not using Docker)
   sudo apt install nginx certbot python3-certbot-nginx
   
   # Configure reverse proxy
   sudo nano /etc/nginx/sites-available/cricket-auction
   ```
   
   Nginx configuration:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:80;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
       
       location /api {
           proxy_pass http://localhost:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
       
       location /socket.io/ {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
       }
   }
   ```

4. **Enable SSL**
   ```bash
   sudo ln -s /etc/nginx/sites-available/cricket-auction /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   sudo certbot --nginx -d yourdomain.com
   ```

### Option 2: Railway

1. **Connect Repository**
   - Go to [Railway](https://railway.app)
   - Connect your GitHub repository
   - Add PostgreSQL service

2. **Configure Environment Variables**
   ```env
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   NODE_ENV=production
   CLIENT_ORIGIN=https://your-app.railway.app
   JWT_SECRET=your_jwt_secret
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   ```

3. **Deploy**
   - Railway will automatically build and deploy
   - Frontend will be served from the same domain

### Option 3: Heroku

1. **Install Heroku CLI**
   ```bash
   # Install Heroku CLI
   npm install -g heroku
   heroku login
   ```

2. **Create Heroku Apps**
   ```bash
   # Create backend app
   heroku create cricket-auction-backend
   
   # Create frontend app
   heroku create cricket-auction-frontend
   
   # Add PostgreSQL
   heroku addons:create heroku-postgresql:hobby-dev -a cricket-auction-backend
   ```

3. **Configure Environment**
   ```bash
   # Backend environment variables
   heroku config:set NODE_ENV=production -a cricket-auction-backend
   heroku config:set JWT_SECRET=your_jwt_secret -a cricket-auction-backend
   heroku config:set EMAIL_USER=your_email@gmail.com -a cricket-auction-backend
   heroku config:set EMAIL_PASS=your_app_password -a cricket-auction-backend
   
   # Frontend environment variables
   heroku config:set REACT_APP_API_URL=https://cricket-auction-backend.herokuapp.com/api -a cricket-auction-frontend
   heroku config:set REACT_APP_SOCKET_URL=https://cricket-auction-backend.herokuapp.com -a cricket-auction-frontend
   ```

4. **Deploy**
   ```bash
   # Deploy backend
   cd cricket-auction-backend
   git subtree push --prefix=cricket-auction-backend heroku main
   
   # Deploy frontend
   cd cricket-auction-frontend
   git subtree push --prefix=cricket-auction-frontend heroku main
   ```

### Option 4: Vercel + Railway

1. **Backend on Railway**
   - Deploy backend to Railway (as described above)

2. **Frontend on Vercel**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Deploy frontend
   cd cricket-auction-frontend
   vercel
   
   # Configure environment variables in Vercel dashboard
   REACT_APP_API_URL=https://your-backend.railway.app/api
   REACT_APP_SOCKET_URL=https://your-backend.railway.app
   ```

## 🔧 Environment Configuration

### Required Environment Variables

#### Backend (.env)
```env
# Database
DATABASE_URL=postgres://user:pass@host:5432/db
# OR
PGUSER=postgres
PGPASSWORD=your_password
PGHOST=localhost
PGPORT=5432
PGDATABASE=cricket_auction

# Server
PORT=5000
NODE_ENV=production
CLIENT_ORIGIN=https://your-frontend-domain.com

# Security
JWT_SECRET=your_super_secret_jwt_key_here

# Email (for OTP)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

#### Frontend (.env.production)
```env
REACT_APP_API_URL=https://your-backend-domain.com/api
REACT_APP_SOCKET_URL=https://your-backend-domain.com
```

## 📊 Database Setup

### Automatic Setup (Docker)
The Docker setup automatically creates the database and runs migrations.

### Manual Setup
```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d cricket_auction

# Run migrations
\i cricket-auction-backend/migrations/add_email_verification.sql
```

## 🔍 Monitoring & Maintenance

### Health Checks
- Backend: `GET /api/health`
- Database: Check Docker container status
- Frontend: Check if accessible

### Logs
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Backup Database
```bash
# Create backup
docker-compose exec postgres pg_dump -U postgres cricket_auction > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U postgres cricket_auction < backup.sql
```

### Update Application
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 🚨 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Find process using port
   lsof -i :5000
   # Kill process
   kill -9 <PID>
   ```

2. **Database Connection Failed**
   - Check if PostgreSQL is running
   - Verify connection string in .env
   - Check firewall settings

3. **CORS Errors**
   - Update CLIENT_ORIGIN in backend .env
   - Ensure frontend URL matches exactly

4. **Socket.io Connection Issues**
   - Check REACT_APP_SOCKET_URL in frontend
   - Verify WebSocket support on hosting platform

5. **Email Not Working**
   - Check EMAIL_USER and EMAIL_PASS
   - For Gmail, use App Password, not regular password
   - Verify email service settings

### Performance Optimization

1. **Enable Gzip Compression** (Already configured in nginx.conf)
2. **Use CDN** for static assets
3. **Database Indexing** for frequently queried fields
4. **Redis Caching** for session management (optional)

## 📞 Support

If you encounter issues:
1. Check the logs: `docker-compose logs -f`
2. Verify environment variables
3. Ensure all services are running: `docker-compose ps`
4. Check network connectivity between services

## 🔐 Security Considerations

1. **Use strong passwords** for database and JWT secret
2. **Enable HTTPS** in production
3. **Regular security updates** for dependencies
4. **Database backups** on regular schedule
5. **Monitor logs** for suspicious activity
6. **Rate limiting** (consider adding to backend)

---

**Happy Deploying! 🏏**
