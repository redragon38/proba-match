-- Restore the uniqueness contract on installations whose earlier schema import
-- omitted this index. Existing duplicates must be reviewed; never delete history.
CREATE UNIQUE INDEX IF NOT EXISTS "Prediction_matchId_versionId_kind_key"
ON "Prediction" ("matchId", "versionId", "kind");
