import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const REGIOES = [
  { id: 'agreste1',   nome: 'AGRESTE — Supervisor 1' },
  { id: 'agreste2',   nome: 'AGRESTE — Supervisor 2' },
  { id: 'sertao',     nome: 'SERTÃO'                 },
  { id: 'distaq',     nome: 'DISTAQ'                 },
  { id: 'zonadamata', nome: 'ZONA DA MATA'           },
]

export default function AdminUsuarios({ toast }) {
  const [users,   setUsers]   = useState([])
  const [form,    setForm]    = useState({ email: '', senha: '', nome: '', papel: 'supervisor', regiao_id: 'agreste1' })
  const [loading, setLoading] = useState(false)
  const [loaded,  setLoaded]  = useState(false)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*, regioes(nome)')
      .order('papel').order('nome')
    if (error) toast('Erro: ' + error.message)
    else setUsers(data || [])
    setLoaded(true)
  }

  async function criarUsuario(e) {
    e.preventDefault()
    if (!form.email || !form.senha || !form.nome) { toast('Preencha todos os campos.'); return }
    setLoading(true)
    try {
      // Cria via Admin API (service key) — mas no frontend só podemos usar signUp
      // Na prática você cadastra via Supabase Dashboard ou via script Node com service key
      // Aqui fazemos signUp normal e depois atualizamos o perfil
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.senha,
        options: { data: { nome: form.nome } },
      })
      if (error) throw error

      // Atualiza perfil com papel e região
      const { error: pe } = await supabase
        .from('usuarios')
        .update({ papel: form.papel, regiao_id: form.papel === 'supervisor' ? form.regiao_id : null, nome: form.nome })
        .eq('id', data.user.id)
      if (pe) throw pe

      toast(`Usuário ${form.email} criado ✓ — peça que ele confirme o e-mail.`)
      setForm({ email: '', senha: '', nome: '', papel: 'supervisor', regiao_id: 'agreste1' })
      loadUsers()
    } catch (e) { toast('Erro: ' + e.message) }
    setLoading(false)
  }

  async function alterarRegiao(userId, regiaoId) {
    const { error } = await supabase.from('usuarios').update({ regiao_id: regiaoId }).eq('id', userId)
    if (error) toast('Erro: ' + error.message)
    else { toast('Região atualizada ✓'); loadUsers() }
  }

  if (!loaded) return <div className="spinner" />

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Criar usuário</h3>
        <div className="sub" style={{ marginBottom: 14 }}>
          Cadastre supervisores e associe cada um à sua região.
        </div>
        <form onSubmit={criarUsuario}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            <div className="field">
              <label>Nome</label>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" required />
            </div>
            <div className="field">
              <label>E-mail</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" required />
            </div>
            <div className="field">
              <label>Senha inicial</label>
              <input type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} placeholder="Mínimo 6 caracteres" required minLength={6} />
            </div>
            <div className="field">
              <label>Papel</label>
              <select value={form.papel} onChange={e => setForm(f => ({ ...f, papel: e.target.value }))}>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {form.papel === 'supervisor' && (
              <div className="field">
                <label>Região</label>
                <select value={form.regiao_id} onChange={e => setForm(f => ({ ...f, regiao_id: e.target.value }))}>
                  {REGIOES.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </div>
            )}
          </div>
          <button className="btn" type="submit" disabled={loading} style={{ marginTop: 6 }}>
            {loading ? 'Criando…' : 'Criar usuário'}
          </button>
        </form>
      </div>

      <div className="section-title">Usuários cadastrados · {users.length}</div>

      {users.map(u => (
        <div className="card" key={u.id} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{u.nome || u.email}</div>
              <div className="sub">{u.email}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={`chip ${u.papel === 'admin' ? 'novo' : 'day'}`}>{u.papel.toUpperCase()}</span>
              {u.papel === 'supervisor' && u.regioes && (
                <span className="chip ok">{u.regioes.nome}</span>
              )}
            </div>
          </div>

          {u.papel === 'supervisor' && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="small">Trocar região:</label>
              <select
                value={u.regiao_id || ''}
                onChange={e => alterarRegiao(u.id, e.target.value)}
                style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', color: 'var(--txt)', fontSize: 13 }}
              >
                {REGIOES.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
          )}
        </div>
      ))}
    </>
  )
}
