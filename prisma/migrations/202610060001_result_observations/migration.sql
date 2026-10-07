CREATE TABLE "ResultObservation" (
  "id" TEXT PRIMARY KEY,
  "matchId" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL,
  "payload" JSONB NOT NULL
);
CREATE INDEX "ResultObservation_matchId_receivedAt_idx" ON "ResultObservation"("matchId", "receivedAt");
CREATE FUNCTION protect_result_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'result observations are immutable';
END;
$$;
CREATE TRIGGER "ResultObservation_immutable" BEFORE UPDATE OR DELETE ON "ResultObservation"
FOR EACH ROW EXECUTE FUNCTION protect_result_observation();
