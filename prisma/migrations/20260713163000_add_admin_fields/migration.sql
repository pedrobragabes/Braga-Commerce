-- AlterTable
ALTER TABLE "User" ADD COLUMN "authUserId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "stockQuantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "internalNote" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");

-- CreateIndex
CREATE INDEX "User_storeId_role_idx" ON "User"("storeId", "role");
