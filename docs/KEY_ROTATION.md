# Key Rotation Guide

This document provides step-by-step procedures for rotating all credential types used in the Mojeeb application.

## Table of Contents

- [Overview](#overview)
- [Rotation Schedule](#rotation-schedule)
- [Critical Credentials](#critical-credentials)
  - [JWT_SECRET](#jwt_secret)
  - [ENCRYPTION_KEY](#encryption_key)
  - [Database Credentials](#database-credentials)
  - [Redis Credentials](#redis-credentials)
- [External API Keys](#external-api-keys)
  - [AI Provider Keys](#ai-provider-keys)
  - [Email Service Keys](#email-service-keys)
  - [OAuth Credentials](#oauth-credentials)
- [Platform Integration Tokens](#platform-integration-tokens)
  - [Meta Platform Tokens](#meta-platform-tokens)
  - [Payment Provider Keys](#payment-provider-keys)
- [Emergency Rotation](#emergency-rotation)
- [Rollback Procedures](#rollback-procedures)

---

## Overview

Key rotation is a critical security practice that limits the impact of compromised credentials. This guide categorizes credentials by their rotation complexity and downtime requirements.

**Credential Categories:**
- **Critical Credentials**: Require application restart, may cause downtime
- **External API Keys**: Can be rotated with zero downtime using dual-key periods
- **Platform Tokens**: Provider-specific rotation procedures

**General Principles:**
1. Always test rotation procedures in staging first
2. Schedule rotations during low-traffic periods
3. Keep backup credentials until rotation is verified
4. Document rotation in incident logs
5. Notify relevant team members before rotating critical credentials

---

## Rotation Schedule

| Credential Type | Recommended Frequency | Requires Downtime |
|-----------------|----------------------|-------------------|
| JWT_SECRET | Annually or on compromise | Yes (brief) |
| ENCRYPTION_KEY | Never (requires data migration) | N/A |
| Database Password | Quarterly | Yes (brief) |
| Redis Password | Quarterly | Yes (brief) |
| AI Provider Keys | Annually or on compromise | No |
| Email API Keys | Annually or on compromise | No |
| OAuth Credentials | On compromise only | Partial |
| Meta Tokens | 60 days (auto-expiry) | No |
| Payment Provider Keys | Annually or on compromise | No |

---

## Critical Credentials

### JWT_SECRET

**Impact:** Invalidates all active user sessions
**Downtime:** ~1-2 minutes (app restart)
**Recommended Schedule:** Annually or immediately on compromise

#### When to Rotate

- Suspected compromise or exposure
- Annual security review
- Developer with access leaves team
- Compliance requirements

#### Pre-Rotation Checklist

- [ ] Notify team of upcoming session invalidation
- [ ] Schedule during low-traffic period
- [ ] Verify staging environment works with new secret
- [ ] Prepare user communication about re-login
- [ ] Have rollback plan ready

#### Rotation Procedure

1. **Generate new secret:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
   ```

2. **Update production environment:**
   ```bash
   # For Docker deployments
   docker exec -it mojeeb-api sh
   echo "JWT_SECRET=<new-secret>" >> /app/.env

   # For managed hosting (update secrets manager)
   # AWS: aws secretsmanager update-secret --secret-id mojeeb/jwt_secret --secret-string "<new-secret>"
   # GCP: gcloud secrets versions add jwt_secret --data-file=<(echo -n "<new-secret>")
   ```

3. **Restart application:**
   ```bash
   docker-compose restart api
   # Or for Kubernetes: kubectl rollout restart deployment/mojeeb-api
   ```

4. **Verify rotation:**
   ```bash
   # Old tokens should be rejected
   curl -H "Authorization: Bearer <old-token>" https://api.mojeeb.app/api/v1/me
   # Should return 401 Unauthorized

   # New login should work
   curl -X POST https://api.mojeeb.app/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password"}'
   ```

#### Downtime Considerations

- **Duration:** 1-2 minutes during restart
- **Impact:** All users must re-login
- **Mitigation:**
  - Schedule during lowest traffic period
  - Send advance notification to users
  - Use graceful shutdown (30s timeout)

#### Rollback Procedure

If issues occur:

1. **Restore old secret:**
   ```bash
   docker exec -it mojeeb-api sh
   # Replace JWT_SECRET with backed-up value
   sed -i 's/JWT_SECRET=.*/JWT_SECRET=<old-secret>/' /app/.env
   ```

2. **Restart application:**
   ```bash
   docker-compose restart api
   ```

3. **Verify old sessions work:**
   ```bash
   curl -H "Authorization: Bearer <old-token>" https://api.mojeeb.app/api/v1/me
   # Should return 200 OK
   ```

---

### ENCRYPTION_KEY

**Impact:** Cannot decrypt existing data
**Downtime:** N/A - requires data migration
**Recommended Schedule:** Never rotate without migration plan

#### Important Notice

⚠️ **DO NOT ROTATE ENCRYPTION_KEY** without a comprehensive data migration plan. This key encrypts sensitive data at rest. Rotating it will make existing encrypted data unreadable.

#### When Rotation Is Required

- Key compromise (requires immediate data migration)
- Cryptographic weakness discovered in algorithm
- Compliance mandate

#### Migration Procedure (If Absolutely Necessary)

This is a multi-step process requiring significant downtime:

1. **Pre-migration:**
   - [ ] Full database backup
   - [ ] List all encrypted fields (check models for encrypted columns)
   - [ ] Test migration on complete database copy
   - [ ] Schedule maintenance window (estimate 1 hour per 100k records)

2. **Generate new key:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Migration script:**
   ```typescript
   // Run in maintenance mode with old + new keys available
   import { decryptWithOldKey, encryptWithNewKey } from './crypto-utils';

   async function migrateEncryptedData() {
     const records = await db.getAllRecordsWithEncryptedFields();

     for (const record of records) {
       const decrypted = decryptWithOldKey(record.encryptedField);
       const reencrypted = encryptWithNewKey(decrypted);
       await db.update(record.id, { encryptedField: reencrypted });
     }
   }
   ```

4. **Update ENCRYPTION_KEY in environment**

5. **Restart application**

6. **Verify all encrypted data is accessible**

#### Rollback Procedure

1. Restore database from backup
2. Restore old ENCRYPTION_KEY
3. Restart application

---

### Database Credentials

**Impact:** Database connection lost
**Downtime:** ~2-5 minutes
**Recommended Schedule:** Quarterly

#### Rotation Procedure

**For PostgreSQL in Docker:**

1. **Create new password:**
   ```bash
   openssl rand -base64 32
   ```

2. **Update database user password:**
   ```bash
   docker exec -it mojeeb-postgres psql -U postgres
   # In psql:
   ALTER USER mojeeb WITH PASSWORD '<new-password>';
   \q
   ```

3. **Update DATABASE_URL:**
   ```bash
   # Old: postgresql://mojeeb:oldpass@postgres:5432/mojeeb
   # New: postgresql://mojeeb:newpass@postgres:5432/mojeeb
   docker exec -it mojeeb-api sh
   sed -i 's/DATABASE_URL=.*/DATABASE_URL=postgresql:\/\/mojeeb:<new-password>@postgres:5432\/mojeeb/' /app/.env
   ```

4. **Update POSTGRES_PASSWORD (for Docker Compose):**
   ```bash
   # Update docker-compose.prod.yml or environment file
   POSTGRES_PASSWORD=<new-password>
   ```

5. **Restart API (not database):**
   ```bash
   docker-compose restart api
   ```

6. **Verify connection:**
   ```bash
   docker logs mojeeb-api | grep "Database connected"
   curl https://api.mojeeb.app/api/v1/health
   # Should return healthy status
   ```

#### Downtime Considerations

- **Duration:** 2-5 minutes (API restart + connection pool initialization)
- **Impact:** API requests fail during restart
- **Mitigation:**
  - Use blue-green deployment
  - Or schedule during maintenance window

#### Rollback Procedure

1. **Restore old password in database:**
   ```bash
   docker exec -it mojeeb-postgres psql -U postgres
   ALTER USER mojeeb WITH PASSWORD '<old-password>';
   ```

2. **Restore old DATABASE_URL in API**

3. **Restart API**

---

### Redis Credentials

**Impact:** Cache/session store connection lost
**Downtime:** ~1-2 minutes
**Recommended Schedule:** Quarterly

#### Rotation Procedure

1. **Generate new password:**
   ```bash
   openssl rand -base64 32
   ```

2. **Update Redis password:**
   ```bash
   # For Docker Redis
   docker exec -it mojeeb-redis redis-cli
   # In redis-cli:
   CONFIG SET requirepass <new-password>
   CONFIG REWRITE
   ```

3. **Update REDIS_URL:**
   ```bash
   # Old: redis://:oldpass@redis:6379
   # New: redis://:newpass@redis:6379
   docker exec -it mojeeb-api sh
   sed -i 's/REDIS_URL=.*/REDIS_URL=redis:\/\/:<new-password>@redis:6379/' /app/.env
   ```

4. **Update REDIS_PASSWORD (for Docker Compose):**
   ```bash
   REDIS_PASSWORD=<new-password>
   ```

5. **Restart API:**
   ```bash
   docker-compose restart api
   ```

6. **Verify connection:**
   ```bash
   docker logs mojeeb-api | grep "Redis connected"
   # Test cache operation
   curl https://api.mojeeb.app/api/v1/health
   ```

#### Downtime Considerations

- **Duration:** 1-2 minutes
- **Impact:** Session data temporarily unavailable, users may be logged out
- **Mitigation:**
  - Sessions will be regenerated on next login
  - Cache will rebuild automatically

#### Rollback Procedure

1. **Restore old password in Redis:**
   ```bash
   docker exec -it mojeeb-redis redis-cli
   CONFIG SET requirepass <old-password>
   CONFIG REWRITE
   ```

2. **Restore old REDIS_URL**

3. **Restart API**

---

## External API Keys

### AI Provider Keys

**Impact:** AI features unavailable during rotation
**Downtime:** Zero (with dual-key period)
**Providers:** OpenAI, Anthropic

#### Zero-Downtime Rotation Procedure

Both OpenAI and Anthropic allow multiple active API keys:

1. **Generate new key in provider dashboard:**
   - OpenAI: https://platform.openai.com/api-keys
   - Anthropic: https://console.anthropic.com/settings/keys

2. **Add new key to environment (keep old key for now):**
   ```bash
   # Old key remains active
   OPENAI_API_KEY=<new-key>  # or ANTHROPIC_API_KEY
   ```

3. **Deploy with new key:**
   ```bash
   docker-compose restart api
   ```

4. **Verify new key works:**
   ```bash
   # Test AI features in application
   # Check logs for successful API calls
   docker logs mojeeb-api | grep -i "openai\|anthropic"
   ```

5. **Wait 24 hours for in-flight requests to complete**

6. **Revoke old key in provider dashboard**

#### Rollback Procedure

If new key has issues:

1. Revert to old key in environment
2. Restart application
3. Revoke new key in provider dashboard

---

### Email Service Keys

**Impact:** Email sending fails during rotation
**Downtime:** Zero (with dual-key period)
**Provider:** Resend

#### Rotation Procedure

1. **Generate new API key:**
   - Visit https://resend.com/api-keys
   - Click "Create API Key"
   - Copy new key

2. **Update RESEND_API_KEY:**
   ```bash
   RESEND_API_KEY=<new-key>
   ```

3. **Deploy:**
   ```bash
   docker-compose restart api
   ```

4. **Test email sending:**
   ```bash
   # Trigger test email or password reset
   curl -X POST https://api.mojeeb.app/api/v1/auth/forgot-password \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'
   # Check logs for successful send
   ```

5. **Revoke old key after 24 hours**

#### Rollback Procedure

1. Restore old RESEND_API_KEY
2. Restart application
3. Delete new key from Resend dashboard

---

### OAuth Credentials

**Impact:** OAuth login fails
**Downtime:** Partial (new logins fail, existing sessions work)
**Provider:** Google

#### Rotation Procedure

Google OAuth requires updating both client credentials and redirects:

1. **Generate new credentials:**
   - Visit https://console.cloud.google.com/apis/credentials
   - Create new OAuth 2.0 Client ID
   - Add authorized redirect URIs:
     - `https://mojeeb.app/auth/google/callback`
     - `https://api.mojeeb.app/api/v1/auth/google/callback`

2. **Update environment (keep old credentials active):**
   ```bash
   GOOGLE_CLIENT_ID=<new-client-id>
   GOOGLE_CLIENT_SECRET=<new-client-secret>
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=<new-client-id>
   ```

3. **Deploy frontend and backend:**
   ```bash
   # Backend
   docker-compose restart api

   # Frontend (rebuild with new NEXT_PUBLIC_GOOGLE_CLIENT_ID)
   cd apps/frontend
   npm run build
   docker-compose restart frontend
   ```

4. **Test Google login:**
   - Visit https://mojeeb.app/login
   - Click "Sign in with Google"
   - Complete OAuth flow
   - Verify successful login

5. **Monitor for 24 hours**

6. **Delete old OAuth client in Google Console**

#### Downtime Considerations

- **Impact:** New Google logins fail between deployment steps
- **Duration:** 5-10 minutes (frontend rebuild + deployment)
- **Mitigation:**
  - Schedule during low-traffic period
  - Existing sessions continue to work

#### Rollback Procedure

1. Restore old GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
2. Rebuild and redeploy frontend with old NEXT_PUBLIC_GOOGLE_CLIENT_ID
3. Restart API
4. Delete new OAuth client from Google Console

---

## Platform Integration Tokens

### Meta Platform Tokens

**Impact:** WhatsApp, Messenger, Instagram integrations fail
**Downtime:** Zero (with immediate replacement)
**Tokens:** WHATSAPP_ACCESS_TOKEN, MESSENGER_PAGE_ACCESS_TOKEN, INSTAGRAM_ACCESS_TOKEN

#### Important Notes

- Meta access tokens auto-expire after 60 days
- Tokens can be refreshed before expiry
- Use long-lived tokens (60 days) instead of short-lived (24 hours)

#### Rotation Procedure

**For WhatsApp:**

1. **Generate new token:**
   - Visit https://developers.facebook.com/apps
   - Select your app → WhatsApp → API Setup
   - Click "Generate New Token"
   - Copy temporary token

2. **Exchange for long-lived token:**
   ```bash
   curl "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=<APP_ID>&client_secret=<APP_SECRET>&fb_exchange_token=<SHORT_LIVED_TOKEN>"
   ```

3. **Update environment:**
   ```bash
   WHATSAPP_ACCESS_TOKEN=<new-long-lived-token>
   ```

4. **Deploy:**
   ```bash
   docker-compose restart api
   ```

5. **Verify webhook:**
   ```bash
   # Send test message to WhatsApp number
   # Check logs for successful webhook receipt
   docker logs mojeeb-api | grep "whatsapp"
   ```

**For Messenger and Instagram:** Follow similar procedure using respective platform API setup pages.

#### Proactive Rotation (Before Expiry)

Set up monitoring to alert 7 days before token expiry:

```bash
# Check token expiry
curl "https://graph.facebook.com/debug_token?input_token=<ACCESS_TOKEN>&access_token=<APP_TOKEN>"
# Returns: { "data": { "expires_at": 1234567890 } }
```

#### Rollback Procedure

Meta tokens can't be "rolled back" but you can:

1. Restore old token if still valid (check expiry)
2. Or generate another new token following rotation procedure

---

### Payment Provider Keys

**Impact:** Payment processing fails
**Downtime:** Zero (test in sandbox first)
**Providers:** Kashier, Stripe, PayPal

#### General Rotation Strategy

All payment providers support multiple active API keys for zero-downtime rotation:

1. Generate new key in provider dashboard
2. Update environment with new key
3. Deploy application
4. Monitor transactions for 24-48 hours
5. Revoke old key

#### Stripe Rotation

1. **Generate new secret key:**
   - Visit https://dashboard.stripe.com/apikeys
   - Click "Create secret key"
   - Copy `sk_live_...` key

2. **Update environment:**
   ```bash
   STRIPE_SECRET_KEY=<new-key>
   ```

3. **Update webhook secret (if rotating):**
   - Create new webhook endpoint with new secret
   - Update `STRIPE_WEBHOOK_SECRET=<new-secret>`
   - Or keep existing webhook (recommended)

4. **Deploy:**
   ```bash
   docker-compose restart api
   ```

5. **Test payment:**
   ```bash
   # Process test payment through checkout
   # Verify webhook delivery
   docker logs mojeeb-api | grep "stripe.webhook"
   ```

6. **Monitor Stripe dashboard for errors**

7. **Revoke old key after 48 hours**

#### PayPal Rotation

1. **Generate new credentials:**
   - Visit https://developer.paypal.com/dashboard/applications
   - Create new REST API app or rotate existing app credentials

2. **Update environment:**
   ```bash
   PAYPAL_CLIENT_ID=<new-id>
   PAYPAL_CLIENT_SECRET=<new-secret>
   ```

3. **Deploy and test (same as Stripe)**

#### Kashier Rotation

1. **Contact Kashier support** to rotate merchant credentials (they don't provide self-service rotation)

2. **Receive new credentials**

3. **Update environment:**
   ```bash
   KASHIER_MERCHANT_ID=<new-id>
   KASHIER_API_KEY=<new-key>
   KASHIER_WEBHOOK_SECRET=<new-secret>
   ```

4. **Deploy and test**

#### Downtime Considerations

- **Impact:** Payment processing fails if keys are invalid
- **Mitigation:**
  - Test with sandbox keys first
  - Stripe/PayPal: keep old key active during transition
  - Monitor payment error rates

#### Rollback Procedure

1. Restore old credentials in environment
2. Restart application
3. Delete new credentials from provider dashboard
4. Monitor payment success rate

---

## Emergency Rotation

When credentials are compromised, speed is critical.

### Immediate Actions (Within 1 Hour)

1. **Assess scope:**
   - Which credentials are compromised?
   - What systems are affected?
   - Is there active abuse?

2. **Revoke compromised credentials:**
   - External APIs: Revoke in provider dashboard immediately
   - Internal secrets (JWT, encryption): Prepare for rotation

3. **Enable additional monitoring:**
   ```bash
   # Increase log verbosity
   # Watch for suspicious API usage
   docker logs -f mojeeb-api | grep -i "error\|unauthorized\|forbidden"
   ```

4. **Notify stakeholders:**
   - Security team
   - On-call engineers
   - Affected users (if needed)

### Rotation Priority

Rotate in this order:

1. **Immediately:** External API keys (AI, email, payment)
2. **Within 1 hour:** Platform tokens (Meta, OAuth)
3. **Within 4 hours:** Database/Redis passwords (requires maintenance window)
4. **Within 8 hours:** JWT_SECRET (requires user notification)
5. **Never without migration plan:** ENCRYPTION_KEY

### Post-Incident

1. **Document in incident report:**
   - What was compromised
   - How it was discovered
   - Rotation timeline
   - Impact assessment

2. **Review access logs:**
   - Check for unauthorized usage
   - Identify breach timeline
   - Assess data exposure

3. **Update security procedures:**
   - How was the credential exposed?
   - How can we prevent recurrence?
   - Update rotation schedule if needed

---

## Rollback Procedures

### General Rollback Steps

If rotation causes issues:

1. **Assess impact:**
   ```bash
   # Check application health
   curl https://api.mojeeb.app/api/v1/health

   # Check error logs
   docker logs mojeeb-api --tail 100 | grep -i error

   # Check metrics (if available)
   # - Error rate spike?
   # - Increased latency?
   # - Failed authentication rate?
   ```

2. **Decision point:**
   - Minor issues (< 1% error rate): Monitor and fix forward
   - Major issues (> 5% error rate): Rollback immediately
   - Critical (complete outage): Rollback immediately

3. **Execute rollback:**
   - Restore old credential value
   - Restart affected services
   - Verify restoration

4. **Verify rollback:**
   ```bash
   # Health check
   curl https://api.mojeeb.app/api/v1/health

   # Test critical flows
   # - User login
   # - API requests
   # - External integrations

   # Monitor logs for 15 minutes
   docker logs -f mojeeb-api
   ```

5. **Post-rollback:**
   - Document what went wrong
   - Fix underlying issue
   - Schedule retry

### Credential-Specific Rollback

See individual credential sections above for detailed rollback procedures.

### When Rollback Isn't Possible

Some rotations can't be rolled back:

- **ENCRYPTION_KEY:** Old key may be revoked, data already re-encrypted
- **Meta tokens:** Expired tokens can't be restored
- **OAuth clients:** Deleted clients can't be recovered

**Mitigation:**
- Always keep backups of credentials until rotation is verified
- Test in staging environment first
- Have forward-fix procedures ready

---

## Best Practices

1. **Always test in staging first**
2. **Document every rotation in logs**
3. **Use secrets managers (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault)**
4. **Automate rotation where possible**
5. **Monitor after rotation for 24-48 hours**
6. **Keep audit trail of who rotated what and when**
7. **Schedule rotations during low-traffic periods**
8. **Have rollback plan ready before starting**
9. **Notify team members before rotating critical credentials**
10. **Never commit credentials to Git (use .env files excluded by .gitignore)**

---

## Questions or Issues?

If you encounter issues during rotation:

1. Check application logs: `docker logs mojeeb-api`
2. Verify credential format matches requirements (see `.env.example`)
3. Consult this guide's rollback procedures
4. Contact the security team for emergency support

**Emergency Contacts:**
- Security Team: security@mojeeb.app
- On-Call Engineer: Use PagerDuty escalation
