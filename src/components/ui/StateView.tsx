import React from 'react';
import { AlertTriangle, FolderOpen, RefreshCw } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
  className = ''
}) => (
  <Card className={`p-8 text-center flex flex-col items-center justify-center space-y-3 ${className}`}>
    <RefreshCw className="w-6 h-6 text-primary animate-spin" />
    <p className="text-xs font-semibold text-ink-muted">{message}</p>
  </Card>
);

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Records Found',
  description = 'There is currently no data to display.',
  icon = <FolderOpen className="w-8 h-8 text-ink-subtle" />,
  action,
  className = ''
}) => (
  <Card className={`p-8 text-center flex flex-col items-center justify-center space-y-3 border-dashed ${className}`}>
    <div className="p-3 rounded-2xl bg-background text-ink-subtle">
      {icon}
    </div>
    <div className="space-y-1 max-w-sm">
      <h4 className="text-sm font-bold text-ink">{title}</h4>
      <p className="text-xs text-ink-muted">{description}</p>
    </div>
    {action && (
      <Button variant="outline" size="sm" onClick={action.onClick} className="mt-2">
        {action.label}
      </Button>
    )}
  </Card>
);

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to Load Data',
  message = 'An unexpected error occurred while communicating with the server.',
  onRetry,
  className = ''
}) => (
  <Card className={`p-6 bg-red-50/50 border-red-200 text-center flex flex-col items-center justify-center space-y-3 ${className}`}>
    <div className="p-2.5 rounded-xl bg-red-100 text-emergency">
      <AlertTriangle className="w-6 h-6" />
    </div>
    <div className="space-y-1 max-w-md">
      <h4 className="text-sm font-bold text-red-900">{title}</h4>
      <p className="text-xs text-red-700">{message}</p>
    </div>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="w-3.5 h-3.5" />} className="bg-white">
        Retry Request
      </Button>
    )}
  </Card>
);
