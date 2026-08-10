import React from 'react';
import { Badge } from './Badge';

export type StatusType =
  | 'active'
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'suspended'
  | 'disabled'
  | 'escalated'
  | 'critical'
  | 'resolved'
  | 'submitted'
  | 'under_review'
  | 'HEALTHY'
  | 'DEGRADED'
  | 'CRITICAL';

export interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const normalized = (status || '').toLowerCase();

  switch (normalized) {
    case 'active':
    case 'confirmed':
    case 'completed':
    case 'resolved':
    case 'healthy':
      return <Badge variant="success" className={className}>{status.toUpperCase()}</Badge>;

    case 'pending':
    case 'under_review':
    case 'submitted':
    case 'degraded':
      return <Badge variant="warning" className={className}>{status.toUpperCase()}</Badge>;

    case 'rejected':
    case 'cancelled':
    case 'suspended':
    case 'disabled':
    case 'escalated':
    case 'critical':
      return <Badge variant="danger" className={className}>{status.toUpperCase()}</Badge>;

    default:
      return <Badge variant="neutral" className={className}>{status}</Badge>;
  }
};
