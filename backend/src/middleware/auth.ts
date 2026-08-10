import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { AppError } from '../lib/errors.js';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      token?: string;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];
    req.token = token;
    
    // Verify token using supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new AppError(401, 'Invalid or expired token', authError?.message);
    }

    // Fetch user profile from public.users to get role and status
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, status')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new AppError(401, 'User profile not found');
    }

    if (profile.status !== 'active' && profile.status !== 'pending') {
      throw new AppError(403, `Account is ${profile.status}`);
    }

    req.user = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      status: profile.status,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'Authentication required');
      }
      
      if (!roles.includes(req.user.role)) {
        throw new AppError(403, 'Insufficient permissions');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requireAdmin = requireRole('super_admin', 'emergency_admin');
export const requireSuperAdmin = requireRole('super_admin');
