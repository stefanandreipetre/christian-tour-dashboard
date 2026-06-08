import React from 'react'

export default function StatusBanner({ status }) {
  if (!status) return null

  // New status shape: { b2c: { records, updated_at }, b2b: { records, updated_at } }
  const b2cLoaded = (status.b2c?.records ?? 0) > 0
  const b2bLoaded = (status.b2b?.records ?? 0) > 0
  const allLoaded = b2cLoaded && b2bLoaded
  const anyLoaded = b2cLoaded || b2bLoaded

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
          B2C: {b2cLoaded ? `✓ ${status.b2c.records} înregistrări` : '✗ în curs de încărcare'}{' '}|{' '}
          B2B: {b2bLoaded ? `✓ ${status.b2b.records} înregistrări` : '✗ în curs de încărcare'}
        </p>
      </div>
    </div>
  )
}
