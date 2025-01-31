//src/components/PersonalStats/UIComponents.tsx
import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { GoalType } from '../../types/personalStats';
import { LucideIcon } from 'lucide-react';

// Button Component
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  isLoading,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantStyles = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  const disabledStyles = disabled || isLoading ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabledStyles} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
};

// Icon Button Component
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({
  variant = 'secondary',
  size = 'sm',
  children,
  className = '',
  ...props
}) => {
  const baseStyles = 'rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantStyles = {
    primary: 'text-indigo-600 hover:bg-indigo-100 focus:ring-indigo-500',
    secondary: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-500',
    danger: 'text-red-600 hover:bg-red-100 focus:ring-red-500'
  };

  const sizeStyles = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3'
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// Progress Card Component
interface ProgressCardProps {
  title: string;
  type: GoalType;
  currentValue: number;
  targetValue: number;
  progress: number;
  onEdit?: () => void;
  icon?: LucideIcon;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({
  title,
  type,
  currentValue,
  targetValue,
  progress,
  onEdit,
  icon: Icon
}) => {
  const formatValue = (value: number): string => {
    switch (type) {
      case GoalType.CALORIE:
        return `${value} cal`;
      case GoalType.WEIGHT:
        return `${value} lbs`;
      default:
        return value.toString();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {Icon && <Icon className="text-indigo-600" size={24} />}
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        {onEdit && (
          <IconButton onClick={onEdit} variant="secondary" size="sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </IconButton>
        )}
      </div>

      <div className="mt-2">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Current: {formatValue(currentValue)}
          </span>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Target: {formatValue(targetValue)}
          </span>
        </div>
        <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
        <div className="mt-2 text-right">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    </div>
  );
};