import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MoviesPage } from './pages/MoviesPage';
import { ShowtimesPage } from './pages/ShowtimesPage';
import { SeatMapPage } from './pages/SeatMapPage';
import { BookingPage } from './pages/BookingPage';
import { RegisterPage } from './pages/RegisterPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { MyTicketsPage } from './pages/MyTicketsPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              {/* Public Routes */}
              <Route path="/" element={<MoviesPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/movies/:movieId" element={<ShowtimesPage />} />
              <Route path="/showtimes/:showtimeId" element={<SeatMapPage />} />

              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/bookings/:bookingRef" element={<BookingPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/my-bookings" element={<MyBookingsPage />} />
                <Route path="/my-tickets" element={<MyTicketsPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
