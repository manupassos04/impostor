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

const WORD_CATEGORIES: Record<string, string[]> = {
  'Comida': ['Pizza', 'Sushi', 'Sorvete', 'Churrasco', 'Hambúrguer', 'Lasanha', 'Tapioca', 'Coxinha', 'Brigadeiro', 'Pastel', 'Frango', 'Pão de Queijo'],
  'Esportes': ['Futebol', 'Tênis', 'Natação', 'Vôlei', 'Basquete', 'Boxe', 'Surfe', 'Golfe', 'Ciclismo', 'Skate', 'Judô', 'Handebol'],
  'Lugares': ['Praia', 'Hospital', 'Aeroporto', 'Museu', 'Shopping', 'Igreja', 'Escola', 'Fazenda', 'Cassino', 'Circo', 'Biblioteca', 'Restaurante'],
  'Animais': ['Cachorro', 'Golfinho', 'Cobra', 'Elefante', 'Borboleta', 'Tubarão', 'Pinguim', 'Cavalo', 'Coruja', 'Leão', 'Polvo', 'Flamingo'],
  'Profissões': ['Médico', 'Professor', 'Astronauta', 'Detetive', 'Chef', 'Bombeiro', 'Piloto', 'Veterinário', 'Músico', 'Arquiteto', 'Policial', 'Dentista'],
  'Objetos': ['Guarda-chuva', 'Telescópio', 'Violão', 'Geladeira', 'Bússola', 'Lanterna', 'Dicionário', 'Cofre', 'Microscópio', 'Relógio', 'Espelho', 'Mochila'],
}

const PLAYER_COLORS = [
  { bg: 'from-violet-500 to-purple-600', border: 'border-purple-400/50', text: 'text-purple-300' },
  { bg: 'from-pink-500 to-rose-600', border: 'border-pink-400/50', text: 'text-pink-300' },
  { bg: 'from-orange-400 to-red-500', border: 'border-orange-400/50', text: 'text-orange-300' },
  { bg: 'from-emerald-400 to-teal-600', border: 'border-emerald-400/50', text: 'text-emerald-300' },
  { bg: 'from-sky-400 to-blue-600', border: 'border-sky-400/50', text: 'text-sky-300' },
  { bg: 'from-yellow-400 to-amber-500', border: 'border-yellow-400/50', text: 'text-yellow-300' },
  { bg: 'from-fuchsia-500 to-pink-700', border: 'border-fuchsia-400/50', text: 'text-fuchsia-300' },
  { bg: 'from-cyan-400 to-teal-500', border: 'border-cyan-400/50', text: 'text-cyan-300' },
]

function getColor(index: number) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length]
}

