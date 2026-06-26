import * as XLSX from 'xlsx'

const DIAS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX']

export function parsePlano(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets['PLANO DE CAMPO'] || wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  const hIdx = rows.findIndex(r =>
    r.some(c => String(c).trim().toUpperCase() === 'FREQ')
  )
  if (hIdx < 0) throw new Error('Coluna FREQ não encontrada. Confira o modelo da planilha.')

  const head = rows[hIdx].map(c => String(c).trim().toUpperCase())
  const col = n => head.indexOf(n)

  const iSV    = col('SV')
  const iCodVd = col('CÓD_VD') >= 0 ? col('CÓD_VD') : col('COD_VD')
  let   iVend  = iCodVd + 1
  if (col('VENDEDOR') >= 0) iVend = col('VENDEDOR')

  const iCnpj = col('CNPJ')
  const iCod  = col('CODIGO') >= 0 ? col('CODIGO') : col('CÓDIGO')
  const iRz   = col('RAZÃO SOCIAL') >= 0 ? col('RAZÃO SOCIAL') : col('RAZAO SOCIAL')
  const iFt   = col('FANTASIA')
  const iBa   = col('BAIRRO')
  const iCi   = col('CIDADE')
  const iPr   = col('PRACA') >= 0 ? col('PRACA') : col('PRAÇA')
  const iAt   = col('ATIVIDADE')
  const iFq   = col('FREQ')
  const iDias = DIAS.map(d => col(d))

  const clientes = []
  for (let r = hIdx + 1; r < rows.length; r++) {
    const row  = rows[r]
    const freq = String(row[iFq] || '').trim().toUpperCase()
    if (!['A', 'B', 'S'].includes(freq)) continue

    const dias = DIAS.filter((d, k) =>
      iDias[k] >= 0 && String(row[iDias[k]] || '').trim() !== ''
    )

    clientes.push({
      sv:        String(row[iSV]    || '').trim(),
      cod_vd:    String(row[iCodVd] || '').trim(),
      vendedor:  String(row[iVend]  || '').trim(),
      cnpj:      String(row[iCnpj]  || '').trim(),
      codigo:    String(row[iCod]   || '').trim(),
      razao:     String(row[iRz]    || '').trim(),
      fantasia:  (String(row[iFt]   || '').trim()) || String(row[iRz] || '').trim(),
      bairro:    String(row[iBa]    || '').trim(),
      cidade:    String(row[iCi]    || '').trim(),
      praca:     String(row[iPr]    || '').trim(),
      atividade: String(row[iAt]    || '').trim(),
      freq,
      dias,
    })
  }

  if (!clientes.length) throw new Error('Nenhum cliente válido encontrado.')
  return clientes
}

export function exportarExcel(clientes, regiao) {
  const HEAD = [
    '', 'SV', 'CÓD_VD', ' ', 'CNPJ', 'CODIGO', 'RAZÃO SOCIAL',
    'FANTASIA', 'BAIRRO', 'CIDADE', 'PRACA', 'ATIVIDADE', 'FREQ',
    'SEG', 'TER', 'QUA', 'QUI', 'SEX',
    'ÉSEG', 'ÉTER', 'ÉQUA', 'ÉQUI', 'ÉSEX', 'CONC', 'FORMAL',
  ]
  const visita = new Array(HEAD.length).fill('')
  visita[13] = 'VISITA'

  const rows = [[], [], visita, HEAD]

  const ordenados = [...clientes].sort((a, b) =>
    (a.vendedor || '').localeCompare(b.vendedor || '') ||
    (a.fantasia  || '').localeCompare(b.fantasia  || '')
  )

  for (const c of ordenados) {
    const r = new Array(HEAD.length).fill('')
    r[1]  = c.sv;        r[2]  = c.cod_vd;  r[3]  = c.vendedor
    r[4]  = c.cnpj;      r[5]  = c.codigo;  r[6]  = c.razao
    r[7]  = c.fantasia;  r[8]  = c.bairro;  r[9]  = c.cidade
    r[10] = c.praca;     r[11] = c.atividade; r[12] = c.freq
    DIAS.forEach((d, k) => {
      if (c.dias?.includes(d)) { r[13 + k] = 'X'; r[18 + k] = d }
    })
    const conc = (c.dias || []).join('/')
    r[23] = conc
    r[24] = c.freq === 'S' ? conc : (conc ? `${conc}-${c.freq}` : '')
    rows.push(r)
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    {wch:3},{wch:14},{wch:8},{wch:32},{wch:20},{wch:8},{wch:38},
    {wch:32},{wch:18},{wch:16},{wch:18},{wch:26},{wch:6},
    {wch:5},{wch:5},{wch:5},{wch:5},{wch:5},
    {wch:6},{wch:6},{wch:6},{wch:6},{wch:6},{wch:9},{wch:9},
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'PLANO DE CAMPO')

  const d   = new Date()
  const stamp = `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`
  XLSX.writeFile(wb, `Plano_de_Campo_${regiao.short_name}_${stamp}.xlsx`)
}
