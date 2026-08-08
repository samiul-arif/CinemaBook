import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { DetailedTicket } from '../api/client';

interface TicketViewProps {
  ticket: DetailedTicket;
  onClose?: () => void;
}

export function TicketView({ ticket, onClose }: TicketViewProps) {
  const [downloading, setDownloading] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  const dateFormatted = new Date(ticket.showtime.start_time).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const timeFormatted = new Date(ticket.showtime.start_time).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const handleDownloadPDF = async () => {
    if (!ticketRef.current || downloading) return;
    setDownloading(true);

    try {
      // Use html2canvas to render only the ticket card element
      const element = ticketRef.current;
      const canvas = await html2canvas(element, {
        scale: 3, // High-quality resolution
        useCORS: true, // Load external images like the QR code securely
        backgroundColor: null, // Transparent/clean card background
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // jsPDF format configuration: dynamically fit ticket component on exactly a single page
      const pdfWidth = 100; // 100mm width
      const pdfHeight = (imgHeight * pdfWidth) / imgWidth;

      const pdf = new jsPDF({
        orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

      // Name of download must be BK_<bookingRef>.pdf (e.g. BK_bk_abc123.pdf or uppercase format)
      const cleanRef = ticket.booking_ref.replace(/^bk_/i, '');
      const filename = `BK_${cleanRef.toUpperCase()}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setDownloading(false);
    }
  };

  const qrData = JSON.stringify({
    ref: ticket.booking_ref,
    seat: ticket.seat.seat_label,
    phone: ticket.user.phone,
  });

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=da7756&bgcolor=ffffff&data=${encodeURIComponent(qrData)}`;

  return (
    <div className="space-y-4">
      {/* Action Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-textTertiary">
          Official Electronic Ticket
        </span>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-borderLight text-textSecondary hover:text-textPrimary text-xs font-medium transition-colors"
            >
              Close
            </button>
          )}
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primaryDark text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {downloading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Downloading...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Printable Cinema Ticket Stub Container */}
      <div
        ref={ticketRef}
        className="ticket-card relative bg-card border-2 border-primary/40 rounded-3xl overflow-hidden shadow-2xl transition-all max-w-md mx-auto text-textPrimary"
      >
        {/* Top Header Branding Banner */}
        <div className="bg-gradient-to-r from-primaryDark via-primary to-primaryDark p-6 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-2xl">🎬</span>
              <span className="font-display text-3xl tracking-wider font-bold">CINEMASEAT</span>
            </div>
            <p className="text-xs uppercase font-mono tracking-[0.25em] text-primaryLight/90">
              Electronic Movie Admission Pass
            </p>
          </div>

          {/* Status Badges */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="px-3 py-0.5 rounded-full text-[10px] font-mono font-bold bg-success text-white uppercase tracking-wider shadow-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              CONFIRMED
            </span>
            <span className="px-3 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/20 text-white uppercase tracking-wider backdrop-blur-sm">
              PAID
            </span>
            <span className="px-3 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/20 text-white uppercase tracking-wider backdrop-blur-sm">
              VALID ENTRY
            </span>
          </div>
        </div>

        {/* Perforated Rip Line Divider */}
        <div className="relative h-6 bg-card flex items-center justify-between px-2 overflow-hidden">
          <div className="w-5 h-5 rounded-full bg-background border-r-2 border-primary/40 -ml-4" />
          <div className="w-full border-b-2 border-dashed border-borderLight/80 mx-2" />
          <div className="w-5 h-5 rounded-full bg-background border-l-2 border-primary/40 -mr-4" />
        </div>

        {/* Ticket Details Body */}
        <div className="p-6 space-y-5">
          {/* Movie Title Header */}
          <div className="border-b border-borderLight pb-4">
            <span className="text-[10px] font-mono uppercase tracking-wider text-textTertiary">Movie</span>
            <h2 className="font-display text-3xl text-textPrimary tracking-wide leading-tight">
              {ticket.movie.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-textSecondary font-medium">
              <span>{ticket.movie.genre}</span>
              <span>•</span>
              <span>{ticket.movie.duration_min} min</span>
              <span>•</span>
              <span>{ticket.movie.language}</span>
            </div>
          </div>

          {/* Grid Info Columns */}
          <div className="grid grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <span className="text-textTertiary uppercase text-[10px]">Theatre & Screen</span>
              <p className="font-bold text-textPrimary text-sm font-sans mt-0.5">{ticket.theatre.name}</p>
              <p className="text-primary font-semibold font-sans">{ticket.theatre.screen_name}</p>
              <p className="text-textSecondary text-[11px] font-sans">{ticket.theatre.city}</p>
            </div>

            <div>
              <span className="text-textTertiary uppercase text-[10px]">Date & Showtime</span>
              <p className="font-bold text-textPrimary text-sm font-sans mt-0.5">{dateFormatted}</p>
              <p className="text-primary font-bold text-base font-display tracking-wide">{timeFormatted}</p>
            </div>
          </div>

          {/* Highlighted Seat & Price Card */}
          <div className="p-4 rounded-2xl bg-surfaceVariant/40 border border-borderLight flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-mono text-textTertiary">Seat Number</span>
              <div className="font-display text-4xl text-primary font-bold tracking-wider leading-none mt-1">
                {ticket.seat.seat_label}
              </div>
              <span className="text-[10px] text-textSecondary uppercase font-mono">
                Row {ticket.seat.seat_row} · {ticket.seat.seat_type}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-textTertiary">Total Amount</span>
              <div className="font-mono text-2xl font-bold text-textPrimary mt-1">
                ৳{ticket.booking.amount}
              </div>
              <span className="text-[10px] text-success font-medium font-sans">Payment Received</span>
            </div>
          </div>

          {/* User & Ref Info */}
          <div className="grid grid-cols-2 gap-4 text-xs border-t border-borderLight pt-4 font-mono">
            <div>
              <span className="text-[10px] text-textTertiary uppercase">Booking Ref</span>
              <p className="font-bold text-textPrimary text-sm">{ticket.booking_ref}</p>
            </div>
            <div>
              <span className="text-[10px] text-textTertiary uppercase">Customer Phone</span>
              <p className="font-semibold text-textSecondary text-sm">{ticket.user.phone}</p>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="border-t-2 border-dashed border-borderLight/80 pt-6 flex flex-col items-center gap-4 text-center">
            {/* Real QR Code Generator API Image */}
            <div className="relative p-4 bg-white rounded-3xl border-2 border-primary/30 shadow-xl max-w-[200px]">
              <img
                src={qrCodeUrl}
                alt={`QR code for booking ${ticket.booking_ref}`}
                className="w-40 h-40 object-contain"
              />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono text-textTertiary uppercase block">Booking Reference</span>
              <span className="text-base font-mono font-bold tracking-widest text-textPrimary block">
                {ticket.booking_ref}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Section */}
        <div className="bg-surface p-4 text-center text-[10px] text-textTertiary border-t border-borderLight font-mono space-y-1">
          <p className="font-semibold text-textSecondary">Present this QR at entry.</p>
          <p className="font-medium">Booking Ref: {ticket.booking_ref}</p>
          <p>Issued by CinemaSeat</p>
        </div>
      </div>
    </div>
  );
}
