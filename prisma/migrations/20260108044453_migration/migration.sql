-- CreateEnum
CREATE TYPE "SchedulingStrategy" AS ENUM ('STREAM', 'WAVE');

-- AlterTable
ALTER TABLE "DoctorScheduleRule" ADD COLUMN     "strategy" "SchedulingStrategy" NOT NULL DEFAULT 'STREAM',
ADD COLUMN     "waveCapacity" INTEGER,
ADD COLUMN     "waveEveryMin" INTEGER,
ADD COLUMN     "wavePattern" JSONB;
