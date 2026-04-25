-- spots
CREATE TABLE spots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL
);

-- sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    spot_id UUID NOT NULL REFERENCES spots(id),
    date TIMESTAMPTZ NOT NULL,
    transcript_raw TEXT,
    notes TEXT,
    overall_rating SMALLINT CHECK (overall_rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- forecasts
CREATE TABLE forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spot_id UUID NOT NULL REFERENCES spots(id),
    timestamp TIMESTAMPTZ NOT NULL,
    wave_height DOUBLE PRECISION,
    wave_period DOUBLE PRECISION,
    wave_direction DOUBLE PRECISION,
    wind_speed DOUBLE PRECISION,
    wind_direction DOUBLE PRECISION,
    swell_height DOUBLE PRECISION,
    swell_period DOUBLE PRECISION,
    swell_direction DOUBLE PRECISION,
    tide_height DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (spot_id, timestamp)
);

-- RLS: sessions are user-scoped; spots and forecasts are intentionally public read-only.
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own sessions" ON sessions
    FOR ALL USING (auth.uid() = user_id);
