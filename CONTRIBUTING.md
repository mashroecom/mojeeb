# Contributing to Mojeeb

## Development Workflow

### Database Schema Changes

When making changes to the Prisma schema (`prisma/schema.prisma`), **ALWAYS** follow these steps:

1. **Make your schema changes** in `prisma/schema.prisma`

2. **Generate the Prisma Client immediately**:
   ```bash
   pnpm db:generate
   ```

   This regenerates the TypeScript types and client in `node_modules/@prisma/client/`.

   **⚠️ CRITICAL**: Skipping this step will cause TypeScript errors throughout the codebase, as the Prisma Client types won't match your schema.

3. **Create and apply the migration**:
   ```bash
   pnpm db:push
   # OR for production migrations:
   npx prisma migrate dev --name descriptive_migration_name
   ```

4. **Verify the build**:
   ```bash
   pnpm tsc --noEmit
   ```

   Ensure there are no TypeScript errors related to your changes.

### Verification Checklist

Before committing database schema changes, verify:

- [ ] Prisma client generated: `wc -l node_modules/@prisma/client/schema.prisma` matches `wc -l prisma/schema.prisma`
- [ ] TypeScript compilation passes: `pnpm tsc --noEmit` shows 0 errors for your changes
- [ ] Migration applied: `npx prisma migrate status` shows "Database schema is up to date"
- [ ] Tests pass: `pnpm test`

### Common Issues

**Problem**: TypeScript errors like `Property 'myNewModel' does not exist on type 'PrismaClient'`

**Solution**: You forgot to run `pnpm db:generate`. Run it now and the errors will disappear.

---

**Problem**: Migration applied but TypeScript still shows errors

**Solution**: Clear your TypeScript cache and regenerate:
```bash
rm -rf node_modules/.cache
pnpm db:generate
```

---

## Testing

### Running E2E Tests

The project includes automated E2E test scripts for crawl functionality:

1. **Start all required services**:
   ```bash
   # Terminal 1: Database & Redis
   docker-compose up -d postgres redis

   # Terminal 2: API server
   cd apps/api && pnpm dev

   # Terminal 3: Worker (REQUIRED for crawl jobs)
   cd apps/api && pnpm worker
   ```

2. **Run E2E tests**:
   ```bash
   # Single page crawl test
   tsx test-crawl-e2e.ts

   # Multi-page crawl test
   tsx test-crawl-multipage-e2e.ts

   # Scheduled crawl test
   tsx test-crawl-scheduled-e2e.ts
   ```

3. **Expected output**: All tests should pass with ✅ indicators and 100% success rate.

### UI Visual Verification

For UI component changes, verify:

1. **Start the frontend**:
   ```bash
   cd apps/web && pnpm dev
   ```

2. **Navigate to** http://localhost:3000/knowledge-base

3. **Check**:
   - UI components render correctly
   - No console errors (press F12)
   - Forms submit successfully
   - Real-time updates work

---

## Build Process

### Pre-commit Checks

Before committing, run:

```bash
# Lint code
pnpm lint

# Type check
pnpm tsc --noEmit

# Run tests
pnpm test
```

### CI/CD Pipeline

The CI/CD pipeline automatically:

1. Runs TypeScript type checking
2. Executes all unit tests
3. Verifies Prisma schema is valid
4. Checks for security vulnerabilities

**Note**: The pipeline does NOT automatically regenerate the Prisma client. You must do this locally before committing.

---

## Getting Help

If you encounter issues:

1. Check the [README.md](./README.md) for setup instructions
2. Review the [E2E Test Guide](./.auto-claude/specs/041-knowledge-base-url-scraping-auto-sync/E2E_TEST_GUIDE.md) for testing procedures
3. Open an issue with:
   - Steps to reproduce
   - Error messages
   - Environment details (OS, Node version, pnpm version)
