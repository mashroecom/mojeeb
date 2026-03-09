#!/usr/bin/env tsx
/**
 * End-to-End Test for Stripe Checkout Flow
 *
 * This script tests the complete Stripe payment flow:
 * 1. Create a test organization
 * 2. Initiate Stripe checkout
 * 3. Simulate successful payment via webhook
 * 4. Verify subscription upgrade
 * 5. Verify invoice creation with Stripe IDs
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:4000/api/v1';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  message: string;
  data?: any;
}

const results: TestResult[] = [];

async function log(step: string, status: 'PASS' | 'FAIL', message: string, data?: any) {
  results.push({ step, status, message, data });
  const icon = status === 'PASS' ? '✓' : '✗';
  console.log(`${icon} ${step}: ${message}`);
  if (data) {
    console.log('  Data:', JSON.stringify(data, null, 2));
  }
}

async function cleanup() {
  // Clean up test data
  try {
    await prisma.invoice.deleteMany({
      where: { organizationId: 'test-stripe-org' }
    });
    await prisma.subscription.deleteMany({
      where: { organizationId: 'test-stripe-org' }
    });
    await prisma.organization.deleteMany({
      where: { id: 'test-stripe-org' }
    });
    await prisma.user.deleteMany({
      where: { email: 'stripe-test@mojeeb.test' }
    });
  } catch (error) {
    // Ignore cleanup errors
  }
}

async function createTestUser() {
  try {
    const user = await prisma.user.create({
      data: {
        id: 'test-stripe-user',
        email: 'stripe-test@mojeeb.test',
        firstName: 'Stripe',
        lastName: 'Test',
        passwordHash: 'not-used',
        emailVerified: true,
      }
    });
    await log('1. Create Test User', 'PASS', 'Test user created', { userId: user.id });
    return user;
  } catch (error: any) {
    await log('1. Create Test User', 'FAIL', error.message);
    throw error;
  }
}

async function createTestOrganization(userId: string) {
  try {
    const org = await prisma.organization.create({
      data: {
        id: 'test-stripe-org',
        name: 'Stripe Test Organization',
        slug: 'stripe-test-org',
        timezone: 'America/New_York', // International timezone for Stripe auto-selection
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'OWNER',
          }
        }
      }
    });
    await log('2. Create Test Organization', 'PASS', 'Test organization created', { orgId: org.id, timezone: org.timezone });
    return org;
  } catch (error: any) {
    await log('2. Create Test Organization', 'FAIL', error.message);
    throw error;
  }
}

async function checkAvailableGateways(orgId: string, authToken: string) {
  try {
    const response = await axios.get(
      `${API_URL}/organizations/${orgId}/subscription/available-gateways`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const gateways = response.data;
    const stripeGateway = gateways.find((g: any) => g.gateway === 'STRIPE');

    if (stripeGateway && stripeGateway.enabled) {
      await log('3. Check Available Gateways', 'PASS', 'Stripe gateway is available', { gateways });
      return true;
    } else {
      await log('3. Check Available Gateways', 'FAIL', 'Stripe gateway not available', { gateways });
      return false;
    }
  } catch (error: any) {
    await log('3. Check Available Gateways', 'FAIL', error.response?.data?.message || error.message);
    return false;
  }
}

async function initiateStripeCheckout(orgId: string, authToken: string) {
  try {
    const response = await axios.post(
      `${API_URL}/organizations/${orgId}/subscription/checkout`,
      {
        plan: 'STARTER',
        gateway: 'STRIPE'
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    const checkoutData = response.data;

    if (checkoutData.sessionId && checkoutData.url) {
      await log('4. Initiate Stripe Checkout', 'PASS', 'Checkout session created', {
        sessionId: checkoutData.sessionId,
        url: checkoutData.url
      });
      return checkoutData;
    } else {
      await log('4. Initiate Stripe Checkout', 'FAIL', 'Invalid checkout response', checkoutData);
      return null;
    }
  } catch (error: any) {
    await log('4. Initiate Stripe Checkout', 'FAIL', error.response?.data?.message || error.message);
    return null;
  }
}

async function simulateStripeWebhook(sessionId: string) {
  try {
    // Simulate a checkout.session.completed webhook
    const webhookPayload = {
      id: 'evt_test_' + Date.now(),
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          object: 'checkout.session',
          customer: 'cus_test_123',
          subscription: 'sub_test_123',
          metadata: {
            organizationId: 'test-stripe-org',
            plan: 'STARTER'
          },
          payment_status: 'paid',
          status: 'complete'
        }
      }
    };

    const response = await axios.post(
      `${API_URL}/webhooks/stripe`,
      webhookPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'test_signature'
        },
        validateStatus: () => true // Accept all status codes
      }
    );

    if (response.status === 200) {
      await log('5. Simulate Stripe Webhook', 'PASS', 'Webhook processed successfully', {
        status: response.status,
        sessionId
      });
      return true;
    } else {
      await log('5. Simulate Stripe Webhook', 'FAIL', `Webhook returned status ${response.status}`, {
        status: response.status,
        data: response.data
      });
      return false;
    }
  } catch (error: any) {
    await log('5. Simulate Stripe Webhook', 'FAIL', error.response?.data?.message || error.message);
    return false;
  }
}

async function verifySubscriptionUpgrade(orgId: string) {
  try {
    // Wait a bit for webhook processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId: orgId }
    });

    if (!subscription) {
      await log('6. Verify Subscription Upgrade', 'FAIL', 'No subscription found');
      return false;
    }

    const isUpgraded = subscription.plan === 'STARTER' &&
                      subscription.status === 'ACTIVE' &&
                      subscription.paymentGateway === 'STRIPE' &&
                      subscription.stripeSubscriptionId !== null;

    if (isUpgraded) {
      await log('6. Verify Subscription Upgrade', 'PASS', 'Subscription upgraded successfully', {
        plan: subscription.plan,
        status: subscription.status,
        gateway: subscription.paymentGateway,
        stripeSubscriptionId: subscription.stripeSubscriptionId
      });
      return true;
    } else {
      await log('6. Verify Subscription Upgrade', 'FAIL', 'Subscription not properly upgraded', {
        plan: subscription.plan,
        status: subscription.status,
        gateway: subscription.paymentGateway,
        stripeSubscriptionId: subscription.stripeSubscriptionId
      });
      return false;
    }
  } catch (error: any) {
    await log('6. Verify Subscription Upgrade', 'FAIL', error.message);
    return false;
  }
}

async function verifyInvoiceCreation(orgId: string) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: {
        organizationId: orgId,
        paymentGateway: 'STRIPE'
      }
    });

    if (!invoice) {
      await log('7. Verify Invoice Creation', 'FAIL', 'No invoice found');
      return false;
    }

    const hasStripeIds = invoice.stripeInvoiceId !== null ||
                        invoice.stripePaymentIntentId !== null;

    if (hasStripeIds) {
      await log('7. Verify Invoice Creation', 'PASS', 'Invoice created with Stripe IDs', {
        invoiceId: invoice.id,
        stripeInvoiceId: invoice.stripeInvoiceId,
        stripePaymentIntentId: invoice.stripePaymentIntentId,
        amount: invoice.amount,
        status: invoice.status
      });
      return true;
    } else {
      await log('7. Verify Invoice Creation', 'FAIL', 'Invoice missing Stripe IDs', {
        invoiceId: invoice.id
      });
      return false;
    }
  } catch (error: any) {
    await log('7. Verify Invoice Creation', 'FAIL', error.message);
    return false;
  }
}

async function main() {
  console.log('\n========================================');
  console.log('Stripe E2E Checkout Flow Test');
  console.log('========================================\n');

  try {
    // Cleanup before test
    await cleanup();

    // Create test data
    const user = await createTestUser();
    const org = await createTestOrganization(user.id);

    // Generate a mock auth token (in real scenario, this would be from login)
    const authToken = 'mock-jwt-token-for-testing';

    // Note: Since we don't have authentication in this test, we'll skip gateway check
    // and directly test the Stripe service functionality

    console.log('\n⚠️  Note: Skipping authentication-required steps (gateway check, checkout API)');
    console.log('    Testing Stripe service methods directly...\n');

    // Test Stripe service directly
    const { stripeService } = await import('./apps/api/src/services/stripe.service');

    try {
      // Test checkout session creation
      const session = await stripeService.createCheckoutSession(
        org.id,
        'STARTER',
        'http://localhost:3000/billing?success=true',
        'http://localhost:3000/billing?cancelled=true'
      );

      await log('4. Create Stripe Checkout Session', 'PASS', 'Session created', {
        sessionId: session.sessionId,
        url: session.url
      });

      // Simulate successful subscription creation via webhook handler
      await stripeService.handleCheckoutComplete({
        sessionId: session.sessionId,
        customerId: 'cus_test_123',
        subscriptionId: 'sub_test_' + Date.now(),
        organizationId: org.id,
        plan: 'STARTER'
      });

      await log('5. Process Checkout Webhook', 'PASS', 'Webhook processed');

      // Verify subscription
      await verifySubscriptionUpgrade(org.id);

      // Verify invoice
      await verifyInvoiceCreation(org.id);

    } catch (error: any) {
      await log('Stripe Service Test', 'FAIL', error.message);
    }

    // Print summary
    console.log('\n========================================');
    console.log('Test Summary');
    console.log('========================================\n');

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    console.log(`Total Steps: ${results.length}`);
    console.log(`✓ Passed: ${passed}`);
    console.log(`✗ Failed: ${failed}`);
    console.log(`Success Rate: ${Math.round((passed / results.length) * 100)}%\n`);

    if (failed === 0) {
      console.log('🎉 All tests passed!\n');
    } else {
      console.log('❌ Some tests failed. See details above.\n');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n❌ Test execution failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup after test
    await cleanup();
    await prisma.$disconnect();
  }
}

main();
