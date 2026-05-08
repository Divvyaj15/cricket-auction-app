# 🏏 Cricket Auction App

A full-stack real-time cricket player auction application built with React, Node.js, Express, PostgreSQL, and Socket.io.

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Database Schema](#-database-schema)
- [Real-time Features](#-real-time-features)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### 🔐 Authentication & Security
- **Email Verification**: OTP-based account verification system
- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt encryption for user passwords
- **Protected Routes**: Role-based access control

### 🏆 Tournament Management
- **Create Tournaments**: Set budget, team limits, and tournament rules
- **Join Tournaments**: Use unique tournament codes to join
- **Team Formation**: Create and manage teams with different roles
- **Tournament Dashboard**: Overview of all tournaments and participation

### 👥 Team Management
- **Team Creation**: Form teams with unique team codes
- **Role-based Access**: Owner and member roles with different permissions
- **Team Budget**: Track and manage team spending
- **Squad Management**: View and manage team players

### 🎯 Player Management
- **Add Players**: Individual player addition with base prices
- **Bulk Import**: CSV upload for multiple players
- **Player Categories**: Different player roles (Batsman, Bowler, All-rounder, Wicket-keeper)
- **Player Statistics**: Track player performance and auction history

### ⚡ Real-time Auction System
- **Live Bidding**: Real-time bid updates using Socket.io
- **Auction Timer**: Countdown timer for bid finalization
- **Bid History**: Complete bidding history for each player
- **Auto-finalization**: Automatic auction closure with highest bid
- **Give-up System**: Teams can give up on specific players

### 📊 Analytics & Reports
- **Auction History**: Complete record of all auctions
- **Team Performance**: Track team spending and player acquisitions
- **Tournament Summary**: Final results and statistics
- **Budget Tracking**: Monitor remaining team budgets

## 🛠️ Tech Stack

### Backend
- **Node.js** - JavaScript runtime environment
- **Express.js** - Web application framework
- **PostgreSQL** - Relational database
- **Socket.io** - Real-time bidirectional communication
- **JWT** - JSON Web Tokens for authentication
- **bcrypt** - Password hashing library
- **Nodemailer** - Email service integration
- **Multer** - File upload handling
- **CORS** - Cross-origin resource sharing

### Frontend
- **React 19** - User interface library
- **React Router** - Client-side routing
- **Socket.io Client** - Real-time communication
- **Tailwind CSS** - Utility-first CSS framework
- **Context API** - State management
- **Axios** - HTTP client (via fetch API)

### Development Tools
- **Nodemon** - Development server auto-restart
- **PostCSS** - CSS processing
- **ESLint** - Code linting
- **Jest** - Testing framework

## 🏗️ Architecture

```
┌─────────────────┐    HTTP/REST    ┌─────────────────┐
│   React Frontend │ ◄─────────────► │  Express Backend │
│   (Port 3000)    │                 │   (Port 5000)    │
└─────────────────┘                 └─────────────────┘
         │                                   │
         │ Socket.io                         │
         │ Real-time                         │
         ▼                                   ▼
┌─────────────────┐                 ┌─────────────────┐
│ Socket.io Client│                 │ Socket.io Server│
└─────────────────┘                 └─────────────────┘
                                           │
                                           │ SQL Queries
                                           ▼
                                   ┌─────────────────┐
                                   │   PostgreSQL    │
                                   │    Database     │
                                   └─────────────────┘
```

## 🚀 Installation

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cricket-auction-app/cricket-auction-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Configure your `.env` file:
   ```env
   # Database Configuration
   DATABASE_URL=postgresql://username:password@localhost:5432/cricket_auction
   PGUSER=postgres
   PGHOST=localhost
   PGDATABASE=cricket_auction
   PGPASSWORD=your_password
   PGPORT=5432

   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key

   # Email Configuration
   EMAIL_SERVICE=gmail
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password

   # Server Configuration
   PORT=5000
   ```

4. **Set up the database**
   ```bash
   # Create database
   createdb cricket_auction
   
   # Run migrations
   psql -d cricket_auction -f migrations/add_email_verification.sql
   ```

5. **Start the backend server**
   ```bash
   npm run dev
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd ../cricket-auction-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## ⚙️ Configuration

### Database Configuration
The application uses PostgreSQL with the following key tables:
- `users` - User accounts and authentication
- `tournaments` - Tournament information
- `teams` - Team data and membership
- `players` - Player information and statistics
- `auction_rounds` - Individual auction sessions
- `bids` - Bidding history
- `purchases` - Final player acquisitions

### Email Configuration
Configure your email service in the backend `.env` file:
- **Gmail**: Use App Passwords for authentication
- **Other Services**: Update EMAIL_SERVICE accordingly

### Socket.io Configuration
Real-time features are configured in:
- Backend: `socket/auctionSocket.js`
- Frontend: `services/socket.js`

## 📖 Usage

### 1. User Registration
- Register with email and password
- Verify email using OTP sent to your inbox
- Complete profile setup

### 2. Tournament Creation
- Create a new tournament as a host
- Set tournament budget and team limits
- Generate unique tournament code for participants

### 3. Team Formation
- Join tournaments using tournament codes
- Create or join teams using team codes
- Assign roles (Owner/Member) to team members

### 4. Player Management
- Add players individually or via CSV upload
- Set base prices for each player
- Categorize players by role and skills

### 5. Auction Process
- Start auctions for individual players
- Place real-time bids during live auctions
- Monitor bid history and team budgets
- Finalize auctions with winning bids

### 6. Tournament Management
- Track team performance and spending
- View auction history and statistics
- Generate tournament summaries

## 📚 API Documentation

### Authentication Endpoints
```
POST /api/auth/register     - User registration
POST /api/auth/login        - User login
POST /api/auth/verify-otp   - Email verification
POST /api/auth/resend-otp   - Resend verification code
```

### Tournament Endpoints
```
POST /api/tournaments/create        - Create tournament
POST /api/tournaments/join          - Join tournament
GET  /api/tournaments/my-tournaments - Get hosted tournaments
GET  /api/tournaments/my-participations - Get participated tournaments
GET  /api/tournaments/:id           - Get tournament details
DELETE /api/tournaments/:id         - Delete tournament
```

### Team Endpoints
```
POST /api/teams/join                - Join team
GET  /api/teams/verify/:code        - Verify team code
GET  /api/teams/tournament/:id      - Get tournament teams
GET  /api/teams/my-teams/:id        - Get user's teams
GET  /api/teams/can-bid/:id         - Check bidding eligibility
```

### Player Endpoints
```
POST /api/players/add               - Add player
POST /api/players/upload-csv        - Bulk player import
DELETE /api/players/:id             - Delete player
GET  /api/players/tournament/:id    - Get tournament players
GET  /api/players/tournament/:id/stats - Get player statistics
```

### Auction Endpoints
```
POST /api/auction/start             - Start auction
POST /api/auction/bid               - Place bid
POST /api/auction/finalize          - Finalize auction
POST /api/auction/warn              - Send auction warning
GET  /api/auction/active/:id        - Get active auction
GET  /api/auction/bids/:id          - Get bid history
GET  /api/auction/purchases/team/:id - Get team purchases
```

## 🗄️ Database Schema

### Core Tables

#### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Tournaments Table
```sql
CREATE TABLE tournaments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    host_id INTEGER REFERENCES users(id),
    max_teams INTEGER NOT NULL,
    team_budget DECIMAL(10,2) NOT NULL,
    tournament_code VARCHAR(10) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Teams Table
```sql
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments(id),
    name VARCHAR(255) NOT NULL,
    team_code VARCHAR(10) UNIQUE NOT NULL,
    remaining_budget DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Players Table
```sql
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments(id),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT NOW()
);
```

## ⚡ Real-time Features

### Socket.io Events

#### Client to Server
- `join_tournament` - Join tournament room
- `leave_tournament` - Leave tournament room
- `place_bid` - Place a bid (optional real-time)

#### Server to Client
- `joined_tournament` - Confirmation of joining
- `bid_placed` - New bid notification
- `auction_started` - Auction begins
- `auction_finalized` - Auction ends
- `countdown` - Timer updates

### Real-time Updates
- **Live Bidding**: All participants see bids in real-time
- **Auction Status**: Current auction state and timer
- **Team Updates**: Budget and squad changes
- **Tournament Progress**: Overall tournament status

## 📁 Project Structure

```
cricket-auction-app/
├── cricket-auction-backend/
│   ├── middleware/
│   │   └── auth.js              # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js              # Authentication routes
│   │   ├── tournaments.js       # Tournament management
│   │   ├── teams.js             # Team management
│   │   ├── players.js           # Player management
│   │   └── auction.js           # Auction logic
│   ├── socket/
│   │   └── auctionSocket.js     # Socket.io event handlers
│   ├── utils/
│   │   └── emailService.js      # Email service integration
│   ├── migrations/
│   │   └── add_email_verification.sql
│   ├── uploads/                 # File upload directory
│   ├── server.js                # Main server file
│   └── package.json
│
└── cricket-auction-frontend/
    ├── src/
    │   ├── components/
    │   │   ├── PrivateRoute.js      # Route protection
    │   │   ├── OTPVerification.js   # Email verification
    │   │   └── BulkPlayerImport.js  # CSV upload
    │   ├── context/
    │   │   └── AuthContext.js       # Global auth state
    │   ├── pages/
    │   │   ├── Login.js             # Authentication
    │   │   ├── Dashboard.js         # Main dashboard
    │   │   ├── AuctionRoom.js       # Live auction interface
    │   │   ├── TournamentDetail.js  # Tournament management
    │   │   ├── TeamSquad.js         # Team management
    │   │   └── AuctionHistory.js    # Auction records
    │   ├── services/
    │   │   ├── api.js               # HTTP client
    │   │   └── socket.js            # Socket.io client
    │   ├── App.js                   # Main React component
    │   └── index.js                 # React entry point
    └── package.json
```

## 🔧 Development

### Running in Development Mode

1. **Backend Development**
   ```bash
   cd cricket-auction-backend
   npm run dev  # Uses nodemon for auto-restart
   ```

2. **Frontend Development**
   ```bash
   cd cricket-auction-frontend
   npm start    # Hot reload enabled
   ```

### Building for Production

1. **Backend Production**
   ```bash
   cd cricket-auction-backend
   npm start    # Production mode
   ```

2. **Frontend Production**
   ```bash
   cd cricket-auction-frontend
   npm run build    # Creates optimized build
   ```

### Testing

```bash
# Backend tests
cd cricket-auction-backend
npm test

# Frontend tests
cd cricket-auction-frontend
npm test
```

## 🚀 Deployment

### Backend Deployment
- Deploy to platforms like Heroku, DigitalOcean, or AWS
- Set up PostgreSQL database (Heroku Postgres, AWS RDS)
- Configure environment variables
- Set up email service (SendGrid, AWS SES)

### Frontend Deployment
- Deploy to Netlify, Vercel, or AWS S3
- Update API endpoints in production
- Configure build settings

### Environment Variables for Production
```env
NODE_ENV=production
DATABASE_URL=your_production_database_url
JWT_SECRET=your_production_jwt_secret
EMAIL_SERVICE=your_email_service
EMAIL_USER=your_production_email
EMAIL_PASS=your_production_email_password
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow ESLint configuration
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API endpoints

## 🎯 Future Enhancements

- [ ] Mobile app development
- [ ] Advanced analytics dashboard
- [ ] Player performance tracking
- [ ] Multi-language support
- [ ] Advanced auction types
- [ ] Integration with cricket APIs
- [ ] Real-time notifications
- [ ] Tournament brackets and playoffs

---

**Built with ❤️ for cricket enthusiasts**
