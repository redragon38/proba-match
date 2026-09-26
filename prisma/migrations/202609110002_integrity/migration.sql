ALTER TABLE "Prediction" ADD CONSTRAINT "probabilities_valid" CHECK (
  "home" >= 0 AND "home" <= 1 AND "draw" >= 0 AND "draw" <= 1 AND "away" >= 0 AND "away" <= 1
  AND abs("home" + "draw" + "away" - 1) < 0.000001 AND "confidence" BETWEEN 0 AND 100
);
CREATE FUNCTION protect_prediction_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE starts_at timestamp; match_status text;
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Prediction history is immutable';
  END IF;
  SELECT "kickoff", "status" INTO starts_at, match_status FROM "Match" WHERE "id" = NEW."matchId";
  IF starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP OR NEW."createdAt" >= starts_at OR NEW."cutoff" > NEW."createdAt" OR match_status <> 'scheduled' THEN
    RAISE EXCEPTION 'A prediction must be stored before kickoff';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER prediction_history_guard BEFORE INSERT OR UPDATE OR DELETE ON "Prediction"
FOR EACH ROW EXECUTE FUNCTION protect_prediction_history();
ALTER TABLE "Match" ADD CONSTRAINT "different_teams" CHECK ("homeId" <> "awayId");
ALTER TABLE "Match" ADD CONSTRAINT "nonnegative_score" CHECK (("homeScore" IS NULL OR "homeScore" >= 0) AND ("awayScore" IS NULL OR "awayScore" >= 0));
CREATE INDEX search_normalized_trigram_ready ON "SearchIndex" ("normalized" text_pattern_ops);
