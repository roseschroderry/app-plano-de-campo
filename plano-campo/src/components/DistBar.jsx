export default function DistBar({ S = 0, A = 0, B = 0 }) {
  const t = S + A + B || 1
  return (
    <>
      <div className="dist-bar" style={{ marginTop: 12 }}>
        <span className="dS" style={{ width: `${S / t * 100}%` }} />
        <span className="dA" style={{ width: `${A / t * 100}%` }} />
        <span className="dB" style={{ width: `${B / t * 100}%` }} />
      </div>
      <div className="dist-legend">
        <span><i className="dS" />S semanal {S}</span>
        <span><i className="dA" />Sem. A {A}</span>
        <span><i className="dB" />Sem. B {B}</span>
      </div>
    </>
  )
}
