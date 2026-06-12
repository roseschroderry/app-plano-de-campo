const DIAS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX']

export default function DayChart({ clientes, titulo }) {
  const counts = {}
  DIAS.forEach(d => (counts[d] = 0))
  clientes.forEach(c => (c.dias || []).forEach(d => { if (counts[d] != null) counts[d]++ }))
  const max = Math.max(...Object.values(counts), 1)

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <h3>{titulo}</h3>
      <div className="sub">Visitas programadas por dia da semana</div>
      <div className="day-chart">
        {DIAS.map(d => (
          <div className="day-col" key={d}>
            <div className="val">{counts[d]}</div>
            <div className="bar" style={{ height: `${Math.max(counts[d] / max * 100, 3)}%` }} />
            <div className="lbl">{d}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
