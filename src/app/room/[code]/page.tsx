'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type GameStatus = 'lobby' | 'role_reveal' | 'hints' | 'voting' | 'result'

interface Room {
  id: string
  code: string
  status: GameStatus
  secret_word: string | null
  category: string | null
  host_player_id: string
  current_hint_seat: number
}

interface Player {
  id: string
  room_id: string
  name: string
  seat_order: number | null
  is_impostor: boolean
  hint: string | null
  voted_for: string | null
  is_ready: boolean
}

type WordEntry = { word: string; hint: string }

const WORD_CATEGORIES: Record<string, WordEntry[]> = {
  'Geral': [
    { word: 'Natal', hint: 'Inverno' },
    { word: 'Casamento', hint: 'Aliança' },
    { word: 'Greve', hint: 'Protesto' },
    { word: 'Eleição', hint: 'Urna' },
    { word: 'Férias', hint: 'Descanso' },
    { word: 'Formatura', hint: 'Diploma' },
    { word: 'Festival', hint: 'Palco' },
    { word: 'Viagem', hint: 'Mala' },
    { word: 'Treino', hint: 'Academia' },
    { word: 'Cirurgia', hint: 'Bisturi' },
    { word: 'Mergulho', hint: 'Profundo' },
    { word: 'Acampamento', hint: 'Barraca' },
  ],
  'Comida': [
    { word: 'Pizza', hint: 'Rodela' },
    { word: 'Sushi', hint: 'Alga' },
    { word: 'Sorvete', hint: 'Cone' },
    { word: 'Churrasco', hint: 'Brasa' },
    { word: 'Hambúrguer', hint: 'Chapa' },
    { word: 'Lasanha', hint: 'Camadas' },
    { word: 'Tapioca', hint: 'Polvilho' },
    { word: 'Coxinha', hint: 'Frango' },
    { word: 'Brigadeiro', hint: 'Granulado' },
    { word: 'Pastel', hint: 'Fritura' },
    { word: 'Frango', hint: 'Asa' },
    { word: 'Pão de Queijo', hint: 'Polvilho' },
  ],
  'Esportes': [
    { word: 'Futebol', hint: 'Campo' },
    { word: 'Tênis', hint: 'Raquete' },
    { word: 'Natação', hint: 'Raia' },
    { word: 'Vôlei', hint: 'Rede' },
    { word: 'Basquete', hint: 'Aro' },
    { word: 'Boxe', hint: 'Ringue' },
    { word: 'Surfe', hint: 'Prancha' },
    { word: 'Golfe', hint: 'Tacos' },
    { word: 'Ciclismo', hint: 'Pedal' },
    { word: 'Skate', hint: 'Rampa' },
    { word: 'Judô', hint: 'Tatame' },
    { word: 'Handebol', hint: 'Gol' },
  ],
  'Lugares': [
    { word: 'Praia', hint: 'Areia' },
    { word: 'Hospital', hint: 'Corredor' },
    { word: 'Aeroporto', hint: 'Pista' },
    { word: 'Museu', hint: 'Vitrine' },
    { word: 'Shopping', hint: 'Vitrine' },
    { word: 'Igreja', hint: 'Torre' },
    { word: 'Escola', hint: 'Lousa' },
    { word: 'Fazenda', hint: 'Celeiro' },
    { word: 'Cassino', hint: 'Fichas' },
    { word: 'Circo', hint: 'Trapézio' },
    { word: 'Biblioteca', hint: 'Prateleira' },
    { word: 'Restaurante', hint: 'Garçom' },
  ],
  'Animais': [
    { word: 'Cachorro', hint: 'Latido' },
    { word: 'Golfinho', hint: 'Salto' },
    { word: 'Cobra', hint: 'Escama' },
    { word: 'Elefante', hint: 'Tromba' },
    { word: 'Borboleta', hint: 'Casulo' },
    { word: 'Tubarão', hint: 'Barbatana' },
    { word: 'Pinguim', hint: 'Iceberg' },
    { word: 'Cavalo', hint: 'Ferradura' },
    { word: 'Coruja', hint: 'Noturno' },
    { word: 'Leão', hint: 'Juba' },
    { word: 'Polvo', hint: 'Tentáculo' },
    { word: 'Flamingo', hint: 'Rosa' },
  ],
  'Profissões': [
    { word: 'Médico', hint: 'Jaleco' },
    { word: 'Professor', hint: 'Lousa' },
    { word: 'Astronauta', hint: 'Cápsula' },
    { word: 'Detetive', hint: 'Pista' },
    { word: 'Chef', hint: 'Avental' },
    { word: 'Bombeiro', hint: 'Escada' },
    { word: 'Piloto', hint: 'Cockpit' },
    { word: 'Veterinário', hint: 'Focinho' },
    { word: 'Músico', hint: 'Partitura' },
    { word: 'Arquiteto', hint: 'Planta' },
    { word: 'Policial', hint: 'Distintivo' },
    { word: 'Dentista', hint: 'Alicate' },
  ],
  'Objetos': [
    { word: 'Guarda-chuva', hint: 'Cabo' },
    { word: 'Telescópio', hint: 'Lente' },
    { word: 'Violão', hint: 'Corda' },
    { word: 'Geladeira', hint: 'Freezer' },
    { word: 'Bússola', hint: 'Norte' },
    { word: 'Lanterna', hint: 'Pilha' },
    { word: 'Dicionário', hint: 'Verbete' },
    { word: 'Cofre', hint: 'Segredo' },
    { word: 'Relógio', hint: 'Ponteiro' },
    { word: 'Espelho', hint: 'Reflexo' },
    { word: 'Mochila', hint: 'Alça' },
    { word: 'Microscópio', hint: 'Lente' },
  ],
}

