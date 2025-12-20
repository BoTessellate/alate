/**
 * User Role & Identity Permissions for Mood Layer SDK
 *
 * Provides authentication and authorization using Supabase Auth:
 * - JWT token verification
 * - Role-based access control (RBAC)
 * - Permission checking middleware
 * - User session management
 */

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Request, Response, NextFunction } from 'express';
import { createModuleLogger } from './logger';
import { UnauthorizedError, ForbiddenError, ConfigurationError } from './errors';

const logger = createModuleLogger('auth');

// ============================================================================
// TYPES
// ============================================================================

/**
 * User roles with increasing permission levels
 */
export type UserRole = 'guest' | 'free' | 'pro' | 'team' | 'admin';

/**
 * Feature-based permissions
 */
export type Permission =
  | 'board:create'
  | 'board:read'
  | 'board:update'
  | 'board:delete'
  | 'board:share'
  | 'board:export'
  | 'product:enrich'
  | 'product:search'
  | 'product:import'
  | 'product:batch_import'
  | 'theme:extract'
  | 'theme:export'
  | 'plugin:connect'
  | 'plugin:sync'
  | 'analytics:view'
  | 'analytics:export'
  | 'team:invite'
  | 'team:manage'
  | 'admin:users'
  | 'admin:billing'
  | 'admin:settings';

/**
 * Role-permission mapping
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  guest: [
    'board:read',
    'product:search',
  ],
  free: [
    'board:create',
    'board:read',
    'board:update',
    'board:delete',
    'product:enrich',
    'product:search',
    'theme:extract',
  ],
  pro: [
    'board:create',
    'board:read',
    'board:update',
    'board:delete',
    'board:share',
    'board:export',
    'product:enrich',
    'product:search',
    'product:import',
    'product:batch_import',
    'theme:extract',
    'theme:export',
    'plugin:connect',
    'plugin:sync',
    'analytics:view',
  ],
  team: [
    'board:create',
    'board:read',
    'board:update',
    'board:delete',
    'board:share',
    'board:export',
    'product:enrich',
    'product:search',
    'product:import',
    'product:batch_import',
    'theme:extract',
    'theme:export',
    'plugin:connect',
    'plugin:sync',
    'analytics:view',
    'analytics:export',
    'team:invite',
    'team:manage',
  ],
  admin: [
    'board:create',
    'board:read',
    'board:update',
    'board:delete',
    'board:share',
    'board:export',
    'product:enrich',
    'product:search',
    'product:import',
    'product:batch_import',
    'theme:extract',
    'theme:export',
    'plugin:connect',
    'plugin:sync',
    'analytics:view',
    'analytics:export',
    'team:invite',
    'team:manage',
    'admin:users',
    'admin:billing',
    'admin:settings',
  ],
};

/**
 * Usage limits per role
 */
export const ROLE_LIMITS: Record<UserRole, {
  maxBoards: number;
  maxProductsPerBoard: number;
  maxEnrichmentsPerDay: number;
  maxExportsPerDay: number;
  maxStorageMB: number;
}> = {
  guest: {
    maxBoards: 0,
    maxProductsPerBoard: 0,
    maxEnrichmentsPerDay: 0,
    maxExportsPerDay: 0,
    maxStorageMB: 0,
  },
  free: {
    maxBoards: 3,
    maxProductsPerBoard: 20,
    maxEnrichmentsPerDay: 10,
    maxExportsPerDay: 3,
    maxStorageMB: 50,
  },
  pro: {
    maxBoards: 50,
    maxProductsPerBoard: 100,
    maxEnrichmentsPerDay: 100,
    maxExportsPerDay: 50,
    maxStorageMB: 1000,
  },
  team: {
    maxBoards: 200,
    maxProductsPerBoard: 200,
    maxEnrichmentsPerDay: 500,
    maxExportsPerDay: 200,
    maxStorageMB: 5000,
  },
  admin: {
    maxBoards: Infinity,
    maxProductsPerBoard: Infinity,
    maxEnrichmentsPerDay: Infinity,
    maxExportsPerDay: Infinity,
    maxStorageMB: Infinity,
  },
};

/**
 * Authenticated user with role and permissions
 */
export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: UserRole;
  permissions: Permission[];
  limits: typeof ROLE_LIMITS[UserRole];
  metadata?: Record<string, unknown>;
  teamId?: string;
}

