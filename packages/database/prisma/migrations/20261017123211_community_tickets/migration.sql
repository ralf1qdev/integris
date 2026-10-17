-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "CommunityTicket" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "threadId" TEXT NOT NULL,
    "openerId" TEXT NOT NULL,
    "openerName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,

    CONSTRAINT "CommunityTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityTicket_threadId_key" ON "CommunityTicket"("threadId");

-- CreateIndex
CREATE INDEX "CommunityTicket_guildId_openerId_status_idx" ON "CommunityTicket"("guildId", "openerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityTicket_guildId_number_key" ON "CommunityTicket"("guildId", "number");
