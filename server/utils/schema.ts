import { prisma } from './db'

let purchaseTableReady: Promise<void> | null = null

export async function ensurePurchaseTable() {
  if (!purchaseTableReady) purchaseTableReady = createPurchaseTableIfMissing().catch((error) => {
    purchaseTableReady = null
    throw error
  })
  return purchaseTableReady
}

async function createPurchaseTableIfMissing() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Purchase" (
      "id" TEXT NOT NULL,
      "sellerName" TEXT NOT NULL,
      "sellerPhone" TEXT,
      "carName" TEXT NOT NULL,
      "brand" TEXT,
      "model" TEXT,
      "year" INTEGER,
      "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
      "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
      "remainingAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
      "currency" "Currency" NOT NULL DEFAULT 'IQD',
      "durationDays" INTEGER NOT NULL DEFAULT 0,
      "fromDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "dueDate" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "notes" TEXT,
      "imageUrls" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
    );
  `)

  const statements = [
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "sellerName" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "sellerPhone" TEXT`,
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "carName" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "brand" TEXT`,
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "model" TEXT`,
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "year" INTEGER`,
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0`,
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0`,
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "remainingAmount" DECIMAL(65,30) NOT NULL DEFAULT 0`,
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "currency" "Currency" NOT NULL DEFAULT 'IQD'`,
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "durationDays" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "fromDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3)`,
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'OPEN'`,
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "imageUrls" JSONB`,
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  ]

  for (const sql of statements) await prisma.$executeRawUnsafe(sql)
}
