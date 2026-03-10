# ⚠️ IMMEDIATE ACTION REQUIRED - API Key Rotation

## Overview

As part of security hardening, **all live API keys and secrets have been removed from your `.env` file**. This was necessary to eliminate the risk of credential exposure.

**Your application will not function properly until you rotate these credentials and add the new keys to your `.env` file.**

---

## 🔴 Critical Actions Required

You must **manually rotate the following API keys** in their respective provider dashboards and update your `.env` file with the new credentials.

### 1. OpenAI API Key

**Status:** ❌ Removed (old key: `sk-proj-9UaI...`)

**Action Required:**
1. Visit https://platform.openai.com/api-keys
2. **Revoke the old key** `sk-proj-9UaI...` (if you still have access)
3. Click "Create new secret key"
4. Copy the new key (starts with `sk-proj-...`)
5. Update your `.env` file:
   ```bash
   OPENAI_API_KEY=sk-proj-YOUR_NEW_KEY_HERE
   ```

**Why:** The old key was exposed in plaintext and must be considered compromised.

**Documentation:** [OpenAI API Keys Documentation](https://platform.openai.com/docs/api-reference/authentication)

---

### 2. Anthropic API Key

**Status:** ❌ Removed (old key: `sk-ant-oat01-...`)

**Action Required:**
1. Visit https://console.anthropic.com/settings/keys
2. **Revoke the old key** `sk-ant-oat01-...`
3. Click "Create Key"
4. Copy the new key (starts with `sk-ant-...`)
5. Update your `.env` file:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-YOUR_NEW_KEY_HERE
   ```

**Why:** The old key was exposed in plaintext and must be considered compromised.

**Documentation:** [Anthropic API Keys Documentation](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)

---

### 3. Kashier Payment Credentials

**Status:** ❌ Removed (old credentials: `MID-5857-102`, `ea1640e3-...`, `fd83cd17...`)

**Action Required:**
1. Log in to your **Kashier Merchant Dashboard**
2. Navigate to **Settings → API Credentials** (or contact Kashier support)
3. **Regenerate/rotate** the following credentials:
   - Merchant ID
   - API Key
   - Webhook Secret
4. Update your `.env` file:
   ```bash
   KASHIER_MERCHANT_ID=your_new_merchant_id
   KASHIER_API_KEY=your_new_api_key
   KASHIER_WEBHOOK_SECRET=your_new_webhook_secret
   ```

**Why:** Payment credentials were exposed and could allow unauthorized payment processing.

**Note:** Some payment providers require contacting support to rotate credentials. If Kashier doesn't offer self-service rotation, contact their support team immediately.

**Documentation:** Contact Kashier support or check your merchant dashboard documentation

---

### 4. Google OAuth Credentials

**Status:** ❌ Removed (old credentials: `44877055026-...`, `GOCSPX-djBTyms4...`)

**Action Required:**
1. Visit https://console.cloud.google.com/apis/credentials
2. Select your project
3. Find the old OAuth 2.0 Client ID: `44877055026-03pl8nvbp6br5ooq2bt4gpgg40lj6ctn.apps.googleusercontent.com`
4. **Delete the old OAuth client** or create a new one:
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: Web application
   - Add authorized redirect URIs:
     - `https://mojeeb.app/auth/google/callback`
     - `https://api.mojeeb.app/api/v1/auth/google/callback`
     - (Add your development URLs if needed: `http://localhost:3000/auth/google/callback`)
5. Copy the new Client ID and Client Secret
6. Update your `.env` file:
   ```bash
   GOOGLE_CLIENT_ID=your_new_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-your_new_client_secret
   ```
7. **Update frontend environment** (if using Next.js public variables):
   ```bash
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_new_client_id.apps.googleusercontent.com
   ```
8. **Rebuild your frontend** to use the new public client ID

**Why:** OAuth credentials were exposed and could allow impersonation attacks.

**Important:** After updating, users will need to re-authorize your application with Google.

**Documentation:** [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)

---

## ✅ Already Completed Automatically

The following credentials have been **automatically rotated** with secure random values:

### JWT_SECRET
- ✅ **Old weak placeholder replaced** (`your-jwt-secret-change-in-production`)
- ✅ **New cryptographically strong secret generated** (48-byte base64)
- ⚠️ **All user sessions invalidated** - users must log in again

### ENCRYPTION_KEY
- ✅ **Old example value replaced** (`0123456789abcdef...`)
- ✅ **New secure random key generated** (64 hex characters)
- ⚠️ **Backup your old ENCRYPTION_KEY** if you have encrypted data that needs migration

---

## 📋 Quick Action Checklist

Use this checklist to track your progress:

- [ ] **OpenAI:** Revoke old key, generate new key, update `.env`
- [ ] **Anthropic:** Revoke old key, generate new key, update `.env`
- [ ] **Kashier:** Rotate credentials (contact support if needed), update `.env`
- [ ] **Google OAuth:** Delete old client, create new client, update `.env` + frontend
- [ ] **Rebuild frontend** (if using Google OAuth - for `NEXT_PUBLIC_GOOGLE_CLIENT_ID`)
- [ ] **Restart your application** to load new environment variables
- [ ] **Test all integrations:**
  - [ ] OpenAI API calls work
  - [ ] Anthropic API calls work
  - [ ] Payment processing works (Kashier)
  - [ ] Google OAuth login works
- [ ] **Backup your new `.env` file securely** (encrypted storage, secrets manager)
- [ ] **Verify `.env` is in `.gitignore`** (never commit credentials to Git)

---

## 🚀 After Rotation - Restart Your Application

Once you've updated all credentials in your `.env` file:

```bash
# For Docker deployments
docker-compose restart

# For direct Node.js
npm run dev  # Development
npm run build && npm start  # Production

# Verify health
curl http://localhost:5000/api/v1/health
```

---

## 📚 Additional Resources

- **Comprehensive Rotation Guide:** `docs/KEY_ROTATION.md` - Detailed procedures for all credential types
- **Security Guidelines:** `SECURITY.md` - Secret management best practices
- **Audit Report:** `AUDIT-REPORT.md` - Security audit findings and fixes
- **Environment Example:** `.env.example` - Reference for all required environment variables

---

## ⚠️ Important Security Reminders

1. **Never commit `.env` files to Git** - They are already in `.gitignore`, but double-check before any git operations
2. **Use a secrets manager** - Consider HashiCorp Vault, AWS Secrets Manager, or Doppler for production
3. **Store backup credentials securely** - Use encrypted storage or a password manager
4. **Rotate credentials regularly** - Follow the schedule in `docs/KEY_ROTATION.md`
5. **Monitor for suspicious activity** - Check provider dashboards for unexpected API usage
6. **Document all rotations** - Keep an audit trail of when credentials were rotated and by whom

---

## 🆘 Need Help?

If you encounter issues during rotation:

1. **Check application logs** for specific error messages
2. **Verify credential format** matches the examples in `.env.example`
3. **Review rotation procedures** in `docs/KEY_ROTATION.md`
4. **Test in development** before deploying to production
5. **Contact provider support** if you can't access your dashboard

---

## 🎯 Summary

**What happened:** Live production credentials were removed from `.env` to prevent security exposure.

**What you need to do:** Rotate API keys at provider dashboards and update `.env` with new credentials.

**Priority:** HIGH - Your application features depending on these services will not work until completed.

**Timeline:** Complete ASAP - Ideally within 24 hours.

---

**Status:** 🔴 Action Required - 4 manual rotations needed

Last Updated: 2026-03-10
