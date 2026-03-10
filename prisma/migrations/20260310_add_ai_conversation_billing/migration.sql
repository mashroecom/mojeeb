-- AlterTable: Add AI conversation billing fields to subscriptions table
ALTER TABLE "subscriptions" ADD COLUMN "aiConversationsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "subscriptions" ADD COLUMN "aiConversationsLimit" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "subscriptions" ADD COLUMN "spendingCapEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscriptions" ADD COLUMN "spendingCapAmount" DECIMAL(10,2);
ALTER TABLE "subscriptions" ADD COLUMN "overageChargesAccrued" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable: Add AI conversation billing fields to plan_configs table
ALTER TABLE "plan_configs" ADD COLUMN "aiConversationsPerMonth" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "plan_configs" ADD COLUMN "overagePricePerConversation" DOUBLE PRECISION NOT NULL DEFAULT 0;
