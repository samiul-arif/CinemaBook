import React from 'react';

export type SeatVariant = 'standard' | 'premium' | 'recliner' | 'booked' | 'selected';

export function getSeatVariantClass(variant: SeatVariant): string {
  switch (variant) {
    case 'premium':
      return 'seat-premium';
    case 'recliner':
      return 'seat-recliner';
    case 'booked':
      return 'seat-booked';
    case 'selected':
      return 'seat-selected';
    case 'standard':
    default:
      return 'seat-standard';
  }
}

interface SeatProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: SeatVariant;
  label?: string | number;
}

export function Seat({ variant = 'standard', label, className = '', ...props }: SeatProps) {
  const variantClass = getSeatVariantClass(variant);

  return (
    <button
      className={`seat w-8 h-8 rounded-t-lg text-xs font-mono flex items-center justify-center border transition-all ${variantClass} ${className}`}
      {...props}
    >
      {label}
    </button>
  );
}

interface SeatLegendProps {
  variant: SeatVariant;
  label: string;
}

export function SeatLegend({ variant, label }: SeatLegendProps) {
  const variantClass = getSeatVariantClass(variant);
  
  return (
    <div className="flex items-center gap-2">
      <div className={`w-4 h-4 rounded-t-sm border ${variantClass}`}></div>
      <span>{label}</span>
    </div>
  );
}
