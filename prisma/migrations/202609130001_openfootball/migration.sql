ALTER TABLE "SyncRun" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'api-football';
CREATE TABLE "FootballIdentity" (
  "id" TEXT PRIMARY KEY, "provider" TEXT NOT NULL, "kind" TEXT NOT NULL,
  "externalId" TEXT NOT NULL, "externalName" TEXT, "entityId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "FootballIdentity_provider_kind_externalId_key" ON "FootballIdentity"("provider","kind","externalId");
CREATE INDEX "FootballIdentity_kind_entityId_idx" ON "FootballIdentity"("kind","entityId");
CREATE TABLE "MappingIssue" (
  "id" TEXT PRIMARY KEY, "provider" TEXT NOT NULL, "kind" TEXT NOT NULL,
  "externalId" TEXT NOT NULL, "externalName" TEXT NOT NULL, "candidates" JSONB NOT NULL,
  "resolvedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "DataSource" (
  "id" TEXT PRIMARY KEY, "url" TEXT NOT NULL, "license" TEXT NOT NULL,
  "lastSyncedAt" TIMESTAMP(3), "etag" TEXT, "contentHash" TEXT, "payload" JSONB
);
-- Preserve existing links and predictions: register legacy API IDs instead of renaming rows.
INSERT INTO "FootballIdentity" ("id","provider","kind","externalId","entityId")
SELECT 'legacy-team-' || "id", 'api-football', 'team', "id", "id" FROM "Team" WHERE "id" ~ '^[0-9]+$';
INSERT INTO "FootballIdentity" ("id","provider","kind","externalId","entityId")
SELECT 'legacy-competition-' || "id", 'api-football', 'competition', "id", "id" FROM "Competition" WHERE "id" ~ '^[0-9]+$';
INSERT INTO "FootballIdentity" ("id","provider","kind","externalId","entityId")
SELECT 'legacy-match-' || "id", 'api-football', 'match', "id", "id" FROM "Match" WHERE "source"='api-football';
INSERT INTO "FootballIdentity" ("id","provider","kind","externalId","entityId")
SELECT 'legacy-player-' || "id", 'api-football', 'player', "id", "id" FROM "Player" WHERE "id" ~ '^[0-9]+$';
