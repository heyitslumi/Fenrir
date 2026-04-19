/*
  Warnings:

  - You are about to drop the column `eggId` on the `Egg` table. All the data in the column will be lost.
  - You are about to drop the column `nestId` on the `Egg` table. All the data in the column will be lost.
  - You are about to drop the column `remoteId` on the `Location` table. All the data in the column will be lost.
  - You are about to drop the column `pterodactylId` on the `UserResources` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[remoteUuid]` on the table `Egg` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[remoteUuid]` on the table `Location` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[emailToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `nestUuid` to the `Egg` table without a default value. This is not possible if the table is not empty.
  - Added the required column `remoteUuid` to the `Egg` table without a default value. This is not possible if the table is not empty.
  - Added the required column `remoteUuid` to the `Location` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Location_remoteId_key";

-- AlterTable
ALTER TABLE "Egg" DROP COLUMN "eggId",
DROP COLUMN "nestId",
ADD COLUMN     "dockerImages" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "nestUuid" TEXT NOT NULL,
ADD COLUMN     "remoteUuid" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Location" DROP COLUMN "remoteId",
ADD COLUMN     "remoteUuid" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailToken" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserResources" DROP COLUMN "pterodactylId",
ADD COLUMN     "calagopusId" TEXT;

-- CreateTable
CREATE TABLE "Passkey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "deviceType" TEXT NOT NULL DEFAULT 'singleDevice',
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "name" TEXT NOT NULL DEFAULT 'My Passkey',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL,
    "remoteUuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fqdn" TEXT NOT NULL,
    "memory" INTEGER NOT NULL DEFAULT 0,
    "disk" INTEGER NOT NULL DEFAULT 0,
    "locationUuid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Passkey_credentialId_key" ON "Passkey"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "Node_remoteUuid_key" ON "Node"("remoteUuid");

-- CreateIndex
CREATE UNIQUE INDEX "Egg_remoteUuid_key" ON "Egg"("remoteUuid");

-- CreateIndex
CREATE UNIQUE INDEX "Location_remoteUuid_key" ON "Location"("remoteUuid");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailToken_key" ON "User"("emailToken");

-- AddForeignKey
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
