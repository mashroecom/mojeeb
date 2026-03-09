-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "message_templates" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "contentAr" TEXT NOT NULL DEFAULT '',
    "category" TEXT,
    "shortcut" TEXT,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- AlterTable (add new columns if table already exists)
DO $$
BEGIN
    -- Add titleAr if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'message_templates' AND column_name = 'titleAr'
    ) THEN
        ALTER TABLE "message_templates" ADD COLUMN "titleAr" TEXT NOT NULL DEFAULT '';
    END IF;

    -- Add contentAr if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'message_templates' AND column_name = 'contentAr'
    ) THEN
        ALTER TABLE "message_templates" ADD COLUMN "contentAr" TEXT NOT NULL DEFAULT '';
    END IF;

    -- Add variables if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'message_templates' AND column_name = 'variables'
    ) THEN
        ALTER TABLE "message_templates" ADD COLUMN "variables" TEXT[] DEFAULT ARRAY[]::TEXT[];
    END IF;

    -- Add isShared if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'message_templates' AND column_name = 'isShared'
    ) THEN
        ALTER TABLE "message_templates" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- Add userId if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'message_templates' AND column_name = 'userId'
    ) THEN
        ALTER TABLE "message_templates" ADD COLUMN "userId" TEXT;
    END IF;

    -- Add usageCount if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'message_templates' AND column_name = 'usageCount'
    ) THEN
        ALTER TABLE "message_templates" ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;
    END IF;

    -- Add isActive if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'message_templates' AND column_name = 'isActive'
    ) THEN
        ALTER TABLE "message_templates" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "message_templates_orgId_idx" ON "message_templates"("orgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "message_templates_orgId_isShared_idx" ON "message_templates"("orgId", "isShared");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "message_templates_userId_idx" ON "message_templates"("userId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'message_templates_orgId_fkey'
        AND table_name = 'message_templates'
    ) THEN
        ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'message_templates_userId_fkey'
        AND table_name = 'message_templates'
    ) THEN
        ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
