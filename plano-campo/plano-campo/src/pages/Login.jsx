import { useState } from 'react'
import { signIn } from '../lib/supabase'

export default function Login() {
  const [email, setEmail]     = useState('')
  const [senha, setSenha]     = useState('')
  const [erro,  setErro]      = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setErro(''); setLoading(true)
    try {
      await signIn(email.trim(), senha)
    } catch (err) {
      setErro('E-mail ou senha incorretos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="brand">ATAQ DISTRIBUIDORA</div>
        <h1>Plano de Campo</h1>
        <p>Roteirização de vendedores · Semanas A · B · S</p>

        <form onSubmit={handleLogin}>
          <div className="field">
            <label>E-mail</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com" autoComplete="email" required
            />
          </div>
          <div className="field">
            <label>Senha</label>
            <input
              type="password" value={senha} onChange={e => setSenha(e.target.value)}
              placeholder="••••••••" autoComplete="current-password" required
            />
          </div>
          {erro && <div className="err">{erro}</div>}
          <button className="btn" type="submit" disabled={loading} style={{ marginTop: 16 }}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
