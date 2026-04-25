export interface SessionSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface SessionForecast {
  wave_height: number | null;
  wave_period: number | null;
  wave_direction: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
  swell_height: number | null;
  swell_period: number | null;
  swell_direction: number | null;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  spot_id: string;
  date: string;
  transcript_raw: string | null;
  notes: string | null;
  overall_rating: number | null;
  created_at: string;
}

export interface SessionListItem extends SessionRecord {
  spot: SessionSpot | null;
}

export interface CreateSessionResult {
  session: SessionRecord;
  spot: SessionSpot | null;
  forecast: SessionForecast | null;
}
