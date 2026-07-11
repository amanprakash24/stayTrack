-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "roomType" TEXT;

-- AlterTable
ALTER TABLE "Hotel" ADD COLUMN     "deluxeRooms" INTEGER,
ADD COLUMN     "standardRooms" INTEGER;
