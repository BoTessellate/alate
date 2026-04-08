# Mood Layer Security Guide

This document outlines the security architecture and deployment checklist for production.

## Security Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SECURITY LAYERS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌──────────────────┐     ┌─────────────────────────┐  │
│  │   Frontend  │────▶│  Backend Server  │────▶│  Supabase Edge Function │  │
│  │   (Canva)   │     │    (Vercel)      │     │     (secure-api)        │  │
│  └─────────────┘     └──────────────────┘     └─────────────────────────┘  │
│        │                     │                          │                   │
│        │                     │                          │                   │
│        ▼                     ▼                          ▼                   │
│  No secrets          API_SECRET header          All sensitive keys:        │
│  Public anon key     SUPABASE_KEY (env)         - OPENAI_API_KEY           │
│  only                                           - ANTHROPIC_API_KEY        │
│                                                 - PINECONE_API_KEY         │
│                                                 - SERVICE_ROLE_KEY         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Credential Storage Locations

### Layer 1: Supabase Edge Function Secrets (Most Secure)

Store these in **Supabase Dashboard → Project Settings → Edge Functions → Secrets**:

| Secret Name | Description |
|-------------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Database admin access for Edge Function |
| `OPENAI_API_KEY` | OpenAI API for embeddings |
| `ANTHROPIC_API_KEY` | Claude AI for text generation |
| `PINECONE_API_KEY` | Vector database access |
| `PINECONE_INDEX_HOST` | Pinecone index URL |
| `API_SECRET` | Validates requests from backend |

### Layer 2: Hosting Platform Environment Variables

For **Vercel** (or other hosting), set in the platform dashboard:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Service role key (backend only!) |
| `SECURE_API_URL` | Edge Function URL |
| `API_SECRET` | Must match Edge Function secret |
| `NODE_ENV` | Set to `production` |

### Layer 3: Local Development (.env)

- **Location**: `backend/.env` (gitignored)
- **Purpose**: Local development only
- **Contains**: All credentials needed for local testing

## Production Deployment Checklist

### Before First Deploy

- [ ] Verify `.env` is in `.gitignore`
- [ ] Verify no secrets in committed code (`git log -p | grep -i "api_key\|secret\|password"`)
- [ ] Generate new API_SECRET for production: `openssl rand -base64 32`
- [ ] Set up Supabase Edge Function secrets
- [ ] Configure hosting platform environment variables

### Supabase Configuration

- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Verify RLS policies are restrictive (default deny)
- [ ] Enable SSL enforcement on database
- [ ] Set up database backups
- [ ] Configure CORS for Edge Functions (restrict to your domain)

### Vercel Configuration

- [ ] Set all environment variables in Vercel dashboard
- [ ] Enable Vercel's environment variable encryption
- [ ] Do NOT use `.env.production` committed to repo
- [ ] Set `NODE_ENV=production`

### Network Security

- [ ] Enable Supabase network restrictions (IP allowlist) if possible
- [ ] Use HTTPS everywhere
- [ ] Configure rate limiting on Edge Functions (already implemented)

### Monitoring

- [ ] Set up error alerting (Sentry, etc.)
- [ ] Monitor `api_audit_log` table for suspicious activity
- [ ] Set up uptime monitoring

## Security Best Practices

### Do's

✅ Store all API keys in Supabase Edge Function secrets
✅ Use service role key only in backend, never frontend
✅ Use RLS policies on all tables
✅ Validate all inputs before database operations
✅ Use prepared statements (Supabase JS handles this)
✅ Log security events to audit table
✅ Rotate API_SECRET periodically

### Don'ts

❌ Never commit `.env` files
❌ Never expose service role key to frontend
❌ Never disable RLS in production
❌ Never use `DATABASE_URL` in production (bypasses RLS)
❌ Never log sensitive data (passwords, tokens)
❌ Never trust client input without validation

## Rotating Secrets

### Rotating API_SECRET

1. Generate new secret: `openssl rand -base64 32`
2. Update in Supabase Edge Function secrets
3. Update in Vercel environment variables
4. Deploy backend
5. Verify functionality

### Rotating Service Role Key

1. Go to Supabase Dashboard → Settings → API
2. Click "Regenerate" on service_role key
3. Update in Supabase Edge Function secrets (`SUPABASE_SERVICE_ROLE_KEY`)
4. Update in Vercel environment variables (`SUPABASE_KEY`)
5. Update local `.env` for development
6. Deploy and verify

### Rotating Database Password

1. Go to Supabase Dashboard → Settings → Database
2. Reset password
3. Update `DATABASE_URL` in local `.env`
4. URL-encode special characters (`& → %26`, etc.)
5. Test local connection

## Incident Response

If you suspect a credential leak:

1. **Immediately rotate** the compromised credential
2. Check `api_audit_log` for unauthorized access
3. Review Supabase Dashboard → Logs for suspicious activity
4. If database password leaked, also check for unauthorized data access
5. Document the incident and remediation steps

## Security Testing

Before major releases:

```bash
# Check for hardcoded secrets
grep -rn "sk-" --include="*.ts" --include="*.js" .
grep -rn "eyJ" --include="*.ts" --include="*.js" . | grep -v node_modules

# Verify .env is not tracked
git ls-files | grep ".env"

# Test RLS policies (should fail without auth)
curl https://your-project.supabase.co/rest/v1/enriched_products \
  -H "apikey: YOUR_ANON_KEY"
```

## Contact

For security concerns, contact the development team immediately.
