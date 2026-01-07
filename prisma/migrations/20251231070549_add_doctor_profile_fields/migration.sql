/*
  Warnings:

  - Added the required column `endAt` to the `AvailabilitySlot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startAt` to the `AvailabilitySlot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AvailabilitySlot" ADD COLUMN     "endAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "startAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "experienceYears" INTEGER,
ADD COLUMN     "specialization" TEXT;
