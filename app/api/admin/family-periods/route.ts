import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const allowedFamilies = new Set(['PUGNET', 'PLAGNOL', 'NGUYEN', 'BRETEAU']);

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return errorResponse('Session administrateur introuvable. Reconnectez-vous.', 401);
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return errorResponse('Configuration Supabase incomplète côté serveur.', 500);

  let body: {
    action?: 'save' | 'delete';
    id?: string;
    year?: number;
    family?: string;
    label?: string;
    start_date?: string;
    end_date?: string;
  };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Les données reçues sont illisibles.');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return errorResponse('Session invalide. Reconnectez-vous.', 401);
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();
  if (profileError || profile?.role !== 'admin') return errorResponse('Cette action est réservée aux administrateurs.', 403);

  if (body.action === 'delete') {
    if (!body.id) return errorResponse('Identifiant de période manquant.');
    const { data, error } = await adminClient.from('family_periods').delete().eq('id', body.id).select('id').maybeSingle();
    if (error) return errorResponse(`Impossible de supprimer la période : ${error.message}`, 500);
    if (!data) return errorResponse('La période est introuvable ou a déjà été supprimée.', 404);
    return NextResponse.json({ id: data.id }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const year = Number(body.year);
  const family = body.family?.trim().toUpperCase();
  const label = body.label?.trim();
  const startDate = body.start_date;
  const endDate = body.end_date;
  if (!Number.isInteger(year) || year < 2000 || year > 2200) return errorResponse('Année invalide.');
  if (!family || !allowedFamilies.has(family)) return errorResponse('Famille invalide.');
  if (!label || label.length > 240) return errorResponse('Libellé invalide.');
  if (!startDate || !endDate || !isDate(startDate) || !isDate(endDate) || endDate < startDate) {
    return errorResponse('Dates invalides : vérifiez les dates de début et de fin.');
  }

  const values = { year, family, label, start_date: startDate, end_date: endDate };
  const query = body.id
    ? adminClient.from('family_periods').update(values).eq('id', body.id)
    : adminClient.from('family_periods').insert(values);
  const { data, error } = await query
    .select('id, year, family, label, start_date, end_date, created_at, updated_at')
    .single();
  if (error || !data) return errorResponse(`Impossible d’enregistrer la période : ${error?.message ?? 'aucune ligne retournée.'}`, 500);
  return NextResponse.json({ period: data }, { headers: { 'Cache-Control': 'no-store' } });
}