/**
 * Extended Express Request with user
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface AuthConfig {
  supabaseUrl: string;
  supabaseKey: string;
  jwtSecret?: string;
  defaultRole?: UserRole;
}

// ============================================================================
// AUTH SERVICE
// ============================================================================

export class AuthService {
  private supabase: SupabaseClient;
  private defaultRole: UserRole;

  constructor(config: AuthConfig) {
    if (!config.supabaseUrl || !config.supabaseKey) {
      throw new ConfigurationError('Supabase URL and key are required for auth');
    }

    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.defaultRole = config.defaultRole || 'free';

    logger.info('Auth service initialized');
  }

  /**
   * Verify JWT token and get user
   */
  async verifyToken(token: string): Promise<AuthenticatedUser> {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedError('Invalid or expired token');
      }

      return this.buildAuthenticatedUser(user);
    } catch (error: any) {
      if (error instanceof UnauthorizedError) throw error;
      logger.error({ error: error.message }, 'Token verification failed');
      throw new UnauthorizedError('Token verification failed');
    }
  }

  /**
   * Get user by ID (for internal use)
   */
  async getUserById(userId: string): Promise<AuthenticatedUser | null> {
    const { data: { user }, error } = await this.supabase.auth.admin.getUserById(userId);

    if (error || !user) {
      return null;
    }

    return this.buildAuthenticatedUser(user);
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    const { error } = await this.supabase.auth.admin.updateUserById(userId, {
      user_metadata: { role },
    });

    if (error) {
      throw new Error(`Failed to update user role: ${error.message}`);
    }

    logger.info({ userId, role }, 'User role updated');
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(user: AuthenticatedUser, permission: Permission): boolean {
    return user.permissions.includes(permission);
  }

  /**
   * Check if user has all specified permissions
   */
  hasAllPermissions(user: AuthenticatedUser, permissions: Permission[]): boolean {
    return permissions.every((p) => user.permissions.includes(p));
  }

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(user: AuthenticatedUser, permissions: Permission[]): boolean {
    return permissions.some((p) => user.permissions.includes(p));
  }

  /**
   * Check if user is within their limits
   */
  async checkLimit(
    user: AuthenticatedUser,
    limitType: keyof typeof ROLE_LIMITS.free,
    currentUsage: number
  ): Promise<boolean> {
    const limit = user.limits[limitType];
    return currentUsage < limit;
  }

  /**
   * Build authenticated user from Supabase user
   */
  private buildAuthenticatedUser(user: User): AuthenticatedUser {
    const role = (user.user_metadata?.role as UserRole) || this.defaultRole;
    const permissions = ROLE_PERMISSIONS[role];
    const limits = ROLE_LIMITS[role];

    return {
      id: user.id,
      email: user.email,
      role,
      permissions,
      limits,
      metadata: user.user_metadata,
      teamId: user.user_metadata?.team_id,
    };
  }
}

// ============================================================================
// EXPRESS MIDDLEWARE
// ============================================================================

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(config: AuthConfig) {
  const authService = new AuthService(config);

  /**
   * Authenticate user from Authorization header
   */
  const authenticate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      req.user = await authService.verifyToken(token);

      logger.debug({ userId: req.user.id, role: req.user.role }, 'User authenticated');
      next();
    } catch (error: any) {
      if (error instanceof UnauthorizedError) {
        res.status(401).json(error.toJSON());
      } else {
        next(error);
      }
    }
  };

  /**
   * Optional authentication - doesn't fail if no token
   */
  const optionalAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        req.user = await authService.verifyToken(token);
      }

      next();
    } catch (error) {
      // Ignore auth errors for optional auth
      next();
    }
  };

  /**
   * Require specific permission(s)
   */
  const requirePermission = (...permissions: Permission[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        const error = new UnauthorizedError('Authentication required');
        return res.status(401).json(error.toJSON());
      }

      const hasPermission = permissions.every((p) =>
        req.user!.permissions.includes(p)
      );

      if (!hasPermission) {
        const error = new ForbiddenError(
          `Missing required permission(s): ${permissions.join(', ')}`
        );
        return res.status(403).json(error.toJSON());
      }

      next();
    };
  };

  /**
   * Require specific role(s)
   */
  const requireRole = (...roles: UserRole[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        const error = new UnauthorizedError('Authentication required');
        return res.status(401).json(error.toJSON());
      }

      if (!roles.includes(req.user.role)) {
        const error = new ForbiddenError(
          `Required role: ${roles.join(' or ')}`
        );
        return res.status(403).json(error.toJSON());
      }

      next();
    };
  };

  /**
   * Check usage limit
   */
  const checkLimit = (
    limitType: keyof typeof ROLE_LIMITS.free,
    getCurrentUsage: (req: AuthenticatedRequest) => Promise<number>
  ) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        const error = new UnauthorizedError('Authentication required');
        return res.status(401).json(error.toJSON());
      }

      try {
        const currentUsage = await getCurrentUsage(req);
        const limit = req.user.limits[limitType];

        if (currentUsage >= limit) {
          const error = new ForbiddenError(
            `Usage limit reached: ${limitType} (${currentUsage}/${limit}). Upgrade to increase your limit.`
          );
          return res.status(403).json(error.toJSON());
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  };

  return {
    authService,
    authenticate,
    optionalAuth,
    requirePermission,
    requireRole,
    checkLimit,
  };
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create auth service with environment variables
 */
export function createAuthService(config?: Partial<AuthConfig>): AuthService {
  return new AuthService({
    supabaseUrl: config?.supabaseUrl || process.env.SUPABASE_URL || '',
    supabaseKey: config?.supabaseKey || process.env.SUPABASE_SERVICE_KEY || '',
    jwtSecret: config?.jwtSecret || process.env.JWT_SECRET,
    defaultRole: config?.defaultRole,
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get permissions for a role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Get limits for a role
 */
export function getLimitsForRole(role: UserRole): typeof ROLE_LIMITS[UserRole] {
  return ROLE_LIMITS[role];
}

/**
 * Check if a role can access another role's resources
 */
export function canAccessRole(userRole: UserRole, targetRole: UserRole): boolean {
  const roleHierarchy: UserRole[] = ['guest', 'free', 'pro', 'team', 'admin'];
  return roleHierarchy.indexOf(userRole) >= roleHierarchy.indexOf(targetRole);
}
