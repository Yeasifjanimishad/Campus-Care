/**
 * CampusCare Application Configuration
 */

// Official university email domain requirement
export const ALLOWED_EMAIL_DOMAIN = '@diu.edu.bd';

// Helper to validate university email domain
export const isValidUniversityEmail = (email: string): boolean => {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  
  // Primary check: ends with configured university domain
  if (cleanEmail.endsWith(ALLOWED_EMAIL_DOMAIN.toLowerCase())) {
    return true;
  }
  
  return false;
};
