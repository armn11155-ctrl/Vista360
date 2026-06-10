// ══════════════════════════════════════════════════════════════════
// BuscarComprobante.tsx
// Portal público de verificación — sin login, accesible a cualquier receptor
// Ruta: /buscar  (agregar en AppRouter.tsx)
// ══════════════════════════════════════════════════════════════════
// @ts-nocheck
import React, { useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

const TIPOS_DOC = [
  { value: '01', label: 'Factura (F)' },
  { value: '03', label: 'Boleta (B)' },
  { value: '07', label: 'Nota de Crédito' },
  { value: '08', label: 'Nota de Débito' },
]

const EMISOR_RUC = import.meta.env.VITE_EMISOR_RUC || ''

type Estado = 'idle' | 'loading' | 'found' | 'notfound' | 'error'

export default function BuscarComprobante() {
  const [ruc,    setRuc]    = useState(EMISOR_RUC)
  const [tipo,   setTipo]   = useState('01')
  const [serie,  setSerie]  = useState('')
  const [numero, setNumero] = useState('')
  const [estado, setEstado] = useState<Estado>('idle')
  const [result, setResult] = useState<any>(null)
  const [error,  setError]  = useState('')

  const buscar = async () => {
    if (!ruc || !tipo || !serie || !numero) {
      setError('Completa todos los campos.')
      return
    }
    setEstado('loading')
    setError('')
    setResult(null)
    try {
      const res = await fetch(
        `${API_URL}/api/public/comprobante?ruc=${encodeURIComponent(ruc)}&tipo=${tipo}&serie=${encodeURIComponent(serie.toUpperCase())}&numero=${parseInt(numero)}`
      )
      const data = await res.json()
      if (!data.ok && !data.existe) {
        setEstado('notfound')
      } else if (data.existe) {
        setResult(data.comprobante)
        setEstado('found')
      } else {
        setEstado('error')
        setError(data.error || 'Error desconocido')
      }
    } catch (e) {
      setEstado('error')
      setError('No se pudo conectar con el servidor.')
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n || 0)

  const fmtFecha = (d: string) =>
    d ? new Date(d + 'T12:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1.5px solid #CBD5E1',
    fontSize: 15,
    fontFamily: 'inherit',
    outline: 'none',
    background: '#fff',
    color: '#0F172A',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: '#64748B',
    marginBottom: 5,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)',
        padding: '28px 20px 24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 13, color: 'rgba(200,220,255,0.7)', marginBottom: 4, letterSpacing: '0.08em' }}>
          SISTEMA DE FACTURACIÓN ELECTRÓNICA
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
          Verificar Comprobante
        </div>
        <div style={{ fontSize: 13, color: 'rgba(200,220,255,0.65)', marginTop: 6 }}>
          Consulta la validez de tu factura o boleta ante SUNAT
        </div>
      </div>

      {/* Formulario */}
      <div style={{ maxWidth: 520, margin: '24px auto 0', padding: '0 16px' }}>
        <div style={{
          background: '#fff',
          borderRadius: 18,
          padding: '24px 20px',
          boxShadow: '0 4px 24px rgba(15,23,41,0.10)',
          marginBottom: 16,
        }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>RUC del Emisor</label>
            <input
              style={inputStyle}
              value={ruc}
              onChange={e => setRuc(e.target.value)}
              placeholder="20xxxxxxxxx"
              maxLength={11}
              inputMode="numeric"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Tipo de Comprobante</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={tipo}
              onChange={e => setTipo(e.target.value)}
            >
              {TIPOS_DOC.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Serie</label>
              <input
                style={inputStyle}
                value={serie}
                onChange={e => setSerie(e.target.value.toUpperCase())}
                placeholder="F001"
                maxLength={5}
              />
            </div>
            <div>
              <label style={labelStyle}>Número</label>
              <input
                style={inputStyle}
                value={numero}
                onChange={e => setNumero(e.target.value.replace(/\D/g, ''))}
                placeholder="00000001"
                inputMode="numeric"
              />
            </div>
          </div>

          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 10, padding: '10px 14px', marginBottom: 14,
              fontSize: 13, color: '#DC2626', fontWeight: 600,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={buscar}
            disabled={estado === 'loading'}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 50,
              border: 'none',
              background: estado === 'loading'
                ? '#94A3B8'
                : 'linear-gradient(135deg, #1E35C8 0%, #3854EE 100%)',
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: estado === 'loading' ? 'default' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: estado === 'loading'
                ? 'none'
                : '0 4px 20px rgba(30,53,200,0.4)',
              transition: 'all .15s',
            }}
          >
            {estado === 'loading' ? 'Buscando...' : '🔍  Verificar comprobante'}
          </button>
        </div>

        {/* Resultado */}
        {estado === 'notfound' && (
          <div style={{
            background: '#FEF9C3', border: '1px solid #FDE68A',
            borderRadius: 16, padding: '20px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#92400E' }}>
              Comprobante no encontrado
            </div>
            <div style={{ fontSize: 13, color: '#78350F', marginTop: 6 }}>
              Verifica que los datos ingresados sean correctos.
            </div>
          </div>
        )}

        {estado === 'found' && result && (
          <div style={{
            background: '#fff',
            border: `2px solid ${result.valido ? '#10B981' : '#F59E0B'}`,
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(15,23,41,0.10)',
          }}>
            {/* Banner estado */}
            <div style={{
              background: result.valido
                ? 'linear-gradient(135deg, #065F46, #10B981)'
                : 'linear-gradient(135deg, #92400E, #F59E0B)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{ fontSize: 28 }}>{result.valido ? '✅' : '⚠️'}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
                  {result.valido ? 'Comprobante Válido' : 'Comprobante con Observaciones'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                  Estado SUNAT: {result.estado_sunat || 'Pendiente'}
                </div>
              </div>
            </div>

            {/* Datos */}
            <div style={{ padding: '20px' }}>
              {[
                { label: 'Comprobante', value: result.numero_fmt },
                { label: 'Fecha de Emisión', value: fmtFecha(result.fecha_emision) },
                { label: 'Emisor', value: `${result.emisor_nombre || result.emisor_razon} (RUC: ${result.emisor_ruc})` },
                { label: 'Receptor', value: result.cliente_nombre },
                { label: 'Importe Total', value: `${result.moneda === 'USD' ? 'US$ ' : 'S/ '}${Number(result.total || 0).toFixed(2)}` },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  padding: '10px 0',
                  borderBottom: '1px solid #F1F5F9',
                  gap: 12,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', textAlign: 'right' }}>
                    {value}
                  </span>
                </div>
              ))}

              {result.mensaje_sunat && (
                <div style={{
                  background: '#F8FAFC', borderRadius: 10,
                  padding: '10px 14px', marginTop: 12,
                  fontSize: 12, color: '#475569',
                }}>
                  <span style={{ fontWeight: 700 }}>Mensaje SUNAT:</span> {result.mensaje_sunat}
                </div>
              )}

              {/* Botones descarga */}
              {(result.pdf_url || result.cdr_url) && (
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  {result.pdf_url && (
                    <a
                      href={result.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1, padding: '10px', borderRadius: 50,
                        background: '#EFF6FF', border: '1.5px solid #BFDBFE',
                        color: '#1D4ED8', fontSize: 13, fontWeight: 700,
                        textDecoration: 'none', textAlign: 'center',
                      }}
                    >
                      📄 Ver PDF
                    </a>
                  )}
                  {result.cdr_url && (
                    <a
                      href={result.cdr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1, padding: '10px', borderRadius: 50,
                        background: '#ECFDF5', border: '1.5px solid #A7F3D0',
                        color: '#065F46', fontSize: 13, fontWeight: 700,
                        textDecoration: 'none', textAlign: 'center',
                      }}
                    >
                      ✅ CDR SUNAT
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 24, textAlign: 'center',
          fontSize: 11, color: '#94A3B8', lineHeight: 1.6,
        }}>
          <div>Verificación en tiempo real contra SUNAT</div>
          <div>RUC {EMISOR_RUC} — Sistema Vista360 / Facturación Electrónica Perú</div>
        </div>
      </div>
    </div>
  )
}
