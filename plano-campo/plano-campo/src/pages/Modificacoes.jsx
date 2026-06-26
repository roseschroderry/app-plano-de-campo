import { useState, useEffect } from 'react'
import { getMods, marcarModAplicada } from '../lib/supabase'

const REGIOES = [
  { id: 'agreste1',   nome: 'AGRESTE — Sup. 1' },
  { id: 'agreste2',   nome: 'AGRESTE — Sup. 2' },
  { id: 'sertao',     nome: 'SERTÃO'            },
  { id: 'distaq',     nome: 'DISTAQ'            },
  { id: 'zonadamata', nome: 'ZONA DA MATA'      },
]

function fmtDt(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function Modificacoes({ perfil, toast, onLoad }) {
  const isAdmin = perfil.papel === 'admin'
  const [mods,   setMods]   = useState([])
  const [fReg,   setFReg]   = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const data = await getMods(isAdmin ? null : perfil.regiao_id)
      setMods(data)
      onLoad?.(data.filter(m => !m.aplicado).length)
    } catch (e) { toast('Erro: ' + e.message) }
    setLoaded(true)
  }

  async function aplicar(id) {
    try {
      await marcarModAplicada(id)
      setMods(prev => prev.map(m => m.id === id ? { ...m, aplicado: true } : m))
      onLoad?.(mods.filter(m => !m.aplicado && m.id !== id).length)
    } catch (e) { toast('Erro: ' + e.message) }
  }

  if (!loaded) return <div className="spinner" />

  let lista = mods
  if (isAdmin && fReg) lista = lista.filter(m => m.regiao_id === fReg)

  return (
    <>
      {isAdmin && (
        <div className="searchbar">
          <select value={fReg} onChange={e => setFReg(e.target.value)}>
            <option value="">Todas as regiões</option>
            {REGIOES.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </div>
      )}

      {!lista.length && (
        <div className="empty">
          <div className="big">📡</div>
          {isAdmin ? 'Nenhuma modificação registrada.' : 'Você ainda não fez nenhuma alteração.'}
        </div>
      )}

      {lista.map(m => (
        <div className={`mod-item ${m.aplicado ? 'applied' : ''}`} key={m.id}>
          <div className="mod-head">
            <div className="who">
              {m.usuario_nome || 'Supervisor'}
              {isAdmin && <> · <span className="small">{REGIOES.find(r => r.id === m.regiao_id)?.nome}</span></>}
              {' '}{m.aplicado
                ? <span className="chip ok">APLICADO</span>
                : <span className="chip novo">NOVO</span>}
            </div>
            <div className="when">{fmtDt(m.created_at)}</div>
          </div>

          <div className="mod-body">
            <b>Cliente:</b> {m.cliente_nome} (#{m.cliente_cod}) · {m.cidade}<br />
            <b>Vendedor:</b> {m.vendedor} (cód. {m.cod_vd})
            {(m.alteracoes || []).map((a, i) => (
              <div className="diff" key={i}>
                <b>{a.campo}:</b>{' '}
                <span className="de">{a.de}</span>
                {' → '}
                <span className="para">{a.para}</span>
              </div>
            ))}
            {m.obs && <div className="small" style={{ marginTop: 6 }}>Obs.: {m.obs}</div>}
          </div>

          {isAdmin && !m.aplicado && (
            <div className="mod-actions">
              <button className="mini-btn" onClick={() => aplicar(m.id)}>
                ✓ Marcar como aplicado no sistema
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  )
}
