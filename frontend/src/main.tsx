import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';
import { MoviesPage } from './pages/MoviesPage';
import { ShowtimesPage } from './pages/ShowtimesPage';
import { SeatMapPage } from './pages/SeatMapPage';
import { BookingPage } from './pages/BookingPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<MoviesPage />} />
            <Route path="/movies/:movieId" element={<ShowtimesPage />} />
            <Route path="/showtimes/:showtimeId" element={<SeatMapPage />} />
            <Route path="/bookings/:bookingRef" element={<BookingPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