function getImpostorHint(word: string): string {
  for (const entries of Object.values(WORD_CATEGORIES)) {
    const found = entries.find(e => e.word === word)
    if (found) return found.hint
  }
  return '???'
}

const PLAYER_COLORS = [
  { bg: 'from-violet-500 to-purple-600' },
  { bg: 'from-pink-500 to-rose-600' },
  { bg: 'from-orange-400 to-red-500' },
  { bg: 'from-emerald-400 to-teal-600' },
  { bg: 'from-sky-400 to-blue-600' },
  { bg: 'from-yellow-400 to-amber-500' },
  { bg: 'from-fuchsia-500 to-pink-700' },
  { bg: 'from-cyan-400 to-teal-500' },
]

function getColor(index: number) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length]
}

function Avatar({ name, colorIndex, size = 'md' }: { name: string; colorIndex: number; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const color = getColor(colorIndex)
  const sizes = {
    sm: 'w-9 h-9 text-base',
    md: 'w-12 h-12 text-xl',
    lg: 'w-16 h-16 text-2xl',
    xl: 'w-24 h-24 text-4xl',
  }
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${color.bg} flex items-center justify-center text-white font-black shadow-lg flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function Confetti({ colors }: { colors: string[] }) {
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    color: colors[i % colors.length],
    delay: `${Math.random() * 2}s`,
    duration: `${2 + Math.random() * 2}s`,
    size: `${6 + Math.random() * 8}px`,
    shape: Math.random() > 0.5 ? '50%' : '2px',
  }))
  return (
    <>
      {pieces.map(p => (
        <div key={p.id} className="confetti-piece" style={{
          left: p.left, top: '-20px',
          backgroundColor: p.color,
          width: p.size, height: p.size,
          borderRadius: p.shape,
          animationDelay: p.delay,
          animationDuration: p.duration,
        }} />
      ))}
    </>
  )
}

