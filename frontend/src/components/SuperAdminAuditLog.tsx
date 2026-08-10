import React from 'react';
import { UserProfile } from '../types';
import { AdminAuditLogViewer } from './AdminAuditLogViewer';

interface SuperAdminAuditLogProps {
  user: UserProfile;
}

export const SuperAdminAuditLog: React.FC<SuperAdminAuditLogProps> = ({ user }) => {
  return <AdminAuditLogViewer user={user} />;
};

