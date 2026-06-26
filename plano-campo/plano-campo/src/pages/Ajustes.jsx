import { useState, useEffect } from 'react'
import { getAjustes, inserirAjuste, resolverAjuste, getClientes } from '../lib/supabase'

function fmtDt(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function Ajustes({ perfil, toast, onLoad }) {
  const isAdmin = perfil.papel === 'admin'
  const [ajustes,  setAjustes]  = useState([])
  const [vends,    setVends]    = useState([])
  const [form,     setForm]     = useState({ vendedor: '', cod_vd: '', cliente_nome: '', texto: '' })
  const [loaded,   setLoaded]   = useState(false)

  useEffect(() => { load(); if (!isAdmin) loadVends() }, [])

  async function load() {
    try {
      const data = await getAjustes(isAdmin ? null : perfil.regiao_id)
      setAjustes(data)
      onLoad?.(data.filter(a => a.status === 'pendente').length)
    } catch (e) { toast('Erro: ' + e.message) }
    setLoaded(true)
  }

  async function loadVends() {
    try {
      const cli = await getClientes(perfil.regiao_id)
      const map = {}
      cli.forEach(c => { if (!map[c.cod_vd]) map[c.cod_vd] = c.vendedor })
      setVends(Object.entries(map).map(([cod_vd, nome]) => ({ cod_vd, nome })).sort((a,b)=>a.nome.localeCompare(b.nome)))
    } catch {}
  }

  async function enviar() {
    if (!form.texto.trim()) { toast('Descreva o ajuste.'); return }
    try {
      const novo = {
        regiao_id:    perfil.regiao_id,
        usuario_id:   perfil.id,
        usuario_nome: perfil.nome || perfil.email,
        vendedor:     form.vendedor,
        cod_vd:       form.cod_vd,
        cliente_nome: form.cliente_nome,
        texto:        form.texto,
      }
      await inserirAjuste(novo)
      toast('Ajuste enviado ao administrador ✓')
      setForm({ vendedor: '', cod_vd: '', cliente_nome: '', texto: '' })
      load()
    } catch (e) { toast('Erro: ' + e.message) }
  }

  async function resolver(id) {
    try {
      await resolverAjuste(id)
      setAjustes(prev => prev.map(a => a.id === id ? { ...a, status: 'resolvido' } : a))
      onLoad?.(ajustes.filter(a => a.status === 'pendente' && a.id !== id).length)
    } catch (e) { toast('Erro: ' + e.message) }
  }

  if (!loaded) return <div className="spinner" />

  return (
    <>
      {/* Formulário só para supervisores */}
      {!isAdmin && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>Anotar ajuste</h3>
          <div className="sub" style={{ marginBottom: 14 }}>
            Registre aqui ajustes de cliente/vendedor para o administrador aplicar no sistema.
          </div>

          <div className="field">
            <label>Vendedor</label>
            <select
              value={`${form.cod_vd}|${form.vendedor}`}
              onChange={e => {
                const [cod_vd, vendedor] = e.target.value.split('|')
                setForm(f => ({ ...f, cod_vd, vendedor }))
              }}
            >
              <option value="|">Selecione…</option>
              {vends.map(v => (
                <option key={v.cod_vd} value={`${v.cod_vd}|${v.nome}`}>{v.nome}</option>
              ))}
              <option value="|OUTRO">Outro / não listado</option>
            </select>
          </div>

          <div className="field">
            <label>Cliente</label>
            <input
              value={form.cliente_nome}
              onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))}
              placeholder="Nome ou código do cliente"
            />
          </div>

          <div className="field">
            <label>Descrição do ajuste</label>
            <textarea
              value={form.texto}
              onChange={e => setForm(f => ({ ...f, texto: e.target.value }))}
              placeholder="Ex.: trocar cliente para a carteira do vendedor X, corrigir endereço, incluir cliente novo…"
            />
          </div>

          <button className="btn" onClick={enviar}>Enviar ajuste</button>
        </div>
      )}

      <div className="section-title">
        {isAdmin ? 'Todos os ajustes' : 'Meus ajustes'} · {ajustes.length}
      </div>

      {!ajustes.length && (
        <div className="empty">
          <div className="big">🛠️</div>
          Nenhum ajuste registrado.
        </div>
      )}

      {ajustes.map(a => (
        <div className={`mod-item ${a.status === 'resolvido' ? 'applied' : ''}`} key={a.id}>
          <div className="mod-head">
            <div className="who">
              {a.cliente_nome || '—'}{' '}
              <span className={`chip ${a.status === 'resolvido' ? 'ok' : 'pend'}`}>
                {a.status.toUpperCase()}
              </span>
            </div>
            <div className="when">{fmtDt(a.created_at)}</div>
          </div>
          <div className="mod-body">
            <b>Vendedor:</b> {a.vendedor || '—'}<br />
            {a.texto}
            {isAdmin && <><br /><span className="small">Região: {a.regiao_id}</span></>}
          </div>
          {isAdmin && a.status !== 'resolvido' && (
            <div className="mod-actions">
              <button className="mini-btn" onClick={() => resolver(a.id)}>
                ✓ Marcar como resolvido
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  )
}
