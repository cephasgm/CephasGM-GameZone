/**
 * Passport Configuration - OAuth & Authentication Strategies
 * CephasGM GameZone
 * 
 * This module configures Passport.js authentication strategies including:
 * - Local (email/password) strategy
 * - JWT strategy for API authentication
 * - OAuth2 strategies (Google, Apple, Facebook, GitHub)
 * - Session serialization/deserialization
 */

const passport = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const AppleStrategy = require('passport-apple');

const argon2 = require('argon2');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { User } = require('../models');
const authConfig = require('./auth');
const { cache } = require('../services/cacheService');

// Get configuration
const config = authConfig.config;
const oauthConfig = config.oauth;

/**
 * ============================================
 * LOCAL STRATEGY (Email/Password)
 * ============================================
 */
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      session: false,
    },
    async (email, password, done) => {
      try {
        // Find user by email
        const user = await User.findOne({
          where: { email: email.toLowerCase().trim() },
          attributes: {
            include: ['password_hash', 'salt'],
          },
        });

        if (!user) {
          logger.warn(`Login attempt failed: User not found - ${email}`);
          return done(null, false, {
            message: 'Invalid email or password',
            code: 'AUTH_001',
          });
        }

        // Check if account is locked
        if (user.locked_until && user.locked_until > new Date()) {
          const remainingMinutes = Math.ceil(
            (user.locked_until - new Date()) / (60 * 1000)
          );
          return done(null, false, {
            message: `Account locked. Try again in ${remainingMinutes} minutes`,
            code: 'AUTH_002',
            lock_until: user.locked_until,
          });
        }

        // Verify password using Argon2
        const isPasswordValid = await argon2.verify(
          user.password_hash,
          password,
          {
            salt: Buffer.from(user.salt, 'hex'),
          }
        );

        if (!isPasswordValid) {
          // Increment failed login attempts
          await user.increment('failed_login_attempts');

          // Check if should lock account
          const failedAttempts = user.failed_login_attempts + 1;
          const maxAttempts = config.accountLockout.maxFailedAttempts;

          if (failedAttempts >= maxAttempts) {
            const lockDuration = config.accountLockout.lockoutDuration;
            await user.update({
              locked_until: new Date(Date.now() + lockDuration),
              failed_login_attempts: failedAttempts,
            });

            logger.warn(
              `Account locked for ${email} after ${failedAttempts} failed attempts`
            );

            return done(null, false, {
              message: 'Account locked due to multiple failed attempts',
              code: 'AUTH_003',
            });
          }

          await user.update({ failed_login_attempts: failedAttempts });

          logger.warn(
            `Login attempt failed: Invalid password for ${email} (Attempt ${failedAttempts}/${maxAttempts})`
          );

          return done(null, false, {
            message: 'Invalid email or password',
            code: 'AUTH_001',
          });
        }

        // Reset failed attempts on successful login
        await user.update({
          failed_login_attempts: 0,
          locked_until: null,
          last_login_at: new Date(),
        });

        // Check if email is verified
        if (config.emailVerification.requireForLogin && !user.email_verified) {
          return done(null, false, {
            message: 'Please verify your email address before logging in',
            code: 'AUTH_004',
            email: user.email,
          });
        }

        // Check if 2FA is required
        if (user.two_factor_enabled) {
          return done(null, user, {
            two_factor_required: true,
          });
        }

        logger.info(`User logged in successfully: ${email}`);
        return done(null, user);
      } catch (error) {
        logger.error('LocalStrategy error:', error);
        return done(error);
      }
    }
  )
);

/**
 * ============================================
 * JWT STRATEGY (API Authentication)
 * ============================================
 */
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: config.jwt.secret,
  issuer: config.jwt.issuer,
  audience: config.jwt.audience,
  passReqToCallback: true,
  ignoreExpiration: false,
};

