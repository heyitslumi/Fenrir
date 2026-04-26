-- AlterTable
ALTER TABLE "Egg"
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "packageIds" JSONB NOT NULL DEFAULT '[]';
