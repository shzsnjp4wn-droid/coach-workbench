import { useState } from 'react'
import { ChevronRight, Settings, Trash2, X } from 'lucide-react'
import { Card } from './ui'

/**
 * Account → Settings → Delete account (danger zone stays nested, not on the header).
 */
export function AccountSettings({
  role,
  person,
  onClose,
  onDeleteAccount,
}) {
  const [pane, setPane] = useState('account') // account | settings | delete
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const accent = role === 'coach' ? 'text-cyan-300' : 'text-lime-300'

  async function runDelete() {
    setBusy(true)
    setError('')
    try {
      await onDeleteAccount()
    } catch (err) {
      setError(err?.message || 'Could not delete account')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="w-full max-w-md p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className={`flex items-center gap-2 text-sm ${accent}`}>
              <Settings size={16} />
              {pane === 'account' && 'Account'}
              {pane === 'settings' && 'Account · Settings'}
              {pane === 'delete' && 'Account · Settings · Delete'}
            </div>
            <h2 className="mt-2 font-display text-3xl text-white">{person?.name || 'Account'}</h2>
            <p className="mt-1 font-mono text-xs text-zinc-500">
              {person?.code}
              {person?.email ? ` · ${person.email}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-zinc-300" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {pane === 'account' && (
          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => setPane('settings')}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left hover:border-white/20"
            >
              <div>
                <div className="text-sm text-white">Settings</div>
                <div className="text-xs text-zinc-500">Security and account controls</div>
              </div>
              <ChevronRight size={16} className="text-zinc-500" />
            </button>
            <button type="button" onClick={onClose} className="pt-2 text-xs uppercase tracking-wider text-zinc-500">
              Close
            </button>
          </div>
        )}

        {pane === 'settings' && (
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => setPane('account')}
              className="text-xs uppercase tracking-wider text-zinc-500"
            >
              ← Back to account
            </button>
            <button
              type="button"
              onClick={() => setPane('delete')}
              className="flex w-full items-center justify-between rounded-xl border border-red-400/25 bg-red-500/5 px-4 py-3 text-left"
            >
              <div>
                <div className="text-sm text-red-100">Delete account</div>
                <div className="text-xs text-zinc-500">Permanently remove this {role} profile</div>
              </div>
              <ChevronRight size={16} className="text-red-300/70" />
            </button>
          </div>
        )}

        {pane === 'delete' && (
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => setPane('settings')}
              className="text-xs uppercase tracking-wider text-zinc-500"
            >
              ← Back to settings
            </button>
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4">
              <div className="flex items-center gap-2 text-sm text-red-100">
                <Trash2 size={14} /> Delete forever
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                This permanently removes the {role} profile and linked programme data. It cannot be undone.
              </p>
              {error && (
                <div className="mt-3 rounded-lg border border-red-400/40 bg-black/30 px-3 py-2 text-sm text-red-100">
                  {error}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runDelete()}
                  className="rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-50"
                >
                  {busy ? 'Deleting…' : 'Yes, delete forever'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPane('settings')}
                  className="rounded-lg border border-white/15 px-3 py-2 text-xs uppercase tracking-wider text-zinc-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
