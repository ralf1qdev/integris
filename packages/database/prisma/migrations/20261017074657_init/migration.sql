-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('BOT', 'WEBHOOK', 'ROLE', 'CHANNEL', 'INTEGRATION', 'GUILD');

-- CreateEnum
CREATE TYPE "IntegrationKind" AS ENUM ('BOT', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('GATEWAY', 'AUDIT_LOG', 'RECONCILIATION', 'DASHBOARD', 'COMMAND', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('BOT_ADDED', 'BOT_REMOVED', 'BOT_PERMISSIONS_CHANGED', 'ROLE_PERMISSIONS_CHANGED', 'PERMISSION_ESCALATION', 'WEBHOOK_CREATED', 'WEBHOOK_UPDATED', 'WEBHOOK_DELETED', 'WEBHOOK_DELETED_BY_INTEGRIS', 'INTEGRATION_CREATED', 'INTEGRATION_UPDATED', 'INTEGRATION_DELETED', 'ALERT_ACKNOWLEDGED', 'ALERT_RESOLVED', 'ALERT_REOPENED', 'FINDING_STATUS_CHANGED', 'TRUST_GRANTED', 'TRUST_REVOKED', 'NOTE_ADDED', 'SETTINGS_UPDATED', 'SCAN_COMPLETED', 'SCAN_FAILED', 'INTEGRIS_INSTALLED', 'INTEGRIS_REMOVED', 'DATA_DELETION_REQUESTED');

-- CreateEnum
CREATE TYPE "ScanTrigger" AS ENUM ('INSTALL', 'DASHBOARD', 'COMMAND', 'SCHEDULED', 'EVENT');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('ACTIVE', 'DELETED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "globalName" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "accessTokenExpiry" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "ownerId" TEXT,
    "botPresent" BOOLEAN NOT NULL DEFAULT false,
    "installedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" "ScanStatus",
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildAccess" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissions" TEXT NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "canManage" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildSettings" (
    "guildId" TEXT NOT NULL,
    "monitoringEnabled" BOOLEAN NOT NULL DEFAULT true,
    "alertChannelId" TEXT,
    "alertMentionRoleId" TEXT,
    "alertMinSeverity" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "alertCooldownMinutes" INTEGER NOT NULL DEFAULT 60,
    "alertOnBotJoin" BOOLEAN NOT NULL DEFAULT true,
    "alertOnWebhookCreate" BOOLEAN NOT NULL DEFAULT true,
    "alertOnWebhookDelete" BOOLEAN NOT NULL DEFAULT true,
    "alertOnPermissionEscalation" BOOLEAN NOT NULL DEFAULT true,
    "restrictedChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "setupCompletedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildSettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "GuildChannel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "permissionOverwrites" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildRole" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "permissions" TEXT NOT NULL,
    "managed" BOOLEAN NOT NULL DEFAULT false,
    "botId" TEXT,
    "color" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotInventory" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "botUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "globalName" TEXT,
    "avatar" TEXT,
    "verified" BOOLEAN,
    "isIntegris" BOOLEAN NOT NULL DEFAULT false,
    "roleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "highestRoleId" TEXT,
    "highestRoleName" TEXT,
    "highestRolePosition" INTEGER,
    "permissions" TEXT NOT NULL DEFAULT '0',
    "isAdministrator" BOOLEAN NOT NULL DEFAULT false,
    "channelElevations" JSONB NOT NULL DEFAULT '[]',
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'NONE',
    "isPresent" BOOLEAN NOT NULL DEFAULT true,
    "addedById" TEXT,
    "addedByName" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "lastEventSummary" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookInventory" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "name" TEXT,
    "type" INTEGER NOT NULL,
    "channelId" TEXT,
    "channelName" TEXT,
    "avatar" TEXT,
    "applicationId" TEXT,
    "creatorId" TEXT,
    "creatorName" TEXT,
    "creatorIsBot" BOOLEAN,
    "sourceGuildName" TEXT,
    "sourceChannelName" TEXT,
    "status" "WebhookStatus" NOT NULL DEFAULT 'ACTIVE',
    "configHash" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastChangedAt" TIMESTAMP(3),
    "lastChangeSummary" TEXT,
    "deletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustedIntegration" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "kind" "IntegrationKind" NOT NULL,
    "targetId" TEXT NOT NULL,
    "protected" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "permissionsSnapshot" TEXT,
    "trustedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustedIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationNote" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "kind" "IntegrationKind" NOT NULL,
    "targetId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityFinding" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "targetType" "ResourceType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT,
    "evidence" JSONB NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "statusChangedById" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "autoResolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SecurityFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityAlert" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "findingId" TEXT,
    "dedupKey" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT,
    "resourceName" TEXT,
    "evidence" JSONB NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOccurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "deliveryChannelId" TEXT,
    "deliveryMessageId" TEXT,
    "deliveryError" TEXT,

    CONSTRAINT "SecurityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" "AuditEventType" NOT NULL,
    "source" "EventSource" NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'INFO',
    "actorId" TEXT,
    "actorName" TEXT,
    "targetType" "ResourceType",
    "targetId" TEXT,
    "targetName" TEXT,
    "summary" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "dedupKey" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanJob" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "trigger" "ScanTrigger" NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedById" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "stats" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ScanJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataDeletionLog" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "guildName" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "leftGuild" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DataDeletionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_key" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Guild_botPresent_idx" ON "Guild"("botPresent");

-- CreateIndex
CREATE INDEX "GuildAccess_userId_idx" ON "GuildAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildAccess_guildId_userId_key" ON "GuildAccess"("guildId", "userId");

-- CreateIndex
CREATE INDEX "GuildChannel_guildId_idx" ON "GuildChannel"("guildId");

-- CreateIndex
CREATE INDEX "GuildRole_guildId_idx" ON "GuildRole"("guildId");

-- CreateIndex
CREATE INDEX "BotInventory_guildId_isPresent_idx" ON "BotInventory"("guildId", "isPresent");

-- CreateIndex
CREATE UNIQUE INDEX "BotInventory_guildId_botUserId_key" ON "BotInventory"("guildId", "botUserId");

-- CreateIndex
CREATE INDEX "WebhookInventory_guildId_status_idx" ON "WebhookInventory"("guildId", "status");

-- CreateIndex
CREATE INDEX "WebhookInventory_guildId_channelId_idx" ON "WebhookInventory"("guildId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookInventory_guildId_webhookId_key" ON "WebhookInventory"("guildId", "webhookId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustedIntegration_guildId_kind_targetId_key" ON "TrustedIntegration"("guildId", "kind", "targetId");

-- CreateIndex
CREATE INDEX "IntegrationNote_guildId_kind_targetId_idx" ON "IntegrationNote"("guildId", "kind", "targetId");

-- CreateIndex
CREATE INDEX "SecurityFinding_guildId_status_severity_idx" ON "SecurityFinding"("guildId", "status", "severity");

-- CreateIndex
CREATE INDEX "SecurityFinding_guildId_targetType_targetId_idx" ON "SecurityFinding"("guildId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityFinding_guildId_fingerprint_key" ON "SecurityFinding"("guildId", "fingerprint");

-- CreateIndex
CREATE INDEX "SecurityAlert_guildId_status_createdAt_idx" ON "SecurityAlert"("guildId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityAlert_guildId_dedupKey_idx" ON "SecurityAlert"("guildId", "dedupKey");

-- CreateIndex
CREATE INDEX "AuditEvent_guildId_occurredAt_idx" ON "AuditEvent"("guildId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_guildId_targetType_targetId_occurredAt_idx" ON "AuditEvent"("guildId", "targetType", "targetId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_guildId_dedupKey_key" ON "AuditEvent"("guildId", "dedupKey");

-- CreateIndex
CREATE INDEX "ScanJob_guildId_createdAt_idx" ON "ScanJob"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "ScanJob_status_idx" ON "ScanJob"("status");

-- CreateIndex
CREATE INDEX "DataDeletionLog_guildId_idx" ON "DataDeletionLog"("guildId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildAccess" ADD CONSTRAINT "GuildAccess_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildAccess" ADD CONSTRAINT "GuildAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildSettings" ADD CONSTRAINT "GuildSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildChannel" ADD CONSTRAINT "GuildChannel_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildRole" ADD CONSTRAINT "GuildRole_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotInventory" ADD CONSTRAINT "BotInventory_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookInventory" ADD CONSTRAINT "WebhookInventory_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustedIntegration" ADD CONSTRAINT "TrustedIntegration_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationNote" ADD CONSTRAINT "IntegrationNote_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityFinding" ADD CONSTRAINT "SecurityFinding_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAlert" ADD CONSTRAINT "SecurityAlert_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAlert" ADD CONSTRAINT "SecurityAlert_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "SecurityFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanJob" ADD CONSTRAINT "ScanJob_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
