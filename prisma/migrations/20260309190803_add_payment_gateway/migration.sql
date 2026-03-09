-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('KASHIER', 'STRIPE', 'PAYPAL');

-- AlterTable: Add payment gateway fields to subscriptions
ALTER TABLE "subscriptions"
  ADD COLUMN "paymentGateway" "PaymentGateway" NOT NULL DEFAULT 'KASHIER',
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "paypalSubscriptionId" TEXT,
  ADD COLUMN "paypalOrderId" TEXT;

-- AlterTable: Add payment gateway fields to invoices
ALTER TABLE "invoices"
  ADD COLUMN "paymentGateway" "PaymentGateway" NOT NULL DEFAULT 'KASHIER',
  ADD COLUMN "stripeInvoiceId" TEXT,
  ADD COLUMN "stripePaymentIntentId" TEXT,
  ADD COLUMN "paypalOrderId" TEXT,
  ADD COLUMN "paypalCaptureId" TEXT;

-- CreateIndex: Add unique constraints for Stripe IDs
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");
CREATE UNIQUE INDEX "subscriptions_paypalSubscriptionId_key" ON "subscriptions"("paypalSubscriptionId");
CREATE UNIQUE INDEX "invoices_stripeInvoiceId_key" ON "invoices"("stripeInvoiceId");
CREATE UNIQUE INDEX "invoices_paypalOrderId_key" ON "invoices"("paypalOrderId");
