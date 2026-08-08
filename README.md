# CinemaBook

CinemaBook (CinemaSeat) is a highly concurrent, reliable movie ticket booking system built to handle high-traffic spikes without double-booking seats.

## System Architecture

The application is structured into the following services:
- **Frontend**: React + TypeScript + Vite + Tailwind CSS (runs on port `5173`).
- **Backend**: Node.js + Express + TypeScript (runs on port `4000`).
- **Mock Gateway**: Simulates payment and OTP behaviors (runs on port `9000`).
- **Database**: PostgreSQL (runs on port `5432`) for data storage.
- **Cache**: Redis (runs on port `6379`) for holding lock/session states.

## Running Locally

To start the entire stack using Docker Compose:

```bash
docker compose up --build
```

This will spin up all the services, run database migrations and seeds automatically, and start the servers.

## API Documentation

### 1. Fetching a Seat Map
Retrieve the current state of the seat layout for a specific showtime.

- **Endpoint**: `GET /api/showtimes/:showtimeId/seats`
- **Response**:
  ```json
  [
    {
      "id": "seat_001",
      "seat_label": "A1",
      "status": "AVAILABLE",
      "price": 450,
      "hold_expires_at": null
    }
  ]
  ```

### 2. Holding a Seat
Attempt to acquire a short-term lock/hold on a specific seat.

- **Endpoint**: `POST /api/showtimes/:showtimeId/seats/:seatId/hold`
- **Request Body**:
  ```json
  {
    "phone": "+8801700000000"
  }
  ```
- **Response**:
  ```json
  {
    "booking_ref": "bk_abc123",
    "seat": {
      "id": "seat_001",
      "label": "A1",
      "price": 450
    },
    "hold_ttl_seconds": 120,
    "hold_expires_at": "2026-08-08T12:00:00.000Z"
  }
  ```