import React from 'react'

export default function StatusBanner({ status }) {
  if (!status) return null

  const allLoaded = Object.values(status.sources).every(s => s.loaded)
  const anyLoaded = Object.values(status.sources).some(s => s.loaded)

  if (allLoaded) return null

  return (
    <div className={`mx-6 mt-4 rounded-xl p-4 text-sm flex items-start gap-3 ${anyLoaded ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
      <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <div>
        <strong className="font-semibold">
          {anyLoaded ? 'Date parțial încărcate' : 'Nu s-au putut încărca datele'}
        </strong>
        <p className="mt-0.5">
          Verifică că variabilele de mediu <code className="bg-white/60 px-1 rounded">SHAREPOINT_USERNAME</code> și{' '}
          <code className="bg-white/60 px-1 rounded">SHAREPOINT_PASSWORD</code> sunt setate corect în Render.
          {' '}Surse: {Object.entries(status.sources).map(([k, v]) => `${k}: ${v.loaded ? '✓' : '✗'}`).join(' | ')}
        </p>
      </div>
    </div>
  )
}
