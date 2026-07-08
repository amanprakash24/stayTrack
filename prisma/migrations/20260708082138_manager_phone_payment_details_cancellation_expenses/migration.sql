-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'ONLINE', 'UPI', 'BANK');

-- CreateEnum
CREATE TYPE "RefundType" AS ENUM ('FULL', 'PARTIAL', 'NONE');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "advanceMode" "PaymentMode",
ADD COLUMN     "advanceReceivedBy" TEXT,
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "refundBy" TEXT,
ADD COLUMN     "refundMode" "PaymentMode",
ADD COLUMN     "refundType" "RefundType";

-- AlterTable
ALTER TABLE "Hotel" ADD COLUMN     "managerPhone" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "mode" "PaymentMode",
ADD COLUMN     "receivedBy" TEXT;

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hotelId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "spentBy" TEXT NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'CASH',
    "bookingId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
