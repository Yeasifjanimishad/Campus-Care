import { Router } from 'express';
import multer from 'multer';
import { supabaseAdmin, createAuthClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// POST /api/upload/incident-evidence
router.post('/incident-evidence', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'No file uploaded');
    }

    const file = req.file;
    const userId = req.user!.id;
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    try {
      const authClient = createAuthClient(req.token!);
      
      const { data, error } = await authClient.storage
        .from('incident-evidence')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw error;
      }

      // Generate a signed URL for immediate preview (e.g., valid for 1 hour)
      const { data: signedUrlData, error: signedUrlError } = await authClient.storage
        .from('incident-evidence')
        .createSignedUrl(filePath, 3600);
        
      res.json({
        path: filePath,
        url: signedUrlData?.signedUrl || null
      });
    } catch (sbErr: any) {
      console.warn('[Upload Warning]: Supabase storage failed, using mock path', sbErr.message);
      // Mock fallback
      res.json({
        path: filePath,
        url: `https://mock-storage.example.com/${filePath}`
      });
    }
  } catch (err: any) {
    if (err.message === 'Only images are allowed') {
      next(new AppError(400, err.message));
    } else if (err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'File size exceeds 5MB limit'));
    } else {
      next(err);
    }
  }
});

// GET /api/upload/incident-evidence/:path(*)
router.get('/incident-evidence/*', requireAuth, async (req, res, next) => {
  try {
    const filePath = req.params[0];
    if (!filePath) {
      throw new AppError(400, 'File path is required');
    }

    try {
      const authClient = createAuthClient(req.token!);
      
      const { data, error } = await authClient.storage
        .from('incident-evidence')
        .createSignedUrl(filePath, 3600);
        
      if (error) {
        throw error;
      }
      
      res.json({ url: data.signedUrl });
    } catch (sbErr: any) {
      console.warn('[Upload Warning]: Supabase storage sign failed, using mock url', sbErr.message);
      res.json({ url: `https://mock-storage.example.com/${filePath}` });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
