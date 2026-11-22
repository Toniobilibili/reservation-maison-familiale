import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type PeriodInput = {
  year: number;
  family: string;
  label: string;
  start_date: string;
  end_date: string;
};

const allowedFamilies = new Set(['PUGNET', 'PLAGNOL', 'NGUYEN', 'BRETEAU']);

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return jsonError('Session administrateur introuvable. Reconnectez-vous.', 401);
  if (!supabaseUrl) return jsonError('Variable NEXT_PUBLIC_SUPABASE_URL absente côté serveur.', 500);
  if (!anonKey) return jsonError('Variable NEXT_PUBLIC_SUPABASE_ANON_KEY absente côté serveur.', 500);
  if (!serviceRoleKey) return jsonError('Variable SUPABASE_SERVICE_ROLE_KEY absente dans l’environnement Vercel de ce déploiement.', 500);

  let body: { year?: number; fileName?: string; imageUrl?: string; extractedPeriods?: PeriodInput[] };
  try {
    body = await request.json();
  } catch {
    return jsonError('Les données reçues sont illisibles.', 400);
  }

  const year = Number(body.year);
  const fileName = body.fileName?.trim();
  const imageUrl = body.imageUrl ?? null;
  const extractedPeriods = body.extractedPeriods ?? [];
  if (!Number.isInteger(year) || year < 2000 || year > 2200 || !fileName || fileName.length > 255) {
    return jsonError('Année ou nom de fichier invalide.', 400);
  }
  if (!Array.isArray(extractedPeriods) || extractedPeriods.length > 100) {
    return jsonError('Le nombre de périodes détectées est invalide.', 400);
  }
  const invalidPeriod = extractedPeriods.find((period) =>
    period.year !== year
    || !allowedFamilies.has(period.family)
    || !period.label?.trim()
    || !isDate(period.start_date)
    || !isDate(period.end_date)
    || period.end_date < period.start_date
  );
  if (invalidPeriod) return jsonError(`Période invalide : ${invalidPeriod.label || 'sans libellé'}.`, 400);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return jsonError('Session invalide. Reconnectez-vous.', 401);
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();
  if (profileError || profile?.role !== 'admin') return jsonError('Cette action est réservée aux administrateurs.', 403);

  const { data: planningImport, error: importError } = await adminClient.from('planning_imports').insert({
    year,
    file_name: fileName,
    image_url: imageUrl,
    status: 'draft',
    extracted_periods: extractedPeriods,
    created_by: authData.user.id,
  }).select('id, year, file_name, image_url, status, extracted_periods, created_by, created_at').single();
  if (importError || !planningImport) return jsonError(importError?.message ?? 'Impossible de créer la trace de l’import.', 500);

  if (extractedPeriods.length === 0) return NextResponse.json({ planningImport, periods: [] });

  const { data: previousPeriods, error: readError } = await adminClient
    .from('family_periods')
    .select('id')
    .eq('year', year);
  if (readError) {
    await adminClient.from('planning_imports').delete().eq('id', planningImport.id);
    return jsonError(`Impossible de vérifier le planning existant : ${readError.message}`, 500);
  }

  const { data: newPeriods, error: insertPeriodsError } = await adminClient
    .from('family_periods')
    .insert(extractedPeriods)
    .select('id, year, family, label, start_date, end_date, created_at, updated_at');
  if (insertPeriodsError || !newPeriods) {
    await adminClient.from('planning_imports').delete().eq('id', planningImport.id);
    return jsonError(`Impossible d’insérer les périodes : ${insertPeriodsError?.message ?? 'aucune période retournée.'}`, 500);
  }

  const previousIds = (previousPeriods ?? []).map((period) => period.id);
  if (previousIds.length > 0) {
    const { error: deleteOldError } = await adminClient.from('family_periods').delete().in('id', previousIds);
    if (deleteOldError) {
      await adminClient.from('family_periods').delete().in('id', newPeriods.map((period) => period.id));
      await adminClient.from('planning_imports').delete().eq('id', planningImport.id);
      return jsonError(`Impossible de remplacer les périodes précédentes : ${deleteOldError.message}`, 500);
    }
  }

  const { data: validatedImport, error: updateImportError } = await adminClient
    .from('planning_imports')
    .update({ status: 'validated' })
    .eq('id', planningImport.id)
    .select('id, year, file_name, image_url, status, extracted_periods, created_by, created_at')
    .single();
  if (updateImportError || !validatedImport) {
    return NextResponse.json({
      error: `Les périodes ont été synchronisées, mais l’historique de l’import n’a pas pu être mis à jour : ${updateImportError?.message ?? 'erreur inconnue.'}`,
      periods: newPeriods,
    }, { status: 500 });
  }

  return NextResponse.json({ planningImport: validatedImport, periods: newPeriods });
}
