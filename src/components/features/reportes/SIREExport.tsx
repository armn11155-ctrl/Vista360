// ══════════════════════════════════════════════════════════════════
// SIREExport.tsx — Componente de exportación SIRE/PLE
// Agregar a Reportes.tsx (nueva sección en el componente Reportes)
// ══════════════════════════════════════════════════════════════════
// @ts-nocheck
import React, { useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * Descarga directa de archivo TXT/PLE desde la API
 */
const descargarPLE = async (tipo: 'ventas' | 'compras', periodo: string, token: string) => {
  const res = await fetch(
    `${API_URL}/api/sire/${tipo}?periodo=${periodo}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Error ${res.status}`)
  }
  const blob = await res.blob()
  const filename = res.headers.get('content-disposition')
    ?.match(/filename="(.+)"/)?.[1] || `LE_${tipo}_${periodo}.txt`

  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

interface SIREExportProps {
  token: string
}

export default function SIREExport({ token }: SIREExportProps) {
  const hoy    = new Date()
  const defPer = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}`

  const [periodo,  setPeriodo]  = useState(defPer)
  const [loading,  setLoading]  = useState<string | null>(null)
  const [resumen,  setResumen]  = useState<any>(null)
  const [error,    setError]    = useState('')

  const cargarResumen = async () => {
    if (!/^\d{6}$/.test(periodo)) {
      setError('Formato incorrecto. Usa YYYYMM ej: 202506')
      return
    }
    setError('')
    setLoading('resumen')
    try {
      const res  = await fetch(`${API_URL}/api/sire/resumen?periodo=${periodo}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setResumen(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  const descargar = async (tipo: 'ventas' | 'compras') => {
    if (!/^\d{6}$/.test(periodo)) { setError('Formato incorrecto'); return }
    setLoading(tipo)
    setError('')
    try {
      await descargarPLE(tipo, periodo, token)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  const fmt = (n: any) =>
    new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(Number(n || 0))

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Título */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A, #1E3A8A)',
        borderRadius: 18, padding: '16px 20px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: '0 6px 24px rgba(15,23,41,0.32)',
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>📊</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Exportación SIRE / PLE</div>
          <div style={{ fontSize: 12, color: 'rgba(180,200,255,0.7)', marginTop: 2 }}>
            Registros de Ventas y Compras — Formato SUNAT
          </div>
        </div>
      </div>

      {/* Selector de período */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: '18px',
        border: '1px solid #E2E8F0', marginBottom: 16,
        boxShadow: '0 2px 8px rgba(15,23,41,0.06)',
      }}>
        <label style={{
          display: 'block', fontSize: 11, fontWeight: 700,
          color: '#64748B', letterSpacing: '0.06em',
          textTransform: 'uppercase', marginBottom: 8,
        }}>
          Período (YYYYMM)
        </label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={periodo}
            onChange={e => setPeriodo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="202506"
            maxLength={6}
            inputMode="numeric"
            style={{
              flex: 1, padding: '12px 14px', borderRadius: 10,
              border: '1.5px solid #CBD5E1', fontSize: 16,
              fontFamily: 'monospace', fontWeight: 700, color: '#0F172A',
              outline: 'none',
            }}
          />
          <button
            onClick={cargarResumen}
            disabled={loading === 'resumen'}
            style={{
              padding: '12px 18px', borderRadius: 10, border: 'none',
              background: loading === 'resumen' ? '#94A3B8' : '#1E3A8A',
              color: '#fff', fontWeight: 700, fontSize: 13,
              cursor: loading === 'resumen' ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {loading === 'resumen' ? '...' : 'Ver resumen'}
          </button>
        </div>

        {error && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 8,
            background: '#FEF2F2', border: '1px solid #FECACA',
            fontSize: 12, color: '#DC2626', fontWeight: 600,
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Resumen del período */}
      {resumen && (
        <div style={{
          background: '#fff', borderRadius: 16, padding: '16px 18px',
          border: '1px solid #E2E8F0', marginBottom: 16,
          boxShadow: '0 2px 8px rgba(15,23,41,0.06)',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#64748B',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: 12, paddingBottom: 8,
            borderBottom: '2px solid #1E3A8A',
          }}>
            Período {resumen.periodo} — RUC {resumen.ruc}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { l: 'Comprobantes', v: resumen.ventas?.total_comprobantes || 0, mono: false },
              { l: 'Op. Gravadas', v: `S/ ${fmt(resumen.ventas?.total_gravado)}`, mono: true },
              { l: 'IGV', v: `S/ ${fmt(resumen.ventas?.total_igv)}`, mono: true },
              { l: 'Total', v: `S/ ${fmt(resumen.ventas?.total_importe)}`, mono: true },
            ].map(({ l, v, mono }) => (
              <div key={l} style={{
                background: '#F8FAFC', borderRadius: 10, padding: '10px 12px',
                border: '1px solid #E2E8F0',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em' }}>{l}</div>
                <div style={{
                  fontSize: 14, fontWeight: 800, color: '#0F172A',
                  fontFamily: mono ? 'monospace' : 'inherit', marginTop: 3,
                }}>
                  {v}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botones de descarga */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={() => descargar('ventas')}
          disabled={!!loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '16px 20px', borderRadius: 14,
            border: '2px solid #BFDBFE',
            background: loading === 'ventas' ? '#E2E8F0' : '#EFF6FF',
            cursor: loading ? 'default' : 'pointer',
            fontFamily: 'inherit',
            transition: 'all .1s',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: '#1D4ED8', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 20, flexShrink: 0,
          }}>
            📥
          </div>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1E3A8A' }}>
              {loading === 'ventas' ? 'Generando archivo...' : 'Registro de Ventas (14.1)'}
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
              LE{process.env.VITE_EMISOR_RUC || 'xxxxxxxxxx'}{periodo}00140100001111.txt
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8' }}>TXT</div>
        </button>

        <button
          onClick={() => descargar('compras')}
          disabled={!!loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '16px 20px', borderRadius: 14,
            border: '2px solid #A7F3D0',
            background: loading === 'compras' ? '#E2E8F0' : '#ECFDF5',
            cursor: loading ? 'default' : 'pointer',
            fontFamily: 'inherit',
            transition: 'all .1s',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: '#065F46', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 20, flexShrink: 0,
          }}>
            📋
          </div>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#065F46' }}>
              {loading === 'compras' ? 'Generando archivo...' : 'Registro de Compras (8.1)'}
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
              LE{process.env.VITE_EMISOR_RUC || 'xxxxxxxxxx'}{periodo}00080100001111.txt
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#065F46' }}>TXT</div>
        </button>
      </div>

      {/* Info */}
      <div style={{
        marginTop: 16, padding: '12px 14px', borderRadius: 12,
        background: '#FFFBEB', border: '1px solid #FDE68A',
        fontSize: 11, color: '#92400E', lineHeight: 1.6,
      }}>
        <strong>ℹ️ Formato SUNAT:</strong> Los archivos generados son compatibles con PLE y SIRE.
        Nomenclatura: <code>LE + RUC + PERIODO + CÓDIGO_LIBRO + OPORTUNIDAD.txt</code>
        <br/>El Registro de Compras requiere la tabla <code>compras</code> (ver migration SQL).
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// INSTRUCCIÓN DE INTEGRACIÓN EN Reportes.tsx:
//
// 1. Importar: import SIREExport from './SIREExport'
//
// 2. Agregar tab en el array secciones:
//    { id: 'sire', label: 'SIRE/PLE' }
//
// 3. Agregar sección en el render:
//    {seccion === 'sire' && (
//      <SIREExport token={tuToken} />
//    )}
//
// 4. Agregar ícono en iconMap:
//    sire: <svg>... (ícono de documento/export)</svg>
// ──────────────────────────────────────────────────────────────────
