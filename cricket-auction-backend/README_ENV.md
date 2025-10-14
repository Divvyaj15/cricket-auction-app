Environment setup
-----------------

Create a `.env` file in `cricket-auction-backend/` with either a full `DATABASE_URL` or discrete Postgres variables.

Option A — single URL

```
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/cricket_auction
CLIENT_ORIGIN=http://localhost:3000
```

Option B — discrete values

```
PGUSER=postgres
PGPASSWORD=your_password
PGHOST=localhost
PGPORT=5432
PGDATABASE=cricket_auction
CLIENT_ORIGIN=http://localhost:3000
```

Then run the backend server (from `cricket-auction-backend/`).