passport.use(
  new JwtStrategy(jwtOptions, async (req, payload, done) => {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await cache.get(`jwt:blacklist:${payload.jti}`);
      if (isBlacklisted) {
        logger.warn('JWT token is blacklisted:', payload.sub);
        return done(null, false, {
          message: 'Token has been revoked',
          code: 'AUTH_005',
        });
      }

      // Find user from JWT payload
      const user = await User.findByPk(payload.sub, {
        attributes: {
          exclude: ['password_hash', 'salt'],
        },
      });

      if (!user) {
        logger.warn('JWT user not found:', payload.sub);
        return done(null, false, {
          message: 'User not found',
          code: 'AUTH_006',
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        return done(null, false, {
          message: `Account is ${user.status}`,
          code: 'AUTH_007',
        });
      }

      // Check if token issued before last password change
      if (user.last_password_change) {
        const tokenIssuedAt = new Date(payload.iat * 1000);
        if (tokenIssuedAt < user.last_password_change) {
          return done(null, false, {
            message: 'Token invalid. Password has been changed.',
            code: 'AUTH_008',
          });
        }
      }

      // Attach user to request
      req.user = user;
      req.tokenPayload = payload;

      return done(null, user);
    } catch (error) {
      logger.error('JWTStrategy error:', error);
      return done(error);
    }
  })
);

/**
 * ============================================
 * GOOGLE OAUTH STRATEGY
 * ============================================
 */
if (oauthConfig.google.clientId) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: oauthConfig.google.clientId,
        clientSecret: oauthConfig.google.clientSecret,
        callbackURL: oauthConfig.google.callbackURL,
        scope: oauthConfig.google.scope,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(null, false, {
              message: 'No email provided by Google',
              code: 'OAUTH_001',
            });
          }

          // Check if user already exists
          let user = await User.findOne({ where: { email } });

          if (user) {
            // Link Google account if not already linked
            if (!user.google_id) {
              await user.update({
                google_id: profile.id,
                avatar_url: profile.photos?.[0]?.value,
              });
            }
            return done(null, user);
          }

          // Create new user if not exists
          const [firstName, ...lastNameParts] = profile.displayName?.split(' ') || [
            'Google',
            'User',
          ];
          const lastName = lastNameParts.join(' ') || 'User';

          user = await User.create({
            email,
            first_name: firstName,
            last_name: lastName,
            google_id: profile.id,
            avatar_url: profile.photos?.[0]?.value,
            email_verified: true,
            status: 'active',
          });

          logger.info(`New user created via Google OAuth: ${email}`);
          return done(null, user);
        } catch (error) {
          logger.error('GoogleStrategy error:', error);
          return done(error);
        }
      }
    )
  );
}

/**
 * ============================================
 * FACEBOOK OAUTH STRATEGY
 * ============================================
 */
if (oauthConfig.facebook.clientId) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: oauthConfig.facebook.clientId,
        clientSecret: oauthConfig.facebook.clientSecret,
        callbackURL: oauthConfig.facebook.callbackURL,
        scope: oauthConfig.facebook.scope,
        profileFields: ['id', 'displayName', 'emails', 'photos'],
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(null, false, {
              message: 'No email provided by Facebook',
              code: 'OAUTH_002',
            });
          }

          let user = await User.findOne({ where: { email } });

          if (user) {
            if (!user.facebook_id) {
              await user.update({
                facebook_id: profile.id,
                avatar_url: profile.photos?.[0]?.value,
              });
            }
            return done(null, user);
          }

          const [firstName, ...lastNameParts] = profile.displayName?.split(' ') || [
            'Facebook',
            'User',
          ];
          const lastName = lastNameParts.join(' ') || 'User';

          user = await User.create({
            email,
            first_name: firstName,
            last_name: lastName,
            facebook_id: profile.id,
            avatar_url: profile.photos?.[0]?.value,
            email_verified: true,
            status: 'active',
          });

          logger.info(`New user created via Facebook OAuth: ${email}`);
          return done(null, user);
        } catch (error) {
          logger.error('FacebookStrategy error:', error);
          return done(error);
        }
      }
    )
  );
}

/**
 * ============================================
 * GITHUB OAUTH STRATEGY
 * ============================================
 */
