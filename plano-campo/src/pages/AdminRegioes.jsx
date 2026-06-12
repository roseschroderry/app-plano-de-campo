import { useState, useEffect } from 'react'
import { getClientes, getUploads, upsertClientes, upsertUpload } from '../lib/supabase'
import { parsePlano, exportarExcel } from '../lib/planilha'
import DistBar from '../components/DistBar'
import DayChart from '../components/DayChart'

const REGIOES = [
  { id: 'agreste1',   nome: 'AGRESTE — Supervisor 1', short_name: 'AGRESTE_SUP1' },
  { id: 'agreste2',   nome: 'AGRESTE — Supervisor 2', short_name: 'AGRESTE_SUP2' },
  { id: 'sertao',     nome: 'SERTÃO',                 short_name: 'SERTAO'       },
  { id: 'distaq',     nome: 'DISTAQ',                 short_name: 'DISTAQ'       },
  { id: 'zonadamata', nome: 'ZONA DA MATA',           short_name: 'ZONA_DA_MATA' },
]

function vends(clientes) {
  const map = {}
  clientes.forEach(c => {
    const k = c.cod_vd + '|' + c.vendedor
    if (!map[k]) map[k] = { cod_vd: c.cod_vd, nome: c.vendedor, total: 0, A: 0, B: 0, S: 0 }
    map[k].total++; map[k][c.freq]++
  })
  return Object.values(map).sort((a, b) => a.nome.localeCompare(b.nome))
}