export default function RoomPage() {
  const params = useParams()
  const code = (params.code as string).toUpperCase()

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [joinName, setJoinName] = useState('')
  const [joining, setJoining] = useState(false)
  const [copied, setCopied] = useState(false)

  const [roleRevealed, setRoleRevealed] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [starting, setStarting] = useState(false)
  const [advancing, setAdvancing] = useState(false)

  const [selectedVote, setSelectedVote] = useState<string | null>(null)
  const [submittingVote, setSubmittingVote] = useState(false)

  const fetchPlayers = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from('impostor_players')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
    if (data) setPlayers(data)
  }, [])

  useEffect(() => {
    const storedId = localStorage.getItem(`impostor_room_${code}_playerId`)
    if (storedId) setMyPlayerId(storedId)

    async function init() {
      const { data: roomData } = await supabase
        .from('impostor_rooms').select('*').eq('code', code).single()

      if (!roomData) { setError('Sala não encontrada 😕'); setLoading(false); return }

      setRoom(roomData)
      await fetchPlayers(roomData.id)
      setLoading(false)

      const channel = supabase.channel(`impostor:${code}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'impostor_rooms', filter: `code=eq.${code}` },
          (p) => { if (p.new && Object.keys(p.new).length) setRoom(p.new as Room) })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'impostor_players' },
          () => fetchPlayers(roomData.id))
        .subscribe()

      const poll = setInterval(async () => {
        const { data: roomSnap } = await supabase
          .from('impostor_rooms').select('*').eq('code', code).single()
        if (roomSnap) setRoom(roomSnap)
        await fetchPlayers(roomData.id)
      }, 3000)

      return () => {
        supabase.removeChannel(channel)
        clearInterval(poll)
      }
    }

    init()
  }, [code, fetchPlayers])

  useEffect(() => {
    if (room?.status !== 'role_reveal' || players.length < 3) return
    const allReady = players.every(p => p.is_ready)
    if (allReady) {
      supabase.from('impostor_rooms')
        .update({ status: 'hints', current_hint_seat: 0 })
        .eq('id', room.id).eq('status', 'role_reveal').then()
    }
  }, [players, room])

  useEffect(() => {
    if (room?.status !== 'voting' || players.length < 3) return
    const allVoted = players.every(p => p.voted_for !== null)
    if (allVoted) {
      supabase.from('impostor_rooms')
        .update({ status: 'result' })
        .eq('id', room.id).eq('status', 'voting').then()
    }
  }, [players, room])

  useEffect(() => {
    if (room?.status === 'result') {
      setShowConfetti(true)
      const t = setTimeout(() => setShowConfetti(false), 6000)
      return () => clearTimeout(t)
    }
  }, [room?.status])

  useEffect(() => {
    if (room?.status === 'lobby' || room?.status === 'role_reveal') setRoleRevealed(false)
  }, [room?.status])

  const me = players.find(p => p.id === myPlayerId)
  const myColorIndex = players.findIndex(p => p.id === myPlayerId)
  const isHost = room?.host_player_id === myPlayerId
  const sorted = [...players].sort((a, b) => (a.seat_order ?? 999) - (b.seat_order ?? 999))

  const currentHintSeat = room?.current_hint_seat ?? 0
  const currentHintPlayer = sorted[currentHintSeat]
  const isMyHintTurn = currentHintPlayer?.id === myPlayerId

  const myVote = me?.voted_for ?? null
  const voteCounts = players.reduce((acc, p) => {
    if (p.voted_for) acc[p.voted_for] = (acc[p.voted_for] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const maxVotes = players.length > 0 ? Math.max(0, ...Object.values(voteCounts)) : 0
  const accusedIds = Object.entries(voteCounts).filter(([, c]) => c === maxVotes && maxVotes > 0).map(([id]) => id)
  const impostor = players.find(p => p.is_impostor)
  const citizensWin = accusedIds.length === 1 && accusedIds[0] === impostor?.id

  // ──────────── ACTIONS ────────────

  async function handleJoin() {
    if (!joinName.trim() || !room) return
    setJoining(true)
    const { data: player } = await supabase
      .from('impostor_players').insert({ room_id: room.id, name: joinName.trim() }).select().single()
    if (player) {
      localStorage.setItem(`impostor_room_${code}_playerId`, player.id)
      setMyPlayerId(player.id)
    }
    setJoining(false)
  }

  async function handleStartGame(categoryName?: string) {
    if (!room || starting) return
    setStarting(true)

    const { data: freshPlayers } = await supabase
      .from('impostor_players').select('*').eq('room_id', room.id)

    const list = freshPlayers ?? players
    if (list.length < 3) { setStarting(false); return }

    const cat = categoryName ?? Object.keys(WORD_CATEGORIES)[Math.floor(Math.random() * Object.keys(WORD_CATEGORIES).length)]
    const entries = WORD_CATEGORIES[cat]
    const entry = entries[Math.floor(Math.random() * entries.length)]

    const shuffled = [...list].sort(() => Math.random() - 0.5)
    const impostorIndex = Math.floor(Math.random() * shuffled.length)

    await Promise.all(shuffled.map((p, i) =>
      supabase.from('impostor_players').update({
        seat_order: i,
        is_impostor: i === impostorIndex,
        hint: null,
        voted_for: null,
        is_ready: false,
      }).eq('id', p.id)
    ))

    await supabase.from('impostor_rooms').update({
      status: 'role_reveal',
      secret_word: entry.word,
      category: cat,
      current_hint_seat: 0,
    }).eq('id', room.id)

    setStarting(false)
  }

  async function handleMarkReady() {
    if (!me || me.is_ready) return
    await supabase.from('impostor_players').update({ is_ready: true }).eq('id', me.id)
  }

  async function handleAdvanceTurn() {
    if (!room || advancing) return
    setAdvancing(true)
    const nextSeat = currentHintSeat + 1
    if (nextSeat >= players.length) {
      await supabase.from('impostor_rooms')
        .update({ status: 'voting', current_hint_seat: nextSeat })
        .eq('id', room.id)
    } else {
      await supabase.from('impostor_rooms')
        .update({ current_hint_seat: nextSeat })
        .eq('id', room.id)
    }
    setAdvancing(false)
  }

  async function handleSubmitVote() {
    if (!me || !selectedVote || myVote || submittingVote) return
    setSubmittingVote(true)
    await supabase.from('impostor_players').update({ voted_for: selectedVote }).eq('id', me.id)
    setSubmittingVote(false)
  }

  async function handleNewGame() {
    if (!room) return
    await Promise.all(players.map(p =>
      supabase.from('impostor_players').update({
        seat_order: null, is_impostor: false, hint: null, voted_for: null, is_ready: false,
      }).eq('id', p.id)
    ))
    await supabase.from('impostor_rooms').update({
      status: 'lobby', secret_word: null, category: null, current_hint_seat: 0,
    }).eq('id', room.id)
  }

  async function handleSameWordRound() {
    if (!room) return
    const shuffled = [...players].sort(() => Math.random() - 0.5)
    await Promise.all(shuffled.map((p, i) =>
      supabase.from('impostor_players').update({
        seat_order: i, voted_for: null,
      }).eq('id', p.id)
    ))
    await supabase.from('impostor_rooms').update({
      status: 'hints', current_hint_seat: 0,
    }).eq('id', room.id)
  }

  async function handleSkipVoting() {
    if (!room) return
    await supabase.from('impostor_rooms').update({ status: 'result' }).eq('id', room.id)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ──────────── LOADING / ERROR / JOIN ────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#120a0a] to-[#0a0f0a] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 float-anim">🕵️</div>
          <p className="text-white/60 text-lg">Carregando sala...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#120a0a] to-[#0a0f0a] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-white text-2xl font-bold mb-4">{error}</h1>
          <a href="/" className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 rounded-2xl transition-all">
            Voltar ao início
          </a>
        </div>
      </div>
    )
  }

  if (!myPlayerId) {
    if (room?.status !== 'lobby') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#120a0a] to-[#0a0f0a] flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-6xl mb-4">🎮</div>
            <h1 className="text-white text-2xl font-bold mb-2">Jogo já começou!</h1>
            <p className="text-white/50 mb-6">Você chegou tarde demais para esta rodada.</p>
            <a href="/" className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 rounded-2xl transition-all">Criar nova sala</a>
          </div>
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#120a0a] to-[#0a0f0a] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-6xl mb-2 float-anim inline-block">🕵️</div>
            <h1 className="text-white text-3xl font-black mb-1">Entrar na Sala</h1>
            <p className="text-red-300">Código: <span className="font-mono font-bold text-white tracking-widest">{code}</span></p>
          </div>
          <div className="bg-white/5 rounded-3xl p-6 border border-red-500/20">
            <input
              type="text" value={joinName} onChange={e => setJoinName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="Seu nome" maxLength={20}
              className="w-full bg-white/10 text-white placeholder-white/30 border-2 border-red-500/30 rounded-2xl px-5 py-3.5 text-lg mb-4 focus:border-red-400 transition-all"
              autoFocus
            />
            <button onClick={handleJoin} disabled={joining || !joinName.trim()}
              className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-50 hover:from-red-500 hover:to-orange-500 transition-all transform hover:scale-105 active:scale-95">
              {joining ? '⏳ Entrando...' : '🎮 Entrar no Jogo'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ──────────── MAIN GAME ────────────

  const resultConfettiColors = citizensWin
    ? ['#22c55e', '#4ade80', '#86efac', '#fbbf24', '#ffffff']
    : ['#ef4444', '#f97316', '#fbbf24', '#dc2626', '#7f1d1d']

  const CATEGORY_ICONS: Record<string, string> = {
    'Geral': '🌍', 'Comida': '🍕', 'Esportes': '⚽', 'Lugares': '📍',
    'Animais': '🦁', 'Profissões': '💼', 'Objetos': '📦',
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#120a0a] to-[#0a0a0f]">
      {showConfetti && <Confetti colors={resultConfettiColors} />}

      {/* Category Picker Overlay */}
      {showCategoryPicker && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1a1010] rounded-3xl p-6 border border-red-500/20 pop-in">
            <h3 className="text-white text-xl font-black mb-1 text-center">Escolha a categoria</h3>
            <p className="text-white/40 text-sm text-center mb-5">Ou deixa sortear automaticamente</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {Object.keys(WORD_CATEGORIES).map(cat => (
                <button key={cat} onClick={() => { setShowCategoryPicker(false); handleStartGame(cat) }}
                  className="flex items-center gap-2 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-white font-semibold py-3 px-4 rounded-2xl transition-all active:scale-95 text-sm">
                  <span>{CATEGORY_ICONS[cat]}</span>
                  <span>{cat}</span>
                </button>
              ))}
            </div>
            <button onClick={() => { setShowCategoryPicker(false); handleStartGame() }}
              className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black py-4 rounded-2xl transition-all active:scale-95">
              🎲 Sortear Categoria
            </button>
            <button onClick={() => setShowCategoryPicker(false)}
              className="w-full mt-2 text-white/40 hover:text-white/60 py-2 text-sm transition-all">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-red-800 rounded-full opacity-10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-800 rounded-full opacity-10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-4 flex items-center justify-between border-b border-white/10 backdrop-blur-sm sticky top-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🕵️</span>
          <span className="text-white font-black text-lg hidden sm:block">Impostor</span>
          {room?.category && room.status !== 'lobby' && room.status !== 'role_reveal' && (
            <span className="text-white/30 text-sm">{CATEGORY_ICONS[room.category ?? ''] ?? ''} {room.category}</span>
          )}
        </div>
        <button onClick={copyLink}
          className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-mono font-bold px-4 py-2 rounded-xl text-sm transition-all">
          <span className="tracking-widest">{code}</span>
          <span className="text-xs">{copied ? '✅' : '📋'}</span>
        </button>
      </header>

      <main className="relative z-10 p-4 max-w-xl mx-auto pb-20">

        {/* ═══════════ LOBBY ═══════════ */}
        {room?.status === 'lobby' && (
          <div className="mt-4">
            <div className="text-center mb-6">
              <p className="text-red-400/80 text-xs uppercase tracking-widest font-semibold mb-1">Sala aberta</p>
              <h2 className="text-white text-2xl font-black">Aguardando jogadores</h2>
              <p className="text-white/30 text-sm mt-1">
                Código: <span className="font-mono font-bold text-white/60">{code}</span>
              </p>
            </div>

            <div className="space-y-2 mb-6">
              {players.map((player, i) => (
                <div key={player.id}
                  className={`flex items-center gap-3 rounded-2xl p-3.5 border transition-all pop-in ${player.id === myPlayerId ? 'bg-red-500/10 border-red-400/30' : 'bg-white/4 border-white/8'}`}>
                  <Avatar name={player.name} colorIndex={i} size="sm" />
                  <div className="flex-1">
                    <p className="text-white font-bold">{player.name}</p>
                    {room.host_player_id === player.id && <p className="text-yellow-400 text-xs">👑 Anfitrião</p>}
                  </div>
                  {player.id === myPlayerId && <span className="text-red-400 text-xs font-semibold bg-red-500/10 px-2 py-0.5 rounded-lg">Você</span>}
                </div>
              ))}
              {players.length < 3 && (
                <div className="text-center py-8 text-white/25">
                  <div className="text-3xl mb-2">⏳</div>
                  <p className="text-sm">Mínimo 3 jogadores para começar</p>
                </div>
              )}
            </div>

            <button onClick={copyLink}
              className="w-full bg-white/5 hover:bg-white/8 text-white/50 hover:text-white/70 font-semibold py-3 rounded-2xl border border-white/8 transition-all mb-3 text-sm flex items-center justify-center gap-2">
              {copied ? '✅ Link copiado!' : '🔗 Copiar link da sala'}
            </button>

            {isHost && (
              <button
                onClick={() => !starting && players.length >= 3 && setShowCategoryPicker(true)}
                disabled={players.length < 3 || starting}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black py-5 rounded-2xl text-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl shadow-red-900/40 glow-red">
                {starting ? '⏳ Iniciando...' : players.length < 3 ? `⏳ Aguardando (${players.length}/3)` : `🚀 Iniciar Jogo · ${players.length} jogadores`}
              </button>
            )}
            {!isHost && (
              <div className="text-center text-white/30 py-3 text-sm">Aguardando o anfitrião iniciar...</div>
            )}
          </div>
        )}

        {/* ═══════════ ROLE REVEAL ═══════════ */}
        {room?.status === 'role_reveal' && (
          <div className="mt-4">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🤫</div>
              <h2 className="text-white text-2xl font-black mb-1">Hora do segredo!</h2>
              <p className="text-white/40 text-sm">Olhe sozinho. Não mostre pra ninguém!</p>
              {room.category && (
                <p className="text-orange-400/80 text-sm mt-2">{CATEGORY_ICONS[room.category]} Categoria: <strong className="text-orange-300">{room.category}</strong></p>
              )}
            </div>

            {!me?.is_ready ? (
              <div className="space-y-4">
                {!roleRevealed ? (
                  <button onClick={() => setRoleRevealed(true)}
                    className="w-full bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-white/15 rounded-3xl p-12 text-center hover:border-red-400/40 transition-all active:scale-95 group">
                    <div className="text-7xl mb-3 group-hover:scale-110 transition-transform">🃏</div>
                    <p className="text-white font-black text-xl">Toque para revelar seu papel</p>
                    <p className="text-white/30 text-sm mt-1">Certifique-se de estar olhando sozinho</p>
                  </button>
                ) : me?.is_impostor ? (
                  <div className="bg-gradient-to-br from-red-950 to-red-900/60 border-2 border-red-500/50 rounded-3xl p-8 text-center glow-red pop-in">
                    <div className="text-6xl mb-3">🕵️</div>
                    <p className="text-red-400 text-xs uppercase tracking-widest font-bold mb-2">Você é o...</p>
                    <p className="text-white text-5xl font-black mb-5">IMPOSTOR</p>
                    <div className="bg-black/30 rounded-2xl p-4 mb-2">
                      <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Sua palavra de pista</p>
                      <p className="text-yellow-300 text-3xl font-black">{room.secret_word ? getImpostorHint(room.secret_word) : '???'}</p>
                      <p className="text-white/30 text-xs mt-1">Use essa pista para blefar sem ser descoberto</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-emerald-950 to-emerald-900/60 border-2 border-emerald-500/50 rounded-3xl p-8 text-center glow-green pop-in">
                    <div className="text-6xl mb-3">👤</div>
                    <p className="text-emerald-400 text-xs uppercase tracking-widest font-bold mb-2">Você é um Cidadão</p>
                    <p className="text-white/50 text-sm mb-2">A palavra secreta é:</p>
                    <p className="text-white text-5xl font-black mb-4">{room.secret_word}</p>
                    <p className="text-emerald-200/50 text-sm">Dê uma dica sem ser óbvio demais — o Impostor não conhece a palavra!</p>
                  </div>
                )}

                {roleRevealed && (
                  <button onClick={handleMarkReady}
                    className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black py-5 rounded-2xl text-xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl shadow-red-900/40 slide-up">
                    ✅ Entendi, estou pronto!
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-white text-xl font-bold mb-1">Você está pronto!</p>
                <p className="text-white/40 text-sm mb-6">Aguardando os outros...</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {players.map((p) => (
                    <div key={p.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm ${p.is_ready ? 'bg-green-500/15 border-green-500/30 text-green-300' : 'bg-white/5 border-white/10 text-white/30'}`}>
                      <span>{p.is_ready ? '✓' : '⏳'}</span>
                      <span className="font-semibold">{p.name}</span>
                    </div>
                  ))}
                </div>
                {isHost && players.filter(p => p.is_ready).length >= Math.ceil(players.length * 0.8) && (
                  <button onClick={() => supabase.from('impostor_rooms').update({ status: 'hints', current_hint_seat: 0 }).eq('id', room.id).then()}
                    className="mt-5 bg-white/8 hover:bg-white/15 text-white/50 hover:text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all border border-white/10">
                    Avançar assim mesmo →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════ HINTS ═══════════ */}
        {room?.status === 'hints' && (
          <div className="mt-4">
            {/* Progress */}
            <div className="flex items-center justify-between mb-4 px-1">
              <p className="text-white/40 text-xs uppercase tracking-widest">Vez de dar dica</p>
              <p className="text-white/40 text-xs">{currentHintSeat}/{players.length}</p>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full mb-6 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${(currentHintSeat / players.length) * 100}%` }}
              />
            </div>

            {/* Current player spotlight */}
            {currentHintPlayer && (
              <div className={`rounded-3xl p-8 text-center mb-6 transition-all ${
                isMyHintTurn
                  ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-2 border-amber-400/50 glow-amber'
                  : `bg-gradient-to-br ${getColor(players.findIndex(p => p.id === currentHintPlayer.id)).bg} opacity-90`
              }`}>
                <Avatar name={currentHintPlayer.name} colorIndex={players.findIndex(p => p.id === currentHintPlayer.id)} size="xl" />
                <div className="mt-4">
                  {isMyHintTurn ? (
                    <>
                      <p className="text-amber-300 text-xs uppercase tracking-widest font-bold mb-1">É a sua vez!</p>
                      <p className="text-white text-3xl font-black">{currentHintPlayer.name}</p>
                      <p className="text-white/60 text-sm mt-2">Dê sua dica em voz alta para todos</p>
                    </>
                  ) : (
                    <>
                      <p className="text-white/70 text-xs uppercase tracking-widest mb-1">Dando dica agora</p>
                      <p className="text-white text-3xl font-black">{currentHintPlayer.name}</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* My word reminder */}
            {me && (
              me.is_impostor ? (
                <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-4 mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-red-400 text-lg">🕵️</span>
                    <p className="text-red-300 text-xs uppercase tracking-widest font-bold">Você é o IMPOSTOR</p>
                  </div>
                  <p className="text-white/40 text-xs mb-1">Sua palavra de pista (blefe com base nisso):</p>
                  <p className="text-yellow-300 font-black text-2xl">{room.secret_word ? getImpostorHint(room.secret_word) : '???'}</p>
                </div>
              ) : (
                <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-4 mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-white/30 text-xs uppercase tracking-widest">Palavra secreta</p>
                    <p className="text-white font-black text-2xl">{room.secret_word}</p>
                  </div>
                  <span className="text-emerald-400 text-2xl">👤</span>
                </div>
              )
            )}

            {/* Advance buttons */}
            <div className="space-y-2">
              {isMyHintTurn && (
                <button onClick={handleAdvanceTurn} disabled={advancing}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black py-5 rounded-2xl text-xl disabled:opacity-50 transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl shadow-amber-900/30 glow-amber">
                  {advancing ? '⏳' : '✅ Dei minha dica!'}
                </button>
              )}
              {isHost && !isMyHintTurn && (
                <button onClick={handleAdvanceTurn} disabled={advancing}
                  className="w-full bg-white/8 hover:bg-white/15 text-white/60 hover:text-white font-bold py-4 rounded-2xl border border-white/10 transition-all active:scale-95">
                  {advancing ? '⏳' : `⏭️ Pular vez de ${currentHintPlayer?.name}`}
                </button>
              )}
              {!isMyHintTurn && !isHost && (
                <div className="text-center text-white/30 py-4 text-sm">
                  Aguardando <strong className="text-white/50">{currentHintPlayer?.name}</strong>...
                </div>
              )}
            </div>

            {/* Order list */}
            <div className="mt-6 space-y-1.5">
              {sorted.map((player, idx) => {
                const colorIndex = players.findIndex(p => p.id === player.id)
                const isDone = idx < currentHintSeat
                const isCurrent = idx === currentHintSeat
                return (
                  <div key={player.id} className={`flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all ${
                    isCurrent ? 'bg-amber-500/15 border border-amber-500/30' :
                    isDone ? 'bg-green-500/8 border border-green-500/15 opacity-60' :
                    'bg-white/3 border border-white/5 opacity-40'
                  }`}>
                    <Avatar name={player.name} colorIndex={colorIndex} size="sm" />
                    <span className="text-white font-semibold text-sm flex-1">{player.name}</span>
                    <span className="text-lg">
                      {isDone ? '✅' : isCurrent ? '🎤' : '⏳'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══════════ VOTING ═══════════ */}
        {room?.status === 'voting' && (
          <div className="mt-4">
            <div className="text-center mb-6">
              <div className="text-5xl mb-2 float-anim inline-block">🗳️</div>
              <h2 className="text-white text-2xl font-black mb-1">Quem é o Impostor?</h2>
              <p className="text-white/40 text-sm">
                {players.filter(p => p.voted_for !== null).length}/{players.length} votaram
              </p>
            </div>

            {!myVote ? (
              <div>
                <div className="space-y-3 mb-5">
                  {players.filter(p => p.id !== myPlayerId).map((player) => {
                    const colorIndex = players.findIndex(p2 => p2.id === player.id)
                    const color = getColor(colorIndex)
                    const isSelected = selectedVote === player.id
                    return (
                      <button key={player.id} onClick={() => setSelectedVote(isSelected ? null : player.id)}
                        className={`w-full flex items-center gap-4 rounded-2xl p-4 border-2 transition-all active:scale-98 ${
                          isSelected ? 'bg-red-500/20 border-red-400/60 scale-[1.01]' : 'bg-white/5 border-white/10 hover:border-white/25'
                        }`}>
                        <Avatar name={player.name} colorIndex={colorIndex} />
                        <span className="text-white font-bold text-lg flex-1 text-left">{player.name}</span>
                        {isSelected && <span className="text-red-400 text-xl">🎯</span>}
                        {player.voted_for !== null && <span className="text-green-400 text-sm">✓ votou</span>}
                      </button>
                    )
                  })}
                </div>
                <button onClick={handleSubmitVote} disabled={!selectedVote || submittingVote}
                  className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black py-5 rounded-2xl text-xl disabled:opacity-40 transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl shadow-red-900/40">
                  {submittingVote ? '⏳ Votando...' : selectedVote ? `🗳️ Votar em ${players.find(p => p.id === selectedVote)?.name}` : 'Selecione alguém'}
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-white text-lg font-bold mb-1">Voto registrado!</p>
                <p className="text-white/40 text-sm mb-6">Você votou em <strong className="text-white/70">{players.find(p => p.id === myVote)?.name}</strong></p>
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {players.map((p) => (
                    <div key={p.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm ${p.voted_for !== null ? 'bg-green-500/15 border-green-500/30 text-green-300' : 'bg-white/5 border-white/8 text-white/30'}`}>
                      <span>{p.voted_for !== null ? '✓' : '⏳'}</span>
                      <span className="font-semibold">{p.name}</span>
                    </div>
                  ))}
                </div>
                {isHost && (
                  <button onClick={handleSkipVoting}
                    className="bg-white/8 hover:bg-white/15 text-white/50 hover:text-white font-semibold px-6 py-3 rounded-2xl text-sm border border-white/10 transition-all active:scale-95">
                    ⏭️ Pular votação → Ver resultado
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════ RESULT ═══════════ */}
        {room?.status === 'result' && (
          <div className="mt-4">
            {/* Winner */}
            <div className={`rounded-3xl p-8 text-center mb-5 ${
              citizensWin
                ? 'bg-gradient-to-br from-emerald-950 to-emerald-900/50 border-2 border-emerald-500/50 glow-green'
                : 'bg-gradient-to-br from-red-950 to-red-900/50 border-2 border-red-500/50 glow-red'
            }`}>
              <div className="text-7xl mb-3 float-anim inline-block">{citizensWin ? '🏆' : '🕵️'}</div>
              <h2 className="text-white text-4xl font-black mb-2">{citizensWin ? 'Cidadãos vencem!' : 'Impostor vence!'}</h2>
              <p className="text-white/60 text-base">
                {citizensWin ? 'O impostor foi descuberto!' : accusedIds.length > 1 ? 'Empate! O impostor escapou!' : 'O grupo votou na pessoa errada!'}
              </p>
            </div>

            {/* Word reveal */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4 text-center">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-1">A palavra secreta era</p>
              <p className="text-white text-4xl font-black">{room.secret_word}</p>
              <p className="text-white/20 text-xs mt-1">{CATEGORY_ICONS[room.category ?? '']} {room.category}</p>
              <div className="mt-3 pt-3 border-t border-white/8 flex items-center justify-center gap-3 text-sm">
                <span className="text-white/30">Pista do impostor:</span>
                <span className="text-yellow-300 font-bold">{room.secret_word ? getImpostorHint(room.secret_word) : '???'}</span>
              </div>
            </div>

            {/* Impostor reveal */}
            {impostor && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-4 flex items-center gap-4">
                <Avatar name={impostor.name} colorIndex={players.findIndex(p => p.id === impostor.id)} />
                <div className="flex-1">
                  <p className="text-red-300 text-xs font-bold uppercase tracking-wider">O Impostor era</p>
                  <p className="text-white font-black text-xl">{impostor.name}</p>
                </div>
                <span className="text-3xl">🕵️</span>
              </div>
            )}

            {/* Vote tally */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-4 mb-6">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Votação</p>
              <div className="space-y-2">
                {[...players].sort((a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0)).map((player) => {
                  const colorIndex = players.findIndex(p => p.id === player.id)
                  const votes = voteCounts[player.id] || 0
                  return (
                    <div key={player.id} className={`flex items-center gap-3 rounded-xl p-3 ${player.is_impostor ? 'bg-red-500/10 border border-red-500/20' : 'bg-transparent'}`}>
                      <Avatar name={player.name} colorIndex={colorIndex} size="sm" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold text-sm">{player.name}</span>
                          {player.is_impostor && <span className="text-xs bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded font-bold">🕵️ IMPOSTOR</span>}
                        </div>
                        <div className="flex gap-0.5 mt-0.5">
                          {Array.from({ length: votes }).map((_, i) => <span key={i} className="text-xs">🗳️</span>)}
                        </div>
                      </div>
                      <span className="text-white/30 text-sm font-mono">{votes}v</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {isHost ? (
              <div className="space-y-3">
                <button onClick={handleSameWordRound}
                  className="w-full bg-white/8 hover:bg-white/15 border border-white/15 text-white font-black py-4 rounded-2xl text-lg transition-all transform hover:scale-[1.02] active:scale-95">
                  🔁 Mesma palavra, nova rodada
                </button>
                <button onClick={handleNewGame}
                  className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black py-5 rounded-2xl text-xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl shadow-red-900/40 glow-red">
                  🔄 Nova palavra
                </button>
              </div>
            ) : (
              <p className="text-center text-white/30 text-sm">Aguardando o anfitrião iniciar uma nova rodada...</p>
            )}
          </div>
        )}

      </main>
    </div>
  )
}
