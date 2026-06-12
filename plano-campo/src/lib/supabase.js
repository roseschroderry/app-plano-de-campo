import { createClient } from '@supabase/supabase-js'

const URL  = import.meta.env.VITE_SUPABASE_URL
const KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!URL || !KEY) {
  console.error('⚠️  Crie um arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
})

// ---- Auth -------------------------------------------------------
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getMeuPerfil() {
  const { data: session } = await supabase.auth.getSession()
  if (!session?.session) return null
  const { data, error } = await supabase
    .from('usuarios')
    .select('*, regioes(*)')
    .eq('id', session.session.user.id)
    .single()
  if (error) throw error
  return data
}

// ---- Clientes ---------------------------------------------------
export async function upsertClientes(regiaoId, clientes) {
  // Deleta os da região e reinsere (substitui plano)
  const { error: del } = await supabase
    .from('clientes')
    .delete()
    .eq('regiao_id', regiaoId)
  if (del) throw del

  const rows = clientes.map(c => ({ ...c, regiao_id: regiaoId }))
  // Insere em batches de 500 pra não estourar o limite
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('clientes').insert(rows.slice(i, i + 500))
    if (error) throw error
  }
}

export async function getClientes(regiaoId) {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('regiao_id', regiaoId)
    .order('vendedor')
    .order('fantasia')
  if (error) throw error
  return data
}

export async function updateCliente(id, patch) {
  const { data, error } = await supabase
    .from('clientes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- Uploads ----------------------------------------------------
export async function upsertUpload(regiaoId, fileName, total, userId) {
  const { error } = await supabase.from('uploads').upsert({
    regiao_id: regiaoId, file_name: fileName, total,
    uploaded_by: userId, uploaded_at: new Date().toISOString(),
  }, { onConflict: 'regiao_id' })
  if (error) throw error
}

export async function getUploads() {
  const { data, error } = await supabase.from('uploads').select('*')
  if (error) throw error
  return data
}

// ---- Modificações -----------------------------------------------
export async function inserirMod(mod) {
  const { error } = await supabase.from('modificacoes').insert(mod)
  if (error) throw error
}

export async function getMods(regiaoId) {
  let q = supabase.from('modificacoes').select('*').order('created_at', { ascending: false })
  if (regiaoId) q = q.eq('regiao_id', regiaoId)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function marcarModAplicada(id) {
  const { error } = await supabase
    .from('modificacoes').update({ aplicado: true }).eq('id', id)
  if (error) throw error
}

// ---- Ajustes ----------------------------------------------------
export async function inserirAjuste(ajuste) {
  const { error } = await supabase.from('ajustes').insert(ajuste)
  if (error) throw error
}

export async function getAjustes(regiaoId) {
  let q = supabase.from('ajustes').select('*').order('created_at', { ascending: false })
  if (regiaoId) q = q.eq('regiao_id', regiaoId)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function resolverAjuste(id) {
  const { error } = await supabase
    .from('ajustes').update({ status: 'resolvido' }).eq('id', id)
  if (error) throw error
}

// ---- Realtime ---------------------------------------------------
export function subscribeToMods(regiaoId, callback) {
  return supabase
    .channel('mods-' + (regiaoId || 'all'))
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'modificacoes',
      ...(regiaoId ? { filter: `regiao_id=eq.${regiaoId}` } : {}),
    }, callback)
    .subscribe()
}

export function subscribeToAjustes(regiaoId, callback) {
  return supabase
    .channel('ajustes-' + (regiaoId || 'all'))
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'ajustes',
      ...(regiaoId ? { filter: `regiao_id=eq.${regiaoId}` } : {}),
    }, callback)
    .subscribe()
}

// ---- n8n Webhook ------------------------------------------------
export async function dispararWebhook(payload) {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL
  if (!url) return   // webhook opcional
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    console.warn('Webhook n8n falhou (não crítico):', e.message)
  }
}