export default function AdminRegioes({ perfil, toast, modsNovas, ajustesPend }) {
  const [uploads,  setUploads]  = useState([])
  const [planos,   setPlanos]   = useState({})   // {regiaoId: [clientes]}
  const [drill,    setDrill]    = useState(null)  // regiaoId selecionada
  const [drillVd,  setDrillVd]  = useState(null)  // cod_vd selecionado
  const [fBusca,   setFBusca]   = useState('')
  const [fDia,     setFDia]     = useState('')
  const [fFreq,    setFFreq]    = useState('')
  const [loadingUp, setLoadingUp] = useState(null)

  const DIAS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX']

  useEffect(() => {
    loadUploads()
  }, [])

  async function loadUploads() {
    try {
      const u = await getUploads()
      setUploads(u)
    } catch (e) { toast('Erro ao carregar uploads: ' + e.message) }
  }

  async function loadClientes(regiaoId) {
    if (planos[regiaoId]) return
    try {
      const c = await getClientes(regiaoId)
      setPlanos(prev => ({ ...prev, [regiaoId]: c }))
    } catch (e) { toast('Erro: ' + e.message) }
  }

  async function handleUpload(regiaoId, input) {
    const file = input.files[0]; if (!file) return
    setLoadingUp(regiaoId)
    try {
      const buf = await file.arrayBuffer()
      const clientes = parsePlano(buf)
      await upsertClientes(regiaoId, clientes)
      await upsertUpload(regiaoId, file.name, clientes.length, perfil.id)
      setPlanos(prev => ({ ...prev, [regiaoId]: clientes.map((c, i) => ({ ...c, id: i })) }))
      await loadUploads()
      toast(`✓ ${clientes.length} clientes carregados em ${REGIOES.find(r => r.id === regiaoId).nome}`)
    } catch (e) { toast('Erro: ' + e.message) }
    finally { setLoadingUp(null); input.value = '' }
  }

  async function abrirRegiao(regiaoId) {
    await loadClientes(regiaoId)
    setDrill(regiaoId); setDrillVd(null)
    setFBusca(''); setFDia(''); setFFreq('')
  }

  async function handleExportar(regiaoId) {
    await loadClientes(regiaoId)
    const cli = planos[regiaoId] || []
    if (!cli.length) { toast('Nenhum cliente carregado nesta região.'); return }
    const reg = REGIOES.find(r => r.id === regiaoId)
    exportarExcel(cli, reg)
    toast('Excel exportado no modelo do plano de campo ✓')
  }

  // ---- DRILL: lista de clientes do vendedor
  if (drill && drillVd) {
    const cli = (planos[drill] || []).filter(c => c.cod_vd === drillVd)
    const vendNome = cli[0]?.vendedor || drillVd
    let filtrado = cli
    if (fDia)   filtrado = filtrado.filter(c => (c.dias || []).includes(fDia))
    if (fFreq)  filtrado = filtrado.filter(c => c.freq === fFreq)
    if (fBusca) {
      const b = fBusca.toLowerCase()
      filtrado = filtrado.filter(c =>
        (c.fantasia + ' ' + c.razao + ' ' + c.codigo + ' ' + c.cidade + ' ' + c.bairro).toLowerCase().includes(b)
      )
    }

    return (
      <>
        <button className="back-btn" onClick={() => setDrillVd(null)}>← Vendedores</button>
        <DayChart clientes={cli} titulo={vendNome} />
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
          <div className="cli-item" key={c.id ?? c.codigo}>
            <div style={{ minWidth: 0 }}>
              <div className="nm">{c.fantasia}</div>
              <div className="meta">#{c.codigo} · {c.cidade}{c.bairro ? ' · ' + c.bairro : ''}</div>
            </div>
            <div className="cli-tags">
              <span className={`chip ${c.freq}`}>{c.freq}</span>
              {(c.dias || []).map(d => <span className="chip day" key={d}>{d}</span>)}
            </div>
          </div>
        )) : <div className="empty">Nenhum cliente com esses filtros.</div>}
      </>
    )
  }

  // ---- DRILL: lista de vendedores da região
  if (drill) {
    const cli    = planos[drill] || []
    const reg    = REGIOES.find(r => r.id === drill)
    const vendas = vends(cli)
    const S = cli.filter(c => c.freq === 'S').length
    const A = cli.filter(c => c.freq === 'A').length
    const B = cli.filter(c => c.freq === 'B').length

    return (
      <>
        <button className="back-btn" onClick={() => { setDrill(null); setDrillVd(null) }}>← Visão geral</button>
        <div className="kpi-strip">
          <div className="kpi-box" style={{ '--kc': 'var(--red)' }}><b>{cli.length}</b><span>Clientes</span></div>
          <div className="kpi-box" style={{ '--kc': 'var(--blue)' }}><b>{vendas.length}</b><span>Vendedores</span></div>
          <div className="kpi-box" style={{ '--kc': 'var(--green)' }}><b>{S}</b><span>Semanais</span></div>
          <div className="kpi-box" style={{ '--kc': 'var(--amber)' }}><b>{A + B}</b><span>Quinzenais</span></div>
        </div>
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
            <div><h3>{reg.nome}</h3></div>
            <button className="btn sec sm" onClick={() => handleExportar(drill)}>⬇ Exportar Excel</button>
          </div>
          <DistBar S={S} A={A} B={B} />
        </div>
        <DayChart clientes={cli} titulo="Carga de visitas da região" />
        <div className="section-title">Vendedores</div>
        <div className="grid2">
          {vendas.map(v => (
            <div className="card clickable" key={v.cod_vd} onClick={() => setDrillVd(v.cod_vd)}>
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

  // ---- VISÃO GERAL
  const allCli = Object.values(planos).flat()
  const vendTotal = REGIOES.reduce((s, r) => s + vends(planos[r.id] || []).length, 0)
  const carregadas = uploads.length

  return (
    <>
      <div className="kpi-strip">
        <div className="kpi-box" style={{ '--kc': 'var(--red)' }}><b>{allCli.length}</b><span>Clientes totais</span></div>
        <div className="kpi-box" style={{ '--kc': 'var(--blue)' }}><b>{vendTotal}</b><span>Vendedores</span></div>
        <div className="kpi-box" style={{ '--kc': 'var(--green)' }}><b>{carregadas}/5</b><span>Regiões ativas</span></div>
        <div className={`kpi-box ${modsNovas ? 'alert' : ''}`} style={{ '--kc': 'var(--red)' }}><b>{modsNovas}</b><span>Modificações novas</span></div>
        <div className={`kpi-box ${ajustesPend ? 'warn' : ''}`} style={{ '--kc': 'var(--amber)' }}><b>{ajustesPend}</b><span>Ajustes pendentes</span></div>
      </div>

      {allCli.length > 0 && <DayChart clientes={allCli} titulo="Carga total — todas as regiões" />}

      <div className="section-title">Regiões</div>
      <div className="grid2">
        {REGIOES.map(r => {
          const up  = uploads.find(u => u.regiao_id === r.id)
          const cli = planos[r.id] || []
          const S = cli.filter(c => c.freq === 'S').length
          const A = cli.filter(c => c.freq === 'A').length
          const B = cli.filter(c => c.freq === 'B').length
          const isLoading = loadingUp === r.id

          return (
            <div className="card" key={r.id}>
              <h3>
                <span className={`dot ${up ? 'on' : 'off'}`} />
                {r.nome}
              </h3>
              <div className="sub">{up ? up.file_name : 'Nenhuma planilha carregada'}</div>

              {up && (
                <>
                  <div className="kpis">
                    <div className="kpi"><b>{up.total}</b><span>clientes</span></div>
                    <div className="kpi"><b>{vends(cli).length || '—'}</b><span>vendedores</span></div>
                  </div>
                  <DistBar S={S} A={A} B={B} />
                  <div className="small" style={{ marginTop: 8 }}>
                    Atualizado {new Date(up.uploaded_at).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="actions-row">
                    <button className="btn sec" onClick={() => abrirRegiao(r.id)}>Ver plano</button>
                    <button className="btn sec" onClick={() => handleExportar(r.id)}>⬇ Excel</button>
                  </div>
                </>
              )}

              <div className={`upload-zone ${isLoading ? 'loading' : ''}`}>
                <input
                  type="file" id={`up_${r.id}`} accept=".xlsx,.xlsm"
                  onChange={e => handleUpload(r.id, e.target)}
                  disabled={isLoading}
                />
                <label htmlFor={`up_${r.id}`}>
                  {isLoading ? '⏳ Processando…' : `📄 ${up ? 'Substituir' : 'Enviar'} planilha (.xlsx)`}
                </label>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
