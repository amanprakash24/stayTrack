-- CreateTable
CREATE TABLE "BookingLeg" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "hotelId" TEXT NOT NULL,
    "checkin" TIMESTAMP(3) NOT NULL,
    "checkout" TIMESTAMP(3) NOT NULL,
    "planType" "PlanType" NOT NULL,
    "roomType" TEXT,
    "guests" INTEGER NOT NULL,
    "childGuests" INTEGER NOT NULL DEFAULT 0,
    "childRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rooms" INTEGER NOT NULL,
    "ratePerUnit" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "taxPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingLeg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingLeg_bookingId_idx" ON "BookingLeg"("bookingId");

-- CreateIndex
CREATE INDEX "BookingLeg_hotelId_checkin_checkout_idx" ON "BookingLeg"("hotelId", "checkin", "checkout");

-- AddForeignKey
ALTER TABLE "BookingLeg" ADD CONSTRAINT "BookingLeg_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingLeg" ADD CONSTRAINT "BookingLeg_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every existing Booking was exactly one hotel stay, so it becomes leg 0 of itself
INSERT INTO "BookingLeg"
  (id, "order", "bookingId", "hotelId", checkin, checkout, "planType", "roomType",
   guests, "childGuests", "childRate", rooms, "ratePerUnit", subtotal, "taxPercent",
   "taxAmount", "totalCost", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || id), 0, id, "hotelId", checkin, checkout,
  "planType", "roomType", guests, "childGuests", "childRate", rooms, "ratePerUnit", subtotal,
  "taxPercent", "taxAmount", "totalCost", "createdAt", "updatedAt"
FROM "Booking";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_hotelId_fkey";

-- AlterTable: per-stay fields now live on BookingLeg; subtotal/taxAmount/totalCost stay as
-- booking-level aggregates (already correct 1:1 with the single leg each booking just got)
ALTER TABLE "Booking"
  DROP COLUMN "hotelId",
  DROP COLUMN "checkin",
  DROP COLUMN "checkout",
  DROP COLUMN "planType",
  DROP COLUMN "roomType",
  DROP COLUMN "guests",
  DROP COLUMN "childGuests",
  DROP COLUMN "childRate",
  DROP COLUMN "rooms",
  DROP COLUMN "ratePerUnit",
  DROP COLUMN "taxPercent",
  ALTER COLUMN "subtotal" SET DEFAULT 0,
  ALTER COLUMN "totalCost" SET DEFAULT 0;
