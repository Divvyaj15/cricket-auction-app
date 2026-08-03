# 🏏 Cricket Auction App

A full-stack **real-time cricket player auction** platform — host IPL-style auctions for friend circles, college fests, and local leagues. Create tournaments, invite teams, bid live on players, track purses, and review full auction history.

**Frontend:** React · Tailwind CSS · Socket.io Client  
**Backend:** Node.js · Express · PostgreSQL · Socket.io · JWT

---

## 🖼️ Website preview

### Landing page
Marketing home with auction-room atmosphere, live bid mockup, and clear CTAs to sign up or log in.

![Landing page](docs/screenshots/landing.png)

### Login & register
Secure email/password auth with OTP email verification.

| Login | Register |
|:-----:|:--------:|
| ![Login](docs/screenshots/login.png) | ![Register](docs/screenshots/register.png) |

### Dashboard
Host tournaments, join with a code, and manage your leagues from one place.

![Dashboard](docs/screenshots/dashboard.jpg)

### Live auction room
Real-time bidding board with timers, team purses, and player-on-the-block UI.

![Live auction](docs/screenshots/auction-live.jpg)

### Auction room ambience
Dark stadium-style auction hall used as the landing backdrop.

![Auction room background](docs/screenshots/auction-room-bg.jpg)

---

## ✨ Features

### Authentication
- JWT-based login sessions  
- OTP email verification on register  
- Protected routes for authenticated users  

### Tournaments & teams
- Create tournaments with budget, max teams, and team names  
- Join via unique tournament codes  
- Team roles (owner / member) and squad views  

### Players
- Add players with base price and role (BAT / BOWL / AR / WK)  
- Bulk CSV import  

### Live auction
- Real-time bids over **Socket.io**  
- Countdown timer & auto-finalization  
- Bid history, give-up flow, and capacity controls  
- Team purse tracking as the auction runs  

### Reports
- Auction history  
- Tournament summary  
- Per-team squad after purchases  

---

## 🏗️ Architecture

```
┌──────────────────┐     HTTP / REST      ┌──────────────────┐
│  React Frontend  │ ◄──────────────────► │  Express Backend │
│  :3000           │                      │  :5000           │
└────────┬─────────┘                      └────────┬─────────┘
         │ Socket.io                               │
         ▼                                         ▼
  Real-time bids / room                  PostgreSQL database
```

| Layer | Stack |
|-------|--------|
| UI | React 19, React Router, Tailwind CSS, Context API |
| API | Express, JWT, bcrypt, Multer, Nodemailer / Resend |
| Realtime | Socket.io |
| DB | PostgreSQL |

---

## 📁 Project structure

```
cricket-auction-app/
├── cricket-auction-frontend/     # React app
│   ├── public/images/           # Landing background assets
│   └── src/
│       ├── pages/               # Home, Login, Dashboard, AuctionRoom, …
│       ├── components/          # PrivateRoute, OTP, Bulk import
│       ├── context/             # AuthContext
│       └── services/            # API + Socket client
├── cricket-auction-backend/     # Express API + sockets
│   ├── routes/                  # auth, tournaments, teams, players, auction
│   ├── middleware/              # JWT auth
│   ├── socket/                  # Auction socket handlers
│   └── migrations/
├── docs/screenshots/            # README preview images
└── README.md
```

---

## 🚀 Getting started

### Prerequisites
- **Node.js** v16+  
- **PostgreSQL** v12+  
- npm (or yarn)

### 1. Clone

```bash
git clone https://github.com/<your-username>/cricket-auction-app.git
cd cricket-auction-app
```

### 2. Backend

```bash
cd cricket-auction-backend
npm install
```

Create a `.env` file (see also `cricket-auction-backend/README_ENV.md`):

```env
# Database (use DATABASE_URL or discrete PG* vars)
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/cricket_auction
# PGUSER=postgres
# PGPASSWORD=your_password
# PGHOST=localhost
# PGPORT=5432
# PGDATABASE=cricket_auction

JWT_SECRET=your_super_secret_jwt_key
PORT=5000
CLIENT_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# Email (OTP verification)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

Create the database and run migrations:

```bash
createdb cricket_auction
psql -d cricket_auction -f migrations/add_email_verification.sql
```

Start the API:

```bash
npm run dev
# → http://localhost:5000
```

### 3. Frontend

```bash
cd ../cricket-auction-frontend
npm install
npm start
# → http://localhost:3000
```

Optional frontend env:

```env
REACT_APP_BACKEND_URL=http://localhost:5000
```

---

## 📖 Typical flow

1. **Land on home** (`/`) — product intro and auction visuals  
2. **Register / Login** — verify email with OTP if required  
3. **Dashboard** — create a tournament or join with a code  
4. **Tournament detail** — add players (or CSV), form teams  
5. **Auction room** — host starts the auction; teams bid in real time  
6. **History / summary** — review sold players and final squads  

---

## 🔌 API overview

| Area | Base path | Notes |
|------|-----------|--------|
| Auth | `/api/auth` | register, login, verify-otp, resend-otp |
| Tournaments | `/api/tournaments` | create, join, list, detail |
| Teams | `/api/teams` | create / join teams |
| Players | `/api/players` | add, CSV upload, list by tournament |
| Auction | `/api/auction` | start, bid, finalize, give-up, end, history |

Protected routes expect:

```http
Authorization: Bearer <jwt>
```

---

## ⚡ Real-time events

Socket connections authenticate with the same JWT. Typical events include auction start, new bids, timer ticks, player sold, and auction end (see `cricket-auction-backend/socket/auctionSocket.js` and `cricket-auction-frontend/src/services/socket.js`).

---

## 📚 More docs

| Doc | Description |
|-----|-------------|
| [Cricket-Auction-App-README.md](./Cricket-Auction-App-README.md) | Full feature & API notes |
| [Cricket-Auction-Tech-Stack-README.md](./Cricket-Auction-Tech-Stack-README.md) | Architecture & file-by-file flow |
| [cricket-auction-backend/README_ENV.md](./cricket-auction-backend/README_ENV.md) | Database env setup |
| [cricket-auction-backend/EMAIL_SETUP.md](./cricket-auction-backend/EMAIL_SETUP.md) | Email / OTP configuration |

---

## 🛠️ Scripts

**Backend** (`cricket-auction-backend`)

| Command | Description |
|---------|-------------|
| `npm start` | Run API |
| `npm run dev` | Run with nodemon |

**Frontend** (`cricket-auction-frontend`)

| Command | Description |
|---------|-------------|
| `npm start` | Dev server (:3000) |
| `npm run build` | Production build |
| `npm test` | Jest tests |

---

## 🤝 Contributing

1. Fork the repo  
2. Create a feature branch (`git checkout -b feature/amazing-idea`)  
3. Commit and push  
4. Open a Pull Request  

---

## 📄 License

This project is available for learning and personal use. Add a `LICENSE` file if you want to publish under a specific open-source license.

---

<p align="center">
  <b>Cricket Auction</b> — host live player auctions for your cricket tournaments.
  <br />
  Built with React, Express, PostgreSQL & Socket.io
</p>
