import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  interactive = false,
  padding = 'md',
  children,
  className = '',
  ...props
}) => {
  const paddingClass = {
    none: 'p-0',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-5',
    lg: 'p-5 sm:p-6'
  }[padding];

  const cardClass = interactive ? 'ui-card-interactive' : 'ui-card';

  return (
    <div className={`${cardClass} ${paddingClass} ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`flex items-center justify-between gap-3 pb-3 mb-3 border-b border-border/60 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <h3 className={`text-base font-bold text-ink tracking-tight ${className}`} {...props}>
    {children}
  </h3>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`flex items-center justify-between gap-3 pt-3 mt-3 border-t border-border/60 ${className}`} {...props}>
    {children}
  </div>
);
