ALTER TABLE sessions ADD COLUMN forecast_id UUID REFERENCES forecasts(id);
