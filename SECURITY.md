# Mojeeb Security Policy

**Last Updated:** 2026-03-10
**Version:** 1.0

---

## Table of Contents

1. [Secret Management](#secret-management)
2. [Environment Variables Security](#environment-variables-security)
3. [Secret Rotation Procedures](#secret-rotation-procedures)
4. [Vault & Secret Management Tools](#vault--secret-management-tools)
5. [Incident Response](#incident-response)
6. [Security Audit](#security-audit)
7. [Reporting Vulnerabilities](#reporting-vulnerabilities)

---

## Secret Management

### Overview

Mojeeb handles sensitive credentials for multiple third-party services including:

- **AI Providers:** OpenAI, Anthropic
- **Payment Processors:** Kashier, Stripe, PayPal
- **Communication Platforms:** Meta (WhatsApp, Messenger, Instagram)
- **Authentication:** JWT secrets, Google OAuth
- **Infrastructure:** Database, Redis, encryption keys

**Critical:** Never commit secrets to version control, even in private repositories.

### Secret Classification

| Level | Examples | Storage Requirements |
|-------|----------|---------------------|
| **CRITICAL** | `ENCRYPTION_KEY`, `JWT_SECRET`, Database passwords | Vault + restricted access + audit logging |
| **HIGH** | Payment API keys (Kashier, Stripe, PayPal), AI API keys | Vault + team access + rotation policy |
| **MEDIUM** | Meta tokens, Email API keys, OAuth credentials | Vault + rotation on departure |
| **LOW** | Feature flags, non-sensitive config | Environment variables OK |

### Best Practices

1. **Use Strong Secrets**
   ```bash
   # Generate JWT_SECRET (48 bytes, base64)
   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

   # Generate ENCRYPTION_KEY (32 bytes, hex)
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

   # Generate database/Redis passwords (32 bytes, base64)
   openssl rand -base64 32
   ```

2. **Never Use Placeholder Values in Production**
   - ❌ `JWT_SECRET=your-jwt-secret-change-in-production`
   - ❌ `ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`
   - ✅ Generate unique, random secrets for each environment

3. **Principle of Least Privilege**
   - Developers: Read-only access to development secrets
   - CI/CD: Only secrets needed for deployment
   - Production: Restrict to ops team + service accounts

4. **Secret Scope**
   - Use different secrets for dev/staging/production
   - Never share production secrets across environments
   - Rotate immediately if a secret is used in wrong environment

---

## Environment Variables Security

### .env File Protection

The `.env` file contains production credentials and must be protected:

1. **Local Development**
   ```bash
   # Set restrictive permissions (owner read/write only)
   chmod 600 .env

   # Verify .env is in .gitignore
   grep -q "^\.env$" .gitignore || echo ".env" >> .gitignore
   ```

2. **Never Commit .env**
   - `.env` is in `.gitignore` — verify before every commit
   - Use `.env.example` for documenting required variables (no real values)
   - Use pre-commit hooks to block accidental commits:
     ```bash
     # Example pre-commit hook
     if git diff --cached --name-only | grep -q "^\.env$"; then
       echo "ERROR: Attempting to commit .env file"
       exit 1
     fi
     ```

3. **Backup Security**
   - Exclude `.env` from automated backups
   - If backups include `.env`, encrypt backup volumes
   - Store backup encryption keys separately from secrets

### Production Deployment

**Never use .env files in production.** Use one of these methods:

1. **Environment Variables (Docker/Kubernetes)**
   ```yaml
   # docker-compose.prod.yml
   services:
     api:
       environment:
         - JWT_SECRET=${JWT_SECRET}  # Passed from host or orchestrator
         - DATABASE_URL=${DATABASE_URL}
   ```

2. **Secret Management Service**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault
   - Google Cloud Secret Manager

3. **CI/CD Secret Injection**
   - GitHub Actions Secrets
   - GitLab CI/CD Variables
   - Jenkins Credentials

### Required Secrets Checklist

See `.env.example` for full list. Critical secrets that MUST be set:

- [ ] `JWT_SECRET` — Generated, not placeholder
- [ ] `ENCRYPTION_KEY` — 64 hex characters (32 bytes)
- [ ] `DATABASE_URL` — Strong password, not `password`
- [ ] `REDIS_URL` — Strong password, not `devpassword`
- [ ] `POSTGRES_PASSWORD` — For docker-compose.prod.yml
- [ ] `REDIS_PASSWORD` — For docker-compose.prod.yml

---

## Secret Rotation Procedures

### When to Rotate

**Immediate rotation required:**
- Secret committed to version control (even if reverted)
- Secret exposed in logs, error messages, or monitoring tools
- Employee with secret access departs
- Suspected compromise or unauthorized access
- Third-party service breach affecting your credentials

**Scheduled rotation:**
- **CRITICAL secrets:** Every 90 days
- **HIGH secrets:** Every 180 days
- **MEDIUM secrets:** Annually or on team changes

### Rotation Process

#### 1. JWT_SECRET Rotation

**Impact:** All active sessions will be invalidated

```bash
# 1. Generate new secret
NEW_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")

# 2. Update environment (zero-downtime: support both old and new)
#    Modify auth.service.ts to accept array of secrets for verification
#    Deploy with JWT_SECRET="new_secret,old_secret"

# 3. Wait for max token lifetime (7 days for refresh tokens)

# 4. Remove old secret
#    Update to JWT_SECRET="new_secret"
```

#### 2. ENCRYPTION_KEY Rotation

**Impact:** Requires re-encrypting all encrypted data

```bash
# 1. Generate new key
NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 2. Add to environment as ENCRYPTION_KEY_NEW

# 3. Run migration script to re-encrypt data
npm run migrate:re-encrypt

# 4. Swap keys: ENCRYPTION_KEY=new, ENCRYPTION_KEY_OLD=old

# 5. After verification, remove old key
```

#### 3. Database Password Rotation

```bash
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# 2. Connect to database, create new password
psql $DATABASE_URL -c "ALTER USER mojeeb WITH PASSWORD 'new_password';"

# 3. Update DATABASE_URL in secrets management system

# 4. Restart application pods/containers (rolling restart for zero downtime)

# 5. Verify old password no longer works
```

#### 4. Third-Party API Keys (OpenAI, Anthropic, Stripe, etc.)

```bash
# 1. Generate new API key in provider dashboard
#    - OpenAI: https://platform.openai.com/api-keys
#    - Anthropic: https://console.anthropic.com/settings/keys
#    - Stripe: https://dashboard.stripe.com/apikeys

# 2. Update environment variable with new key

# 3. Deploy/restart application

# 4. Verify new key works (check logs, test API call)

# 5. Revoke old key in provider dashboard

# 6. Monitor for 24 hours for errors using old key
```

#### 5. OAuth Credentials (Google)

```bash
# 1. Create new OAuth client in Google Cloud Console
#    https://console.cloud.google.com/apis/credentials

# 2. Update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

# 3. Deploy application

# 4. Update OAuth consent screen if needed

# 5. Delete old OAuth client after 30 days
```

### Rotation Verification

After rotating any secret:

1. **Functionality Check**
   - Test authentication flows
   - Verify API calls to affected services
   - Check encrypted data read/write

2. **Log Monitoring**
   ```bash
   # Check for authentication errors
   grep -i "unauthorized\|forbidden\|invalid.*key" logs/app.log

   # Check for API errors
   grep -i "openai\|anthropic\|stripe.*error" logs/app.log
   ```

3. **Revoke Old Secret**
   - Only after verifying new secret works
   - Monitor for 24-48 hours after revocation

---

## Vault & Secret Management Tools

### Recommended Solutions

#### For Production (Ranked)

1. **HashiCorp Vault** (Recommended for self-hosted)
   - **Pros:** Open source, dynamic secrets, detailed audit logs, encryption as a service
   - **Cons:** Complex setup, requires dedicated infrastructure
   - **Best for:** Self-hosted deployments, multi-cloud
   - **Setup:** See [vault-setup.md](./docs/vault-setup.md) (if created)

2. **AWS Secrets Manager** (Recommended for AWS)
   - **Pros:** Managed service, automatic rotation, IAM integration
   - **Cons:** AWS-only, cost per secret
   - **Best for:** AWS-hosted Mojeeb deployments

3. **Doppler** (Recommended for teams)
   - **Pros:** Developer-friendly, sync to any platform, audit logs, secret references
   - **Cons:** Third-party dependency, cost scales with team size
   - **Best for:** Fast setup, multi-environment management

4. **Azure Key Vault** / **Google Cloud Secret Manager**
   - **Best for:** Cloud-specific deployments

#### For Development

- **dotenv + encrypted .env files:** Use `dotenv-vault` or `git-crypt`
- **1Password / Bitwarden:** Team password managers with CLI access
- **Environment variable managers:** `direnv`, `envchain`

### Migration to Vault

**Phase 1: Non-Production (Week 1)**
```bash
# 1. Set up Vault server (or cloud service)
# 2. Store development/staging secrets
# 3. Update docker-compose.yml to fetch from Vault
# 4. Test application startup and secret access
```

**Phase 2: Production (Week 2-3)**
```bash
# 1. Audit all production secrets
# 2. Rotate all secrets (see rotation procedures)
# 3. Store new secrets in Vault
# 4. Update production deployment to use Vault
# 5. Deploy with rolling restart
# 6. Remove .env files from production servers
```

**Phase 3: Automation (Week 4+)**
```bash
# 1. Enable automatic secret rotation
# 2. Set up audit log monitoring
# 3. Configure alerts for secret access anomalies
# 4. Document runbooks for secret management
```

---

## Incident Response

### Compromised Secret Detection

**Signs of compromise:**
- Unexpected API usage spikes (check OpenAI/Anthropic dashboards)
- Unauthorized transactions (check Stripe/PayPal/Kashier)
- Failed authentication attempts with valid tokens
- Database connections from unknown IPs
- Alerts from secret scanning tools (GitHub, GitGuardian, TruffleHog)

### Response Procedure

**Priority 1: Contain (Within 1 hour)**

1. **Identify Scope**
   ```bash
   # What secret was exposed?
   # Where was it exposed? (git, logs, Slack, email, etc.)
   # When was it exposed?
   # Who had access?
   ```

2. **Revoke Immediately**
   - Revoke the compromised secret in provider dashboard
   - For JWT_SECRET: Force logout all users, rotate secret
   - For ENCRYPTION_KEY: Isolate affected systems, prepare for re-encryption
   - For database credentials: Change password immediately

3. **Block Unauthorized Access**
   - Review access logs for suspicious activity
   - Block suspicious IP addresses
   - Enable stricter rate limiting
   - Require MFA for sensitive operations

**Priority 2: Assess (Within 4 hours)**

1. **Damage Assessment**
   - Check AI provider usage logs (OpenAI/Anthropic)
   - Review payment processor transactions (Stripe/PayPal/Kashier)
   - Audit database query logs
   - Check for data exfiltration (unusual SELECT queries)

2. **Timeline Reconstruction**
   ```bash
   # When was secret exposed?
   git log -p -S "sk-proj-" --all  # Search git history

   # When was it potentially used by attacker?
   # Check application logs, provider dashboards
   ```

**Priority 3: Recover (Within 24 hours)**

1. **Rotate All Related Secrets**
   - Follow rotation procedures above
   - Rotate ALL secrets in same environment (assume lateral movement)

2. **Deploy Fixes**
   ```bash
   # Remove secret from git history if committed
   git filter-branch --tree-filter 'sed -i "/SECRET_VALUE/d" .env' HEAD
   # Or use BFG Repo-Cleaner for large repos

   # Update .gitignore, add pre-commit hooks
   # Deploy with new secrets
   ```

3. **Notify Stakeholders**
   - Internal: Engineering, security, management
   - External: Affected customers (if data breach), providers (if ToS violation)
   - Regulatory: GDPR/compliance requirements if PII exposed

**Priority 4: Learn (Within 1 week)**

1. **Post-Incident Review**
   - Root cause analysis
   - Timeline of events
   - What went wrong?
   - What went right?

2. **Prevent Recurrence**
   - Update security policies
   - Implement automated secret scanning (pre-commit, CI/CD)
   - Add monitoring/alerting for similar incidents
   - Team training on secret management

### Incident Checklist Template

```markdown
**Incident ID:** INC-YYYY-MM-DD-###
**Detected:** YYYY-MM-DD HH:MM UTC
**Severity:** CRITICAL / HIGH / MEDIUM / LOW

- [ ] Secret identified and documented
- [ ] Secret revoked in provider system
- [ ] Access logs reviewed
- [ ] Damage assessment completed
- [ ] All related secrets rotated
- [ ] Unauthorized access blocked
- [ ] Fixes deployed to production
- [ ] Stakeholders notified
- [ ] Post-incident review completed
- [ ] Prevention measures implemented

**Root Cause:**
**Impact:**
**Resolution:**
```

---

## Security Audit

Mojeeb undergoes regular security audits. The latest audit report is available at [AUDIT-REPORT.md](./AUDIT-REPORT.md).

**Key findings related to secret management:**

1. **Weak JWT Secret** — Placeholder value (`your-jwt-secret-change-in-production`) allows token forgery
   - **Status:** CRITICAL — Must be fixed before production
   - **Remediation:** Generate strong secret using procedures above

2. **Example Encryption Key** — Example value allows decrypting all stored credentials
   - **Status:** CRITICAL — Must be fixed before production
   - **Remediation:** Generate new key, re-encrypt data

3. **Live API Keys in .env** — Production OpenAI, Anthropic, Kashier credentials in plaintext
   - **Status:** HIGH — Rotate keys, migrate to vault
   - **Remediation:** Follow rotation procedures, implement vault

4. **No Secret Rotation Policy** — Secrets never rotated since project inception
   - **Status:** MEDIUM — Implement rotation schedule
   - **Remediation:** Follow procedures in this document

See full audit report for additional findings.

---

## Reporting Vulnerabilities

### Responsible Disclosure

If you discover a security vulnerability in Mojeeb:

1. **DO NOT** open a public GitHub issue
2. **DO NOT** disclose publicly until we've had a chance to fix
3. **Email:** security@mojeeb.app (create if doesn't exist)
4. **Include:**
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Your contact information (optional for credit)

### Response Timeline

- **Within 24 hours:** Initial acknowledgment
- **Within 7 days:** Severity assessment and fix timeline
- **Within 30 days:** Fix deployed (for HIGH/CRITICAL)
- **After fix:** Public disclosure coordinated with reporter

### Bug Bounty

We appreciate responsible security research. While we don't currently have a formal bug bounty program, we recognize security researchers in our SECURITY-CREDITS.md file (with permission) and may offer rewards for significant findings.

---

## Additional Resources

- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [NIST Guidelines for Cryptographic Key Management](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)
- [12-Factor App: Config](https://12factor.net/config)
- [`.env.example`](./.env.example) — Template for required environment variables

---

**Document Owner:** Security Team
**Review Schedule:** Quarterly
**Next Review:** 2026-06-10
