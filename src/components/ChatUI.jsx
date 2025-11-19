import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, Hash, Menu, Users, MessageSquarePlus } from 'lucide-react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''

function classNames(...c){
  return c.filter(Boolean).join(' ')
}

function RoomList({ rooms, currentRoom, onSelect, onCreate }){
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <Hash className="w-5 h-5 text-blue-300" />
        <span className="text-white/90 font-semibold">Rooms</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {rooms.map(r => (
          <button
            key={r.id}
            onClick={() => onSelect(r)}
            className={classNames(
              'w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-white/5 transition',
              currentRoom?.id === r.id ? 'bg-white/10' : ''
            )}
          >
            <Hash className="w-4 h-4 text-blue-300" />
            <div>
              <div className="text-white/90 font-medium">{r.name}</div>
              {r.description && <div className="text-white/50 text-xs">{r.description}</div>}
            </div>
          </button>
        ))}
      </div>
      <div className="p-3 border-t border-white/10">
        <div className="space-y-2">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="New room name" className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description (optional)" className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={()=>{ if(!name.trim()) return; onCreate({name, description: desc||undefined}); setName(''); setDesc(''); }} className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-2 transition">
            <MessageSquarePlus className="w-4 h-4" />
            Create Room
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ m }){
  return (
    <div className="px-4 py-2">
      <div className="max-w-xl">
        <div className="text-white/70 text-xs mb-1">{m.sender}</div>
        <div className="bg-white/10 text-white rounded-2xl rounded-tl-md px-4 py-2 backdrop-blur border border-white/10">
          {m.content}
        </div>
      </div>
    </div>
  )
}

export default function ChatUI(){
  const [rooms, setRooms] = useState([])
  const [current, setCurrent] = useState(null)
  const [messages, setMessages] = useState([])
  const [sender, setSender] = useState('Guest')
  const [text, setText] = useState('')
  const wsRef = useRef(null)

  // load rooms
  useEffect(()=>{
    fetch(`${BACKEND_URL}/api/rooms`).then(r=>r.json()).then(setRooms).catch(()=>{})
  },[])

  // when selecting room, load history and open websocket
  useEffect(()=>{
    if(!current) return
    fetch(`${BACKEND_URL}/api/rooms/${current.id}/messages`).then(r=>r.json()).then(setMessages)
    // open ws
    const wsUrlBase = (BACKEND_URL||window.location.origin.replace('http','ws'))
    const ws = new WebSocket(`${wsUrlBase.replace(/\/$/,'')}/ws/rooms/${current.id}`)
    ws.onmessage = (ev)=>{
      try { const data = JSON.parse(ev.data); setMessages(prev=>[...prev, data]) } catch {}
    }
    ws.onclose = ()=>{}
    wsRef.current = ws
    return ()=>{ ws.close(); wsRef.current = null }
  },[current])

  const handleSend = ()=>{
    const trimmed = text.trim()
    if(!trimmed || !current) return
    const payload = { sender: sender||'Guest', content: trimmed }
    if(wsRef.current && wsRef.current.readyState === WebSocket.OPEN){
      wsRef.current.send(JSON.stringify(payload))
    } else {
      // fallback via HTTP
      fetch(`${BACKEND_URL}/api/rooms/${current.id}/messages`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    }
    setText('')
  }

  const createRoom = async (data)=>{
    const res = await fetch(`${BACKEND_URL}/api/rooms`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) })
    const room = await res.json()
    setRooms(prev=>[...prev, room])
    setCurrent(room)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="grid grid-cols-1 md:grid-cols-12 min-h-screen">
        {/* Sidebar */}
        <aside className="md:col-span-3 border-r border-white/10 bg-white/5 backdrop-blur">
          <RoomList rooms={rooms} currentRoom={current} onSelect={setCurrent} onCreate={createRoom} />
        </aside>

        {/* Chat area */}
        <main className="md:col-span-9 flex flex-col h-[calc(100vh)]">
          {/* Top bar */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-white/5/50 backdrop-blur">
            <div className="flex items-center gap-2">
              <Menu className="w-5 h-5 text-white/60 md:hidden" />
              <Hash className="w-5 h-5 text-blue-300" />
              <div>
                <div className="font-semibold">{current ? current.name : 'Select or create a room'}</div>
                {current?.description && <div className="text-white/60 text-xs">{current.description}</div>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-white/60" />
              <input value={sender} onChange={e=>setSender(e.target.value)} placeholder="Your name" className="bg-white/5 border border-white/10 rounded px-2 py-1 text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {current ? (
              messages.length ? messages.map(m => <MessageBubble key={m.id||Math.random()} m={m} />) : (
                <div className="h-full flex items-center justify-center text-white/50">No messages yet. Say hello!</div>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-white/50">Pick or create a room to start chatting.</div>
            )}
          </div>

          {/* Composer */}
          <div className="p-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={e=>setText(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); handleSend(); } }}
                placeholder={current?`Message #${current.name}`:'Select a room to start'}
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={handleSend} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] transition text-white px-4 py-3 rounded-2xl">
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