function Avatar({ name, colorIndex, size = 'md' }: { name: string; colorIndex: number; size?: 'sm' | 'md' | 'lg' }) {
  const color = getColor(colorIndex)
  const sizes = { sm: 'w-9 h-9 text-base', md: 'w-12 h-12 text-xl', lg: 'w-16 h-16 text-2xl' }
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${color.bg} flex items-center justify-center text-white font-black shadow-lg flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function Confetti({ colors }: { colors: string[] }) {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
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
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left, top: '-20px',
            backgroundColor: p.color,
            width: p.size, height: p.size,
            borderRadius: p.shape,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
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

  // role_reveal
  const [roleRevealed, setRoleRevealed] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  // category picker
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [starting, setStarting] = useState(false)

  // hints
  const [hintInput, setHintInput] = useState('')
  const [submittingHint, setSubmittingHint] = useState(false)

  // voting
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

    let channel: ReturnType<typeof supabase.channel>

    async function init() {
      const { data: roomData } = await supabase
        .from('impostor_rooms').select('*').eq('code', code).single()

      if (!roomData) { setError('Sala não encontrada 😕'); setLoading(false); return }

      setRoom(roomData)
      await fetchPlayers(roomData.id)
      setLoading(false)

      channel = supabase.channel(`impostor:${code}`)
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

  // Auto-advance: role_reveal → hints (when all ready)
  useEffect(() => {
    if (room?.status !== 'role_reveal' || players.length < 3) return
    const allReady = players.every(p => p.is_ready)
    if (allReady) {
      supabase.from('impostor_rooms')
        .update({ status: 'hints', current_hint_seat: 0 })
        .eq('id', room.id).eq('status', 'role_reveal').then()
    }
  }, [players, room])

  // Auto-advance: voting → result (when all voted)
  useEffect(() => {
    if (room?.status !== 'voting' || players.length < 3) return
    const allVoted = players.every(p => p.voted_for !== null)
    if (allVoted) {
      supabase.from('impostor_rooms')
        .update({ status: 'result' })
        .eq('id', room.id).eq('status', 'voting').then()
    }
  }, [players, room])

  // Confetti on result
  useEffect(() => {
    if (room?.status === 'result') {
      setShowConfetti(true)
      const t = setTimeout(() => setShowConfetti(false), 5000)
      return () => clearTimeout(t)
    }
  }, [room?.status])

  // Reset role reveal state when game resets
  useEffect(() => {
    if (room?.status === 'lobby') setRoleRevealed(false)
    if (room?.status === 'role_reveal') setRoleRevealed(false)
  }, [room?.status])

  const me = players.find(p => p.id === myPlayerId)
  const myColorIndex = players.findIndex(p => p.id === myPlayerId)
  const isHost = room?.host_player_id === myPlayerId
  const sorted = [...players].sort((a, b) => (a.seat_order ?? 999) - (b.seat_order ?? 999))

  // Hints phase
  const currentHintSeat = room?.current_hint_seat ?? 0
  const currentHintPlayer = sorted[currentHintSeat]
  const isMyHintTurn = currentHintPlayer?.id === myPlayerId

  // Voting / Result
  const myVote = me?.voted_for ?? null
  const voteCounts = players.reduce((acc, p) => {
    if (p.voted_for) acc[p.voted_for] = (acc[p.voted_for] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const maxVotes = players.length > 0 ? Math.max(0, ...Object.values(voteCounts)) : 0
  const accusedIds = Object.entries(voteCounts).filter(([, c]) => c === maxVotes && maxVotes > 0).map(([id]) => id)
  const impostor = players.find(p => p.is_impostor)
  const citizensWin = accusedIds.length === 1 && accusedIds[0] === impostor?.id

  // ──────────────────── ACTIONS ────────────────────

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
    setShowCategoryPicker(false)
    setStarting(true)

    const { data: freshPlayers } = await supabase
      .from('impostor_players').select('*').eq('room_id', room.id)

    const list = freshPlayers ?? players
    if (list.length < 3) { setStarting(false); return }

    const cat = categoryName ?? Object.keys(WORD_CATEGORIES)[Math.floor(Math.random() * Object.keys(WORD_CATEGORIES).length)]
    const words = WORD_CATEGORIES[cat]
    const secret_word = words[Math.floor(Math.random() * words.length)]

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
      secret_word,
      category: cat,
      current_hint_seat: 0,
    }).eq('id', room.id)

    setStarting(false)
  }

  async function handleMarkReady() {
    if (!me || me.is_ready) return
    await supabase.from('impostor_players').update({ is_ready: true }).eq('id', me.id)
  }

  async function handleSubmitHint() {
    if (!room || !hintInput.trim() || !me || submittingHint) return
    setSubmittingHint(true)

    await supabase.from('impostor_players').update({ hint: hintInput.trim() }).eq('id', me.id)

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

    setHintInput('')
    setSubmittingHint(false)
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

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ──────────────────── LOADING / ERROR / JOIN ────────────────────

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
            <a href="/" className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 rounded-2xl transition-all">
              Criar nova sala
            </a>
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
            <p className="text-red-300">
              Código: <span className="font-mono font-bold text-white tracking-widest">{code}</span>
            </p>
          </div>
          <div className="bg-white/5 rounded-3xl p-6 border border-red-500/20">
            <input
              type="text"
              value={joinName}
              onChange={e => setJoinName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="Seu nome"
              maxLength={20}
              className="w-full bg-white/10 text-white placeholder-white/30 border-2 border-red-500/30 rounded-2xl px-5 py-3.5 text-lg mb-4 focus:border-red-400 transition-all"
              autoFocus
            />
            <button
              onClick={handleJoin}
              disabled={joining || !joinName.trim()}
              className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-50 hover:from-red-500 hover:to-orange-500 transition-all transform hover:scale-105 active:scale-95"
            >
              {joining ? '⏳ Entrando...' : '🎮 Entrar no Jogo'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ──────────────────── MAIN GAME UI ────────────────────

  const resultConfettiColors = citizensWin
    ? ['#22c55e', '#4ade80', '#86efac', '#fbbf24', '#ffffff']
    : ['#ef4444', '#f97316', '#fbbf24', '#dc2626', '#111111']

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#120a0a] to-[#0a0f0a]">
      {showConfetti && <Confetti colors={resultConfettiColors} />}

      {/* Category Picker Overlay */}
      {showCategoryPicker && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1a1010] rounded-3xl p-6 border border-red-500/20 pop-in">
            <h3 className="text-white text-xl font-black mb-1 text-center">Escolha a categoria</h3>
            <p className="text-white/40 text-sm text-center mb-5">Ou deixa sortear automaticamente</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {Object.keys(WORD_CATEGORIES).map(cat => (
                <button
                  key={cat}
                  onClick={() => handleStartGame(cat)}
                  className="bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-white font-semibold py-3 rounded-2xl transition-all active:scale-95 text-sm"
                >
                  {cat}
                </button>
              ))}
            </div>
            <button
              onClick={() => handleStartGame()}
              className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black py-4 rounded-2xl transition-all active:scale-95"
            >
              🎲 Sortear Categoria
            </button>
            <button
              onClick={() => setShowCategoryPicker(false)}
              className="w-full mt-2 text-white/40 hover:text-white/60 py-2 text-sm transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-red-700 rounded-full opacity-8 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-700 rounded-full opacity-8 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-4 flex items-center justify-between border-b border-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🕵️</span>
          <span className="text-white font-black text-lg hidden sm:block">Impostor</span>
          {room?.category && room.status !== 'lobby' && room.status !== 'role_reveal' && (
            <span className="text-white/30 text-sm hidden sm:block">· {room.category}</span>
          )}
        </div>
        <button
          onClick={copyLink}
          className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-mono font-bold px-4 py-2 rounded-xl text-sm transition-all"
        >
          <span className="tracking-widest">{code}</span>
          <span className="text-xs">{copied ? '✅' : '📋'}</span>
        </button>
      </header>

      <main className="relative z-10 p-4 max-w-xl mx-auto pb-20">

        {/* ═══════════════ LOBBY ═══════════════ */}
        {room?.status === 'lobby' && (
          <div className="mt-6">
            <div className="text-center mb-8">
              <p className="text-red-300 text-sm uppercase tracking-widest font-semibold mb-1">Sala aberta</p>
              <h2 className="text-white text-3xl font-black mb-2">Aguardando jogadores</h2>
              <p className="text-white/40 text-sm">
                Compartilhe o código <strong className="text-white font-mono">{code}</strong> para seus amigos entrarem
              </p>
            </div>

            <div className="space-y-3 mb-8">
              {players.map((player, i) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-4 bg-white/5 rounded-2xl p-4 border ${player.id === myPlayerId ? 'border-red-400/50' : 'border-white/10'} pop-in`}
                >
                  <Avatar name={player.name} colorIndex={i} />
                  <div className="flex-1">
                    <p className="text-white font-bold text-lg">{player.name}</p>
                    {room.host_player_id === player.id && (
                      <p className="text-yellow-400 text-xs font-semibold">👑 Anfitrião</p>
                    )}
                  </div>
                  {player.id === myPlayerId && (
                    <span className="text-red-400 text-xs font-semibold bg-red-500/10 px-2 py-1 rounded-lg">Você</span>
                  )}
                </div>
              ))}

              {players.length < 3 && (
                <div className="text-center py-6 text-white/30">
                  <div className="text-3xl mb-2">⏳</div>
                  <p>Esperando mais jogadores...</p>
                  <p className="text-sm mt-1">Mínimo 3 jogadores para começar</p>
                </div>
              )}
            </div>

            <button
              onClick={copyLink}
              className="w-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-semibold py-3 rounded-2xl border border-white/10 transition-all mb-3 flex items-center justify-center gap-2"
            >
              {copied ? '✅ Link copiado!' : '🔗 Copiar link da sala'}
            </button>

            {isHost && (
              <button
                onClick={() => !starting && players.length >= 3 && setShowCategoryPicker(true)}
                disabled={players.length < 3 || starting}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black py-5 rounded-2xl text-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-red-900/50 glow-red"
              >
                {starting ? '⏳ Iniciando jogo...' : players.length < 3 ? `⏳ Esperando jogadores... (${players.length}/3)` : `🚀 Iniciar Jogo (${players.length} jogadores)`}
              </button>
            )}

            {!isHost && (
              <div className="text-center text-white/40 py-3">
                Esperando o anfitrião iniciar o jogo...
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ ROLE REVEAL ═══════════════ */}
        {room?.status === 'role_reveal' && (
          <div className="mt-6">
            <div className="text-center mb-8">
              <div className="text-5xl mb-3">🤫</div>
              <h2 className="text-white text-3xl font-black mb-2">Hora do segredo!</h2>
              <p className="text-white/50">Olhe sozinho para o seu papel. Não mostre para ninguém!</p>
              {room.category && (
                <p className="text-orange-300 text-sm mt-2">Categoria: <strong>{room.category}</strong></p>
              )}
            </div>

            {!me?.is_ready ? (
              <div className="space-y-4">
                {!roleRevealed ? (
                  <button
                    onClick={() => setRoleRevealed(true)}
                    className="w-full bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-white/20 rounded-3xl p-10 text-center hover:border-red-400/50 transition-all active:scale-95 group"
                  >
                    <div className="text-6xl mb-3 group-hover:scale-110 transition-transform">🃏</div>
                    <p className="text-white font-black text-xl">Toque para revelar seu papel</p>
                    <p className="text-white/40 text-sm mt-1">Certifique-se de estar olhando sozinho</p>
                  </button>
                ) : me?.is_impostor ? (
                  <div className="bg-gradient-to-br from-red-900/80 to-red-800/60 border-2 border-red-500/60 rounded-3xl p-8 text-center glow-red pop-in">
                    <div className="text-7xl mb-3">🕵️</div>
                    <p className="text-red-300 text-sm uppercase tracking-widest font-semibold mb-2">Você é o...</p>
                    <p className="text-white text-5xl font-black mb-4">IMPOSTOR</p>
                    <p className="text-red-200/70 text-sm leading-relaxed">
                      Você <strong>não sabe</strong> a palavra secreta.<br />
                      Ouça as dicas dos outros e tente blefar!
                    </p>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-emerald-900/80 to-emerald-800/60 border-2 border-emerald-500/60 rounded-3xl p-8 text-center glow-green pop-in">
                    <div className="text-7xl mb-3">👤</div>
                    <p className="text-emerald-300 text-sm uppercase tracking-widest font-semibold mb-2">Você é um Cidadão</p>
                    <p className="text-white/60 text-sm mb-2">A palavra secreta é:</p>
                    <p className="text-white text-5xl font-black mb-4">{room.secret_word}</p>
                    <p className="text-emerald-200/70 text-sm leading-relaxed">
                      Dê uma dica sobre a palavra sem ser óbvio demais.<br />
                      Não deixe o Impostor descobrir!
                    </p>
                  </div>
                )}

                {roleRevealed && (
                  <button
                    onClick={handleMarkReady}
                    className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black py-5 rounded-2xl text-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-red-900/50 slide-up"
                  >
                    ✅ Entendi, estou pronto!
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">✅</div>
                <p className="text-white text-xl font-bold mb-2">Você está pronto!</p>
                <p className="text-white/50 mb-6">
                  Aguardando os outros confirmarem...
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {players.map((p, i) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
                        p.is_ready
                          ? 'bg-green-500/20 border-green-500/40 text-green-300'
                          : 'bg-white/5 border-white/10 text-white/40'
                      }`}
                    >
                      <span>{p.is_ready ? '✓' : '⏳'}</span>
                      <span className="font-semibold">{p.name}</span>
                    </div>
                  ))}
                </div>
                {isHost && players.filter(p => p.is_ready).length >= Math.ceil(players.length * 0.8) && (
                  <button
                    onClick={() => supabase.from('impostor_rooms').update({ status: 'hints', current_hint_seat: 0 }).eq('id', room.id).then()}
                    className="mt-6 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white font-semibold px-6 py-3 rounded-2xl text-sm transition-all"
                  >
                    Avançar mesmo assim →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ HINTS ═══════════════ */}
        {room?.status === 'hints' && (
          <div className="mt-6">
            <div className="text-center mb-6">
              <p className="text-orange-300 text-sm uppercase tracking-widest font-semibold mb-1">Rodada de dicas</p>
              <h2 className="text-white text-2xl font-black">Cada um dá uma dica</h2>
              <p className="text-white/40 text-xs mt-1">Nem óbvia demais, nem vaga demais!</p>
            </div>

            {/* Hints list */}
            <div className="space-y-3 mb-6">
              {sorted.map((player, idx) => {
                const colorIndex = players.findIndex(p => p.id === player.id)
                const color = getColor(colorIndex)
                const isCurrent = player.id === currentHintPlayer?.id && player.hint === null
                const isMe = player.id === myPlayerId
                return (
                  <div
                    key={player.id}
                    className={`flex items-center gap-4 rounded-2xl p-4 border transition-all
                      ${isCurrent ? `bg-amber-500/10 border-amber-400/50 glow-amber` : 'bg-white/5 border-white/10'}
                    `}
                  >
                    <Avatar name={player.name} colorIndex={colorIndex} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-bold text-sm truncate">{player.name}</p>
                        {isMe && <span className="text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded flex-shrink-0">Você</span>}
                        {isCurrent && <span className="text-xs text-amber-400 animate-pulse flex-shrink-0">⏳ Vez dele</span>}
                      </div>
                      {player.hint ? (
                        <p className="text-white/80 text-sm mt-0.5 font-medium">💬 {player.hint}</p>
                      ) : isCurrent && isMe ? (
                        <p className="text-amber-300/60 text-sm italic">Digite sua dica abaixo...</p>
                      ) : isCurrent ? (
                        <p className="text-amber-300/60 text-sm italic animate-pulse">Digitando...</p>
                      ) : (
                        <p className="text-white/20 text-sm">—</p>
                      )}
                    </div>
                    {player.hint && <span className="text-green-400 flex-shrink-0">✓</span>}
                  </div>
                )
              })}
            </div>

            {/* Input for current player */}
            {isMyHintTurn && !me?.hint && (
              <div className="bg-amber-500/10 border-2 border-amber-400/30 rounded-3xl p-5 slide-up">
                <p className="text-amber-300 font-semibold text-sm uppercase tracking-wider mb-3 text-center">
                  ✨ É a sua vez! Dê uma dica sobre a palavra
                </p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={hintInput}
                    onChange={e => setHintInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmitHint()}
                    placeholder={me?.is_impostor ? 'Blefe com calma...' : `Uma dica sobre "${room.secret_word}"...`}
                    maxLength={60}
                    className="flex-1 bg-white/10 text-white placeholder-white/30 border-2 border-amber-400/30 rounded-2xl px-4 py-3 text-base focus:border-amber-400 transition-all"
                    autoFocus
                  />
                  <button
                    onClick={handleSubmitHint}
                    disabled={submittingHint || !hintInput.trim()}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black px-5 rounded-2xl disabled:opacity-50 transition-all active:scale-95 flex-shrink-0"
                  >
                    {submittingHint ? '⏳' : '→'}
                  </button>
                </div>
              </div>
            )}

            {!isMyHintTurn && me?.hint && (
              <div className="text-center text-white/40 py-4">
                Sua dica foi enviada. Aguardando os outros...
              </div>
            )}

            {!isMyHintTurn && !me?.hint && currentHintPlayer && (
              <div className="text-center text-white/40 py-4">
                Aguardando <strong className="text-white/60">{currentHintPlayer.name}</strong> dar a dica...
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ VOTING ═══════════════ */}
        {room?.status === 'voting' && (
          <div className="mt-6">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🗳️</div>
              <p className="text-red-300 text-sm uppercase tracking-widest font-semibold mb-1">Votação</p>
              <h2 className="text-white text-2xl font-black mb-1">Quem é o Impostor?</h2>
              <p className="text-white/40 text-sm">
                {players.filter(p => p.voted_for !== null).length}/{players.length} votaram
              </p>
            </div>

            {/* Hints summary */}
            <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/10">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Resumo das dicas</p>
              <div className="space-y-2">
                {sorted.map((player) => {
                  const colorIndex = players.findIndex(p => p.id === player.id)
                  return (
                    <div key={player.id} className="flex items-start gap-3">
                      <Avatar name={player.name} colorIndex={colorIndex} size="sm" />
                      <div>
                        <span className="text-white/60 text-xs font-semibold">{player.name}:</span>
                        <span className="text-white text-sm ml-1">{player.hint || '—'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {!myVote ? (
              <div>
                <p className="text-white/50 text-sm text-center mb-4">Toque em quem você acha que é o Impostor</p>
                <div className="space-y-3 mb-4">
                  {players.filter(p => p.id !== myPlayerId).map((player) => {
                    const colorIndex = players.findIndex(p2 => p2.id === player.id)
                    const color = getColor(colorIndex)
                    const isSelected = selectedVote === player.id
                    return (
                      <button
                        key={player.id}
                        onClick={() => setSelectedVote(isSelected ? null : player.id)}
                        className={`w-full flex items-center gap-4 rounded-2xl p-4 border-2 transition-all active:scale-98
                          ${isSelected
                            ? `bg-red-500/20 border-red-400/60 scale-[1.01]`
                            : 'bg-white/5 border-white/10 hover:border-white/30'
                          }`}
                      >
                        <Avatar name={player.name} colorIndex={colorIndex} />
                        <span className="text-white font-bold text-lg flex-1 text-left">{player.name}</span>
                        {isSelected && <span className="text-red-400 text-xl">🎯</span>}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={handleSubmitVote}
                  disabled={!selectedVote || submittingVote}
                  className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black py-5 rounded-2xl text-xl disabled:opacity-40 transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-red-900/50"
                >
                  {submittingVote ? '⏳ Votando...' : selectedVote ? `🗳️ Votar em ${players.find(p => p.id === selectedVote)?.name}` : 'Selecione alguém'}
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">✅</div>
                <p className="text-white text-xl font-bold mb-2">Voto registrado!</p>
                <p className="text-white/50 mb-6">
                  Você votou em <strong className="text-white">{players.find(p => p.id === myVote)?.name}</strong>
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {players.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
                        p.voted_for !== null
                          ? 'bg-green-500/20 border-green-500/40 text-green-300'
                          : 'bg-white/5 border-white/10 text-white/40'
                      }`}
                    >
                      <span>{p.voted_for !== null ? '✓' : '⏳'}</span>
                      <span className="font-semibold">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ RESULT ═══════════════ */}
        {room?.status === 'result' && (
          <div className="mt-6">
            {/* Winner banner */}
            <div className={`rounded-3xl p-8 text-center mb-6 ${
              citizensWin
                ? 'bg-gradient-to-br from-emerald-900/80 to-emerald-800/60 border-2 border-emerald-500/60 glow-green'
                : 'bg-gradient-to-br from-red-900/80 to-red-800/60 border-2 border-red-500/60 glow-red'
            }`}>
              <div className="text-7xl mb-3 float-anim inline-block">
                {citizensWin ? '🏆' : '🕵️'}
              </div>
              <h2 className="text-white text-4xl font-black mb-2">
                {citizensWin ? 'Cidadãos vencem!' : 'Impostor vence!'}
              </h2>
              <p className="text-white/70 text-lg">
                {citizensWin
                  ? 'O impostor foi descoberto!'
                  : accusedIds.length > 1
                    ? 'Empate! O impostor escapou!'
                    : 'O grupo votou na pessoa errada!'}
              </p>
            </div>

            {/* Secret word reveal */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 text-center">
              <p className="text-white/40 text-sm uppercase tracking-widest mb-1">A palavra secreta era</p>
              <p className="text-white text-4xl font-black">{room.secret_word}</p>
              <p className="text-white/30 text-sm mt-1">Categoria: {room.category}</p>
            </div>

            {/* Vote tally */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-4">Resultado da votação</p>
              <div className="space-y-3">
                {[...players]
                  .sort((a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0))
                  .map((player) => {
                    const colorIndex = players.findIndex(p => p.id === player.id)
                    const votes = voteCounts[player.id] || 0
                    const isAccused = accusedIds.includes(player.id)
                    const isImpostor = player.is_impostor
                    return (
                      <div
                        key={player.id}
                        className={`flex items-center gap-4 rounded-2xl p-3 border ${
                          isImpostor
                            ? 'bg-red-500/15 border-red-500/40'
                            : isAccused
                              ? 'bg-amber-500/10 border-amber-500/30'
                              : 'bg-transparent border-white/5'
                        }`}
                      >
                        <Avatar name={player.name} colorIndex={colorIndex} size="sm" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold">{player.name}</span>
                            {isImpostor && (
                              <span className="text-xs bg-red-500/30 text-red-300 px-2 py-0.5 rounded-full font-bold">
                                🕵️ IMPOSTOR
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            {Array.from({ length: votes }).map((_, i) => (
                              <span key={i} className="text-red-400 text-xs">🗳️</span>
                            ))}
                            {votes === 0 && <span className="text-white/20 text-xs">nenhum voto</span>}
                          </div>
                        </div>
                        <span className="text-white/40 font-mono text-sm">{votes} {votes === 1 ? 'voto' : 'votos'}</span>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* All hints recap */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Dicas dadas</p>
              <div className="space-y-2">
                {sorted.map((player) => {
                  const colorIndex = players.findIndex(p => p.id === player.id)
                  return (
                    <div key={player.id} className="flex items-start gap-3">
                      <Avatar name={player.name} colorIndex={colorIndex} size="sm" />
                      <div>
                        <span className={`text-xs font-bold ${player.is_impostor ? 'text-red-400' : 'text-white/50'}`}>
                          {player.name}{player.is_impostor ? ' 🕵️' : ''}:
                        </span>
                        <span className="text-white/80 text-sm ml-1">{player.hint || '—'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {isHost ? (
              <button
                onClick={handleNewGame}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black py-5 rounded-2xl text-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-red-900/50 glow-red"
              >
                🔄 Jogar Novamente
              </button>
            ) : (
              <p className="text-center text-white/40">
                Aguardando o anfitrião iniciar uma nova rodada...
              </p>
            )}
          </div>
        )}

      </main>
    </div>
  )
}
