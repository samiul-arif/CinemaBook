import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}

export function Card({
  interactive = false,
  padding = 'md',
  children,
  className = '',
  ...props
}: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-6 sm:p-8',
  };

  return (
    <div
      className={`
        relative rounded-2xl border border-borderLight/80 bg-card text-textPrimary
        shadow-[0_1px_2px_-1px_rgba(31,71,54,0.08),0_8px_24px_-12px_rgba(31,71,54,0.12)]
        ${interactive ? 'rx-lift cursor-pointer' : ''}
        ${paddingClasses[padding]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
