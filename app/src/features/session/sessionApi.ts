import { supabase } from '../../config/supabase';
import { CreateSessionResult, SessionListItem, SessionRecord } from './session.types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

async function getAuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return `Bearer ${token}`;
}

async function parseJsonResponse(response: Response): Promise<{ data: unknown; error: string | null }> {
  try {
    return await response.json();
  } catch {
    throw new Error(`Server error (${response.status}): unexpected response format`);
  }
}

function isCreateSessionResult(data: unknown): data is CreateSessionResult {
  return (
    typeof data === 'object' && data !== null &&
    'session' in data && 'spot' in data
  );
}

function isSessionRecord(data: unknown): data is SessionRecord {
  return (
    typeof data === 'object' && data !== null &&
    'id' in data && 'user_id' in data && 'spot_id' in data
  );
}

export async function getSessions(): Promise<SessionListItem[]> {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${API_URL}/api/sessions/`, {
    headers: { Authorization: authHeader },
  });

  const json = await parseJsonResponse(response);
  if (!response.ok || json.error) throw new Error(json.error ?? 'Failed to load sessions');
  if (!Array.isArray(json.data)) throw new Error('Unexpected response shape from server');
  return json.data as SessionListItem[];
}

export async function uploadSession(
  audioUri: string,
  lat?: number,
  lng?: number
): Promise<CreateSessionResult> {
  const authHeader = await getAuthHeader();
  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    name: 'session.m4a',
    type: 'audio/m4a',
  // React Native's FormData accepts file-like objects but the TS type expects Blob
  } as unknown as Blob);
  if (lat !== undefined) formData.append('lat', String(lat));
  if (lng !== undefined) formData.append('lng', String(lng));

  const response = await fetch(`${API_URL}/api/sessions/create`, {
    method: 'POST',
    headers: { Authorization: authHeader },
    body: formData,
  });

  const json = await parseJsonResponse(response);
  if (!response.ok || json.error) throw new Error(json.error ?? 'Upload failed');
  if (!isCreateSessionResult(json.data)) throw new Error('Unexpected response shape from server');
  return json.data;
}

export async function patchSession(
  sessionId: string,
  updates: Partial<Pick<SessionRecord, 'notes' | 'overall_rating' | 'spot_id' | 'date'>>
): Promise<SessionRecord> {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  const json = await parseJsonResponse(response);
  if (!response.ok || json.error) throw new Error(json.error ?? 'Update failed');
  if (!isSessionRecord(json.data)) throw new Error('Unexpected response shape from server');
  return json.data;
}
