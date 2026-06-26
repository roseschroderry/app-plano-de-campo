import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useToast } from './hooks/useToast'
import { signOut, subscribeToMods, subscribeToAjustes } from './lib/supabase'
import Login        from './pages/Login'
import AdminRegioes from './pages/AdminRegioes'
import Modificacoes from './pages/Modificacoes'
import Ajustes      from './pages/Ajustes'
import AdminUsuarios from './pages/AdminUsuarios'
import PlanoSupervisor from './pages/PlanoSupervisor'
import './styles/global.css'

function Shell() {
  const { user, perfil, loading } = useAuth()
  const { toast, Toast } = useToast()

  const [tab,         setTab]         = useState(null)
  const [modsNovas,   setModsNovas]   = useState(0)
  const [ajustesPend, setAjustesPend] = useState(0)
  const [notif,       setNotif]       = useState(null)

  const isAdmin = perfil?.papel === 'admin'

  // Define aba inicial quando perfil carrega
  useEffect(() => {
    if (!perfil) return
    setTab(isAdmin ? 'regioes' : 'plano')
  }, [perfil])

  // Realtime: assina notificações
  useEffect(() => {
    if (!perfil) return
    const regiaoId = isAdmin ? null : perfil.regiao_id

    const subMod = subscribeToMods(regiaoId, payload => {
      if (isAdmin) {
        setModsNovas(n => n + 1)
        const d = payload.new
        toast(`🔔 Nova modificação: ${d.cliente_nome} (${d.usuario_nome})`)
        setNotif({ tipo: 'mod', data: d })
      }
    })

    const subAj = subscribeToAjustes(regiaoId, payload => {
      if (isAdmin) {
        setAjustesPend(n => n + 1)
        const d = payload.new
        toast(`📋 Novo ajuste de ${d.usuario_nome}: ${d.cliente_nome || '—'}`)
      }
    })

    return () => { subMod.unsubscribe(); subAj.unsubscribe() }
  }, [perfil])

  // Toggle tema
  function toggleTheme() {
    const cur  = document.documentElement.getAttribute('data-theme') || 'dark'
    const next = cur === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('tema', next)
  }

  // Aplica tema salvo
  useEffect(() => {
    const t = localStorage.getItem('tema') || 'dark'
    document.documentElement.setAttribute('data-theme', t)
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner" />
    </div>
  )
  if (!user || !perfil) return <Login />

  // ---- Tabs por papel
  const tabs = isAdmin
    ? [
        { id: 'regioes',   label: 'Visão Geral' },
        { id: 'mods',      label: 'Modificações', badge: modsNovas   },
        { id: 'ajustes',   label: 'Ajustes',      badge: ajustesPend },
        { id: 'usuarios',  label: 'Usuários' },
      ]
    : [
        { id: 'plano',     label: 'Plano de Campo' },
        { id: 'minhasmods',label: 'Minhas alterações' },
        { id: 'ajustes',   label: 'Ajustes' },
      ]

  function renderContent() {
    switch (tab) {
      case 'regioes':
        return <AdminRegioes perfil={perfil} toast={toast} modsNovas={modsNovas} ajustesPend={ajustesPend} />
      case 'mods':
      case 'minhasmods':
        return <Modificacoes perfil={perfil} toast={toast} onLoad={setModsNovas} />
      case 'ajustes':
        return <Ajustes perfil={perfil} toast={toast} onLoad={setAjustesPend} />
      case 'usuarios':
        return <AdminUsuarios toast={toast} />
      case 'plano':
        return <PlanoSupervisor perfil={perfil} toast={toast} />
      default:
        return null
    }
  }

  const tema = document.documentElement.getAttribute('data-theme') || 'dark'

  return (
    <div className="app-shell">
      {/* TopBar */}
      <div className="topbar">
        <div className="tb-left">
          <span className="logo"><b>ATAQ</b><span> ▸ PLANO DE CAMPO</span></span>
          <span className="role-chip">
            {isAdmin ? 'ADMINISTRADOR' : (perfil.regioes?.nome || perfil.regiao_id || 'SUPERVISOR').toUpperCase()}
          </span>
        </div>
        <div className="tb-right">
          <button className="icon-btn" onClick={toggleTheme} title="Tema">
            {tema === 'dark' ? '🌙' : '☀️'}
          </button>
          <button className="icon-btn" onClick={signOut}>Sair</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.badge > 0 && <span className="badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="content">
        {renderContent()}
      </div>

      <Toast />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
