import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) return NextResponse.json({ error: 'Session introuvable. Reconnectez-vous.' }, { status: 401 });
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: 'Configuration Supabase incomplète côté serveur.' }, { status: 500 });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Session invalide. Reconnectez-vous.' }, { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await adminClient
    .from('family_periods')
    .select('id, year, family, label, start_date, end_date, created_at, updated_at')
    .order('start_date', { ascending: true });

  if (error) return NextResponse.json({ error: `Impossible de charger le planning : ${error.message}` }, { status: 500 });
  return NextResponse.json(
    { periods: data ?? [] },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
