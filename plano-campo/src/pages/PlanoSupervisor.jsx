import { useState, useEffect } from 'react'
import { getClientes, updateCliente, inserirMod, dispararWebhook } from '../lib/supabase'
import { exportarExcel } from '../lib/planilha'
import DistBar from '../components/DistBar'
import DayChart from '../components/DayChart'
import EditModal from '../components/EditModal'

const DIAS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX']

const REGIOES_MAP = {
  agreste1:   { nome: 'AGRESTE — Supervisor 1', short_name: 'AGRESTE_SUP1' },
  agreste2:   { nome: 'AGRESTE — Supervisor 2', short_name: 'AGRESTE_SUP2' },
  sertao:     { nome: 'SERTÃO',                 short_name: 'SERTAO'       },
  distaq:     { nome: 'DISTAQ',                 short_name: 'DISTAQ'       },
  zonadamata: { nome: 'ZONA DA MATA',           short_name: 'ZONA_DA_MATA' },
}

function vends(clientes) {
  const map = {}
  clientes.forEach(c => {
    const k = c.cod_vd + '|' + c.vendedor
    if (!map[k]) map[k] = { cod_vd: c.cod_vd, nome: c.vendedor, total: 0, A: 0, B: 0, S: 0 }
    map[k].total++; map[k][c.freq]++
  })
  return Object.values(map).sort((a, b) => a.nome.localeCompare(b.nome))
}

