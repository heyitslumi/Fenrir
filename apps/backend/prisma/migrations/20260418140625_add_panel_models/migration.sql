-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Egg" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Game Servers',
    "logo" TEXT,
    "free" BOOLEAN NOT NULL DEFAULT true,
    "nestId" INTEGER NOT NULL,
    "eggId" INTEGER NOT NULL,
    "dockerImage" TEXT NOT NULL,
    "startup" TEXT NOT NULL,
    "environment" JSONB NOT NULL DEFAULT '{}',
    "featureLimits" JSONB NOT NULL DEFAULT '{}',
    "minRam" INTEGER NOT NULL DEFAULT 256,
    "minDisk" INTEGER NOT NULL DEFAULT 256,
    "minCpu" INTEGER NOT NULL DEFAULT 50,
    "maxRam" INTEGER NOT NULL DEFAULT 8192,
    "maxDisk" INTEGER NOT NULL DEFAULT 10240,
    "maxCpu" INTEGER NOT NULL DEFAULT 200,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Egg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "remoteId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "short" TEXT NOT NULL,
    "country" TEXT,
    "flag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ram" INTEGER NOT NULL DEFAULT 2048,
    "disk" INTEGER NOT NULL DEFAULT 3072,
    "cpu" INTEGER NOT NULL DEFAULT 100,
    "servers" INTEGER NOT NULL DEFAULT 2,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserResources" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "extraRam" INTEGER NOT NULL DEFAULT 0,
    "extraDisk" INTEGER NOT NULL DEFAULT 0,
    "extraCpu" INTEGER NOT NULL DEFAULT 0,
    "extraServers" INTEGER NOT NULL DEFAULT 0,
    "coins" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "packageId" TEXT,
    "pterodactylId" INTEGER,
    "lastDailyClaim" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserResources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreItem" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "per" INTEGER NOT NULL,
    "limit" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Egg_name_key" ON "Egg"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Location_remoteId_key" ON "Location"("remoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Package_name_key" ON "Package"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserResources_userId_key" ON "UserResources"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreItem_resource_key" ON "StoreItem"("resource");

-- AddForeignKey
ALTER TABLE "UserResources" ADD CONSTRAINT "UserResources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserResources" ADD CONSTRAINT "UserResources_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;
