import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type CreateUserBody = {
  email?: string;
  password?: string;
  fullName?: string;
  role?: 'admin' | 'member';
};

function createAdminClients(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !token) {
    return { error: 'Configuration Supabase ou session admin incomplète.', status: 401 };
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { userClient, adminClient, token };
}

async function getAdminClients(request: NextRequest) {
  const clients = createAdminClients(request);
  if ('error' in clients) return clients;

  const { data: authData, error: sessionError } = await clients.userClient.auth.getUser(clients.token);
  if (sessionError || !authData.user) return { error: 'Session invalide.', status: 401 };

  const { data: profile, error: profileError } = await clients.adminClient
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();
  if (profileError || profile?.role !== 'admin') return { error: 'Réservé aux administrateurs.', status: 403 };

  return clients;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonError('Configuration Supabase incomplète côté serveur.', 500);
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return jsonError('Session admin introuvable.', 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: sessionError,
  } = await userClient.auth.getUser(token);

  if (sessionError || !user) {
    return jsonError('Session invalide.', 401);
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    return jsonError('Réservé aux administrateurs.', 403);
  }

  const body = (await request.json()) as CreateUserBody;
  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();
  const fullName = body.fullName?.trim();
  const role = body.role ?? 'member';

  if (!email || !password || !fullName) {
    return jsonError('Email, mot de passe et nom complet sont obligatoires.');
  }

  if (!['admin', 'member'].includes(role)) {
    return jsonError('Rôle invalide.');
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
    },
  });

  if (createError || !created.user) {
    return jsonError(createError?.message ?? 'Impossible de créer le compte.', 500);
  }

  const { error: insertError } = await adminClient.from('profiles').upsert({
    id: created.user.id,
    full_name: fullName,
    role,
  });

  if (insertError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return jsonError(insertError.message, 500);
  }

  return NextResponse.json({
    user: {
      id: created.user.id,
      email: created.user.email,
      full_name: fullName,
      role,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const clients = await getAdminClients(request);
  if ('error' in clients) return jsonError(clients.error ?? 'Session admin invalide.', clients.status);

  const body = (await request.json().catch(() => ({}))) as { id?: string; all?: boolean };
  const query = clients.adminClient.from('reservations').delete().select('id');
  const result = body.all
    ? await query.not('id', 'is', null)
    : body.id
    ? await query.eq('id', body.id)
    : { data: null, error: { message: 'Identifiant de réservation manquant.' } };

  if (result.error) return jsonError(result.error.message, 500);
  return NextResponse.json({ deleted: result.data?.length ?? 0 });
}
