-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'STAFF';

-- AlterTable
ALTER TABLE "Hotel" ADD COLUMN     "bookingSeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Hotel_code_key" ON "Hotel"("code");
