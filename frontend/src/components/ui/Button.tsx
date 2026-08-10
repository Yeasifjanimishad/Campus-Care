import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const variantClass = {
    primary: 'ui-button-primary',
    secondary: 'ui-button-secondary',
    outline: 'ui-button-outline',
    ghost: 'ui-button-ghost',
    danger: 'ui-button-danger',
    success: 'bg-wellness text-white hover:bg-wellness-hover'
  }[variant];

  const sizeClass = {
    sm: 'text-xs px-2.5 py-1.5 h-8',
    md: 'text-xs sm:text-sm px-3.5 py-2 h-10',
    lg: 'text-sm sm:text-base px-5 py-2.5 h-12'
  }[size];

  return (
    <button
      className={`ui-button ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
      ) : (
        leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  );
};
