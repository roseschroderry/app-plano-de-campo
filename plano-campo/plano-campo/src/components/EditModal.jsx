import { useState } from 'react'

const DIAS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX']
const FREQ_LABEL = { A: 'Semana A (15 dias)', B: 'Semana B (15 dias)', S: 'Semanal (7 dias)' }

export default function EditModal({ cliente, onSave, onClose }) {
  const [freq, setFreq]   = useState(cliente.freq)
  const [dias, setDias]   = useState([...(cliente.dias || [])])
  const [obs,  setObs]    = useState('')

  function toggleDia(d) {
    setDias(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function handleSave() {
    if (!dias.length) return alert('Selecione pelo menos um dia.')
    const alteracoes = []
    if (freq !== cliente.freq)
      alteracoes.push({ campo: 'Semana/Frequência', de: FREQ_LABEL[cliente.freq], para: FREQ_LABEL[freq] })
    const diasStr = [...dias].sort().join(',')
    const oriStr  = [...(cliente.dias || [])].sort().join(',')
    if (diasStr !== oriStr)
      alteracoes.push({ campo: 'Dia de atendimento', de: cliente.dias?.join(', ') || '—', para: dias.join(', ') })
    if (!alteracoes.length) { onClose(); return }
    onSave({ freq, dias, obs, alteracoes })
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{cliente.fantasia}</h2>
        <div className="sub-m">#{cliente.codigo} · {cliente.vendedor} · {cliente.cidade}</div>

        <div className="field">
          <label>Frequência / Semana</label>
          <div className="freq-grid">
            {['A', 'B', 'S'].map(f => (
              <label className="opt-btn" key={f}>
                <input type="radio" name="freq" checked={freq === f} onChange={() => setFreq(f)} />
                <span>{f} · {f === 'S' ? 'semanal' : '15 dias'}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Dias de atendimento</label>
          <div className="day-grid">
            {DIAS.map(d => (
              <label className="opt-btn" key={d}>
                <input type="checkbox" checked={dias.includes(d)} onChange={() => toggleDia(d)} />
                <span>{d}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Observação (opcional)</label>
          <input
            type="text" value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Motivo da alteração"
          />
        </div>

        <div className="modal-actions">
          <button className="btn sec" onClick={onClose}>Cancelar</button>
          <button className="btn"     onClick={handleSave}>Salvar alteração</button>
        </div>
      </div>
    </div>
  )
}
