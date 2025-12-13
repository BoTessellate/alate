/**
 * Brand Authentication API Routes
 */

import { Router, Request, Response } from 'express';
import { createBrandAuthenticator } from '../../loginBrand';

const router = Router();
const authenticator = createBrandAuthenticator();

/**
 * POST /api/brand/auth/register
 * Register new brand
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, brand_name, website, industry } = req.body;

    if (!email || !password || !brand_name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and brand name are required'
      });
    }

    const result = await authenticator.register({
      email,
      password,
      brand_name,
      website,
      industry
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/brand/auth/login
 * Login brand
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const result = await authenticator.login({ email, password });

    if (!result.success) {
      return res.status(401).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/brand/auth/logout
 * Logout brand
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Access token required'
      });
    }

    const result = await authenticator.logout(token);
    res.json(result);
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/brand/auth/verify
 * Verify session token
 */
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Access token required'
      });
    }

    const result = await authenticator.verifyToken(token);
    res.json(result);
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/brand/auth/profile
 * Get brand profile
 */
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    // Verify token and get brand_id
    const verification = await authenticator.verifyToken(token);
    if (!verification.valid || !verification.brand_id) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Get profile
    const profile = await authenticator.getProfile(verification.brand_id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    res.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