export default function PlanoSupervisor({ perfil, toast }) {
  const regiaoId = perfil.regiao_id
  const regiao   = REGIOES_MAP[regiaoId] || { nome: regiaoId, short_name: regiaoId }

  const [clientes,  setClientes]  = useState([])
  const [drillVd,   setDrillVd]   = useState(null)
  const [fBusca,    setFBusca]    = useState('')
  const [fDia,      setFDia]      = useState('')
  const [fFreq,     setFFreq]     = useState('')
  const [editando,  setEditando]  = useState(null)
  const [loaded,    setLoaded]    = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const data = await getClientes(regiaoId)
      setClientes(data)
    } catch (e) { toast('Erro ao carregar plano: ' + e.message) }
    setLoaded(true)
  }

  function handleExportar() {
    if (!clientes.length) { toast('Nenhum cliente carregado.'); return }
    exportarExcel(clientes, regiao)
    toast('Excel exportado no modelo do plano de campo ✓')
  }

  async function handleSalvarEdicao({ freq, dias, obs, alteracoes }) {
    const c = editando
    setEditando(null)
    try {
      // 1. Atualiza no banco
      const updated = await updateCliente(c.id, { freq, dias })
      setClientes(prev => prev.map(x => x.id === c.id ? { ...x, ...updated } : x))

      // 2. Registra modificação
      const mod = {
        regiao_id:    regiaoId,
        usuario_id:   perfil.id,
        usuario_nome: perfil.nome || perfil.email,
        cliente_id:   c.id,
        cliente_nome: c.fantasia,
        cliente_cod:  c.codigo,
        cidade:       c.cidade,
        vendedor:     c.vendedor,
        cod_vd:       c.cod_vd,
        alteracoes,
        obs,
      }
      await inserirMod(mod)

      // 3. Dispara webhook n8n → WhatsApp
      await dispararWebhook({
        evento:      'modificacao',
        regiao:      regiao.nome,
        supervisor:  perfil.nome || perfil.email,
        cliente:     c.fantasia,
        clienteCod:  c.codigo,
        vendedor:    c.vendedor,
        alteracoes,
        obs,
        ts:          new Date().toISOString(),
      })

      toast('Alteração salva e enviada ao administrador ✓')
    } catch (e) {
      toast('Erro ao salvar: ' + e.message)
    }
  }

  if (!loaded) return <div className="spinner" />

  if (!clientes.length) {
    return (
      <div className="empty">
        <div className="big">📭</div>
        O plano de campo da sua região ainda não foi carregado.<br />
        Fale com o administrador.
      </div>
    )
  }

  // ---- DRILL: clientes do vendedor
  if (drillVd) {
    const cliVend = clientes.filter(c => c.cod_vd === drillVd)
    const vendNome = cliVend[0]?.vendedor || drillVd
    let filtrado = cliVend
    if (fDia)   filtrado = filtrado.filter(c => (c.dias || []).includes(fDia))
    if (fFreq)  filtrado = filtrado.filter(c => c.freq === fFreq)
    if (fBusca) {
      const b = fBusca.toLowerCase()
      filtrado = filtrado.filter(c =>
        (c.fantasia + ' ' + c.razao + ' ' + c.codigo + ' ' + c.cidade + ' ' + c.bairro).toLowerCase().includes(b)
      )
    }
    filtrado = [...filtrado].sort((a, b) => (a.fantasia || '').localeCompare(b.fantasia || ''))

    return (
      <>
        <button className="back-btn" onClick={() => { setDrillVd(null); setFBusca(''); setFDia(''); setFFreq('') }}>
          ← Vendedores
        </button>
        <DayChart clientes={cliVend} titulo={vendNome} />
        <div className="section-title">Clientes · {filtrado.length}</div>
        <div className="searchbar">
          <input placeholder="Buscar cliente, código, cidade…" value={fBusca} onChange={e => setFBusca(e.target.value)} />
          <select value={fDia} onChange={e => setFDia(e.target.value)}>
            <option value="">Todos os dias</option>
            {DIAS.map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={fFreq} onChange={e => setFFreq(e.target.value)}>
            <option value="">A · B · S</option>
            <option value="A">Semana A</option>
            <option value="B">Semana B</option>
            <option value="S">Semanal</option>
          </select>
        </div>
        {filtrado.length ? filtrado.map(c => (
          <div className="cli-item" key={c.id}>
            <div style={{ minWidth: 0 }}>
              <div className="nm">{c.fantasia}</div>
              <div className="meta">#{c.codigo} · {c.cidade}{c.bairro ? ' · ' + c.bairro : ''}</div>
            </div>
            <div className="cli-tags">
              <span className={`chip ${c.freq}`}>{c.freq}</span>
              {(c.dias || []).map(d => <span className="chip day" key={d}>{d}</span>)}
              <button className="edit-link" onClick={() => setEditando(c)}>Editar</button>
            </div>
          </div>
        )) : <div className="empty">Nenhum cliente com esses filtros.</div>}

        {editando && (
          <EditModal
            cliente={editando}
            onSave={handleSalvarEdicao}
            onClose={() => setEditando(null)}
          />
        )}
      </>
    )
  }

  // ---- Lista de vendedores
  const vendas = vends(clientes)
  const S = clientes.filter(c => c.freq === 'S').length
  const A = clientes.filter(c => c.freq === 'A').length
  const B = clientes.filter(c => c.freq === 'B').length

  return (
    <>
      <div className="kpi-strip">
        <div className="kpi-box" style={{ '--kc': 'var(--red)' }}><b>{clientes.length}</b><span>Clientes</span></div>
        <div className="kpi-box" style={{ '--kc': 'var(--blue)' }}><b>{vendas.length}</b><span>Vendedores</span></div>
        <div className="kpi-box" style={{ '--kc': 'var(--green)' }}><b>{S}</b><span>Semanais</span></div>
        <div className="kpi-box" style={{ '--kc': 'var(--amber)' }}><b>{A + B}</b><span>Quinzenais</span></div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3>{regiao.nome}</h3>
            <div className="sub">Toque em um vendedor para ver os clientes</div>
          </div>
          <button className="btn sec sm" onClick={handleExportar}>⬇ Exportar Excel</button>
        </div>
        <DistBar S={S} A={A} B={B} />
      </div>

      <DayChart clientes={clientes} titulo="Carga de visitas da região" />

      <div className="section-title">Vendedores</div>
      <div className="grid2">
        {vendas.map(v => (
          <div className="card clickable" key={v.cod_vd} onClick={() => { setDrillVd(v.cod_vd); setFBusca(''); setFDia(''); setFFreq('') }}>
            <h3>{v.nome}</h3>
            <div className="sub">Código {v.cod_vd}</div>
            <div className="kpis">
              <div className="kpi"><b>{v.total}</b><span>clientes</span></div>
              <div className="kpi"><b>{v.S || 0}</b><span>semanais</span></div>
              <div className="kpi"><b>{v.A || 0}</b><span>sem. A</span></div>
              <div className="kpi"><b>{v.B || 0}</b><span>sem. B</span></div>
            </div>
            <DistBar S={v.S || 0} A={v.A || 0} B={v.B || 0} />
          </div>
        ))}
      </div>
    </>
  )
}
