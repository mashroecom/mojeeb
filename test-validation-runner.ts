#!/usr/bin/env tsx

/**
 * Simple validation tester - this will be called by the main test runner
 * Each test runs in a fresh process to avoid caching issues
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load dotenv first
dotenv.config({ path: path.resolve(__dirname, '.env') });

// FORCE production mode AFTER dotenv loads (so it doesn't get overridden)
process.env.NODE_ENV = 'production';

// Now DYNAMICALLY load and validate config (so it picks up the new NODE_ENV)
async function runValidation() {
  try {
    const { validateConfig } = await import('./apps/api/src/config/index.js');
    validateConfig();
    console.log('VALIDATION_PASSED');
    process.exit(0);
  } catch (error: any) {
    console.log('VALIDATION_FAILED:', error.message);
    process.exit(1);
  }
}

runValidation();