if (oauthConfig.github.clientId) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: oauthConfig.github.clientId,
        clientSecret: oauthConfig.github.clientSecret,
        callbackURL: oauthConfig.github.callbackURL,
        scope: oauthConfig.github.scope,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value || `${profile.username}@github.com`;
          let user = await User.findOne({ where: { email } });

          if (user) {
            if (!user.github_id) {
              await user.update({
                github_id: profile.id,
                avatar_url: profile.photos?.[0]?.value,
              });
            }
            return done(null, user);
          }

          const [firstName, ...lastNameParts] = profile.displayName?.split(' ') || [
            'GitHub',
            'User',
          ];
          const lastName = lastNameParts.join(' ') || 'User';

          user = await User.create({
            email,
            first_name: firstName,
            last_name: lastName,
            github_id: profile.id,
            avatar_url: profile.photos?.[0]?.value,
            email_verified: true,
            status: 'active',
          });

          logger.info(`New user created via GitHub OAuth: ${email}`);
          return done(null, user);
        } catch (error) {
          logger.error('GitHubStrategy error:', error);
          return done(error);
        }
      }
    )
  );
}

/**
 * ============================================
 * APPLE OAUTH STRATEGY
 * ============================================
 */
if (oauthConfig.apple.clientId) {
  passport.use(
    new AppleStrategy(
      {
        clientID: oauthConfig.apple.clientId,
        teamID: oauthConfig.apple.teamId,
        keyID: oauthConfig.apple.keyId,
        privateKeyLocation: oauthConfig.apple.privateKey,
        callbackURL: oauthConfig.apple.callbackURL,
        scope: oauthConfig.apple.scope,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, idToken, profile, done) => {
        try {
          const email = profile.email;
          if (!email) {
            return done(null, false, {
              message: 'No email provided by Apple',
              code: 'OAUTH_003',
            });
          }

          let user = await User.findOne({ where: { email } });

          if (user) {
            if (!user.apple_id) {
              await user.update({
                apple_id: profile.id,
              });
            }
            return done(null, user);
          }

          const [firstName, ...lastNameParts] = [
            profile.name?.firstName || 'Apple',
            profile.name?.lastName || 'User',
          ];
          const lastName = lastNameParts.join(' ') || 'User';

          user = await User.create({
            email,
            first_name: firstName,
            last_name: lastName,
            apple_id: profile.id,
            email_verified: true,
            status: 'active',
          });

          logger.info(`New user created via Apple OAuth: ${email}`);
          return done(null, user);
        } catch (error) {
          logger.error('AppleStrategy error:', error);
          return done(error);
        }
      }
    )
  );
}

/**
 * ============================================
 * SESSION SERIALIZATION (for web sessions)
 * ============================================
 */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id, {
      attributes: {
        exclude: ['password_hash', 'salt'],
      },
    });
    done(null, user);
  } catch (error) {
    logger.error('DeserializeUser error:', error);
    done(error);
  }
});

/**
 * ============================================
 * UTILITY FUNCTIONS
 * ============================================
 */

/**
 * Authenticate using JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateJWT = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json({
        success: false,
        message: info?.message || 'Authentication required',
        code: info?.code || 'AUTH_009',
      });
    }
    req.user = user;
    next();
  })(req, res, next);
};

/**
 * Optional JWT authentication (does not fail if no token)
 */
const optionalAuthenticateJWT = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (user) {
      req.user = user;
    }
    next();
  })(req, res, next);
};

/**
 * Get OAuth redirect URL with state parameter
 * @param {string} provider - OAuth provider name
 * @param {string} state - State parameter for CSRF protection
 * @returns {string} - Redirect URL
 */
const getOAuthRedirectUrl = (provider, state) => {
  const strategies = {
    google: 'google',
    facebook: 'facebook',
    github: 'github',
    apple: 'apple',
  };

  if (!strategies[provider]) {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  // Generate state if not provided
  const stateParam = state || crypto.randomBytes(16).toString('hex');

  // Return the authenticate URL
  return `/api/v1/auth/oauth/${provider}/authorize?state=${stateParam}`;
};

// Export Passport instance and utilities
module.exports = {
  passport,
  authenticateJWT,
  optionalAuthenticateJWT,
  getOAuthRedirectUrl,
  // Export individual strategies for testing
  strategies: {
    local: LocalStrategy,
    jwt: JwtStrategy,
    google: GoogleStrategy,
    facebook: FacebookStrategy,
    github: GitHubStrategy,
    apple: AppleStrategy,
  },
};

// Default export
module.exports.default = passport;
