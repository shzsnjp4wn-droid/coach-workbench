import { useEffect, useRef, useState } from 'react'
import { FileText, Paperclip, Send } from 'lucide-react'
import { COACH, fileToMedia, formatBytes, formatMessageDay, formatTime } from '../domain'
import { Avatar } from './ui'

export function MessagesPage({ role, athlete, athletes, messages, onSend, onOpenThread, onMarkRead }) {
  const thread = messages[athlete.id] || []
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState(null)
  const scroller = useRef(null)
  const connected = Object.values(athletes).filter((a) => a.coachId === COACH.id)

  useEffect(() => {
    onMarkRead(athlete.id)
  }, [athlete.id, role, onMarkRead])

  useEffect(() => {
    const node = scroller.current
    if (node) node.scrollTop = node.scrollHeight
  }, [thread.length, athlete.id])

  function send() {
    if (!text.trim() && !attachment) return
    onSend(athlete.id, role, text, attachment)
    setText('')
    setAttachment(null)
  }

  const groups = []
  for (const msg of thread) {
    const day = msg.at.slice(0, 10)
    const last = groups[groups.length - 1]
    if (!last || last.day !== day) groups.push({ day, items: [msg] })
    else last.items.push(msg)
  }

  return (
    <div className={`grid h-[calc(100svh-9.5rem)] min-h-[520px] overflow-hidden rounded-xl border border-white/8 bg-[#0e1016] ${role === 'coach' ? 'lg:grid-cols-[280px_1fr]' : ''}`}>
      {role === 'coach' && (
        <aside className="border-b border-white/8 lg:border-b-0 lg:border-r">
          <div className="border-b border-white/8 px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-zinc-500">Athletes</div>
          <div className="pane-scroll max-h-48 overflow-auto lg:max-h-none lg:h-[calc(100%-2.5rem)]">
            {connected.map((person) => {
              const last = (messages[person.id] || []).at(-1)
              const unread = (messages[person.id] || []).filter((m) => m.unread && m.from === 'athlete').length
              return (
                <button key={person.id} type="button" onClick={() => onOpenThread(person.id)} className={`flex w-full items-center gap-3 px-3 py-3 text-left ${person.id === athlete.id ? 'bg-white/6' : 'hover:bg-white/4'}`}>
                  <Avatar id={person.id} name={person.name} className="h-10 w-10 shrink-0 text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm text-white">{person.name}</span>
                      {unread > 0 && <span className="rounded-full bg-cyan-400 px-1.5 text-[10px] font-semibold text-black">{unread}</span>}
                    </div>
                    <div className="truncate text-xs text-zinc-500">{last ? last.text || last.attachment?.name : 'No messages yet'}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>
      )}
      <section className="flex min-h-0 min-w-0 flex-col">
        <header className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
          <Avatar id={role === 'coach' ? athlete.id : COACH.id} name={role === 'coach' ? athlete.name : COACH.name} className="h-9 w-9 text-sm" />
          <div>
            <div className="text-sm text-white">{role === 'coach' ? athlete.name : COACH.name}</div>
            <div className="text-[11px] text-zinc-500">{role === 'coach' ? athlete.event : 'Coach'}</div>
          </div>
        </header>
        <div ref={scroller} className="pane-scroll flex-1 space-y-4 overflow-auto px-4 py-4">
          {thread.length === 0 && (
            <div className="mx-auto max-w-sm pt-16 text-center text-sm text-zinc-500">
              No messages yet. Talk about the session, or send a photo from the floor. Set clips you log on a training day land in Videos.
            </div>
          )}
          {groups.map((group) => (
            <div key={group.day} className="grid gap-2">
              <div className="mx-auto rounded-full bg-white/6 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-500">{formatMessageDay(group.items[0].at)}</div>
              {group.items.map((msg) => {
                const mine = msg.from === role
                return (
                  <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${mine ? (role === 'coach' ? 'bg-cyan-400/15 text-cyan-50' : 'bg-lime-400/15 text-lime-50') : 'bg-white/6 text-zinc-100'}`}>
                      {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                      {msg.attachment?.kind === 'image' && <img src={msg.attachment.url} alt={msg.attachment.name} className="mt-2 max-h-56 rounded-lg" />}
                      {msg.attachment?.kind === 'video' && <video src={msg.attachment.url} controls className="mt-2 max-h-56 rounded-lg" />}
                      {msg.attachment?.kind === 'file' && (
                        <div className="mt-2 flex items-center gap-2 rounded-lg bg-black/30 px-2 py-1.5 text-xs">
                          <FileText size={14} />
                          <span className="truncate">{msg.attachment.name}</span>
                          <span className="text-zinc-500">{formatBytes(msg.attachment.size)}</span>
                        </div>
                      )}
                      <div className={`mt-1 text-[10px] ${mine ? 'text-right' : ''} text-zinc-500`}>{formatTime(msg.at)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <footer className="border-t border-white/8 p-3">
          {attachment && (
            <div className="mb-2 flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs">
              <span className="truncate">{attachment.name}</span>
              <button type="button" onClick={() => setAttachment(null)} className="text-zinc-500">Remove</button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 text-zinc-400" title="Attach a file">
              <Paperclip size={16} />
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) setAttachment(fileToMedia(file))
                }}
              />
            </label>
            <textarea
              value={text}
              rows={1}
              placeholder="Message"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-white/10 bg-[#151821] px-3 py-2 text-sm outline-none"
            />
            <button type="button" onClick={send} disabled={!text.trim() && !attachment} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-black disabled:opacity-30">
              <Send size={16} />
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
