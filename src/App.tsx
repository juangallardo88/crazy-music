import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import './App.css'
import type { Song } from './models/Song'
import type { SessionUser } from './models/User'
import { AuthService } from './services/AuthService'
import { AudioService } from './services/AudioService'
import { DoublyLinkedList } from './structures/DoublyLinkedList'

type AddMode = 'first' | 'last' | 'position'
type AuthMode = 'login' | 'register'
type RepeatMode = 'off' | 'all' | 'one'
type PlayerIconName = 'shuffle' | 'previous' | 'play' | 'pause' | 'next' | 'repeat' | 'volume' | 'muted'

type AuthFormState = {
  username: string
  email: string
  password: string
  confirmPassword: string
}

const emptyAuthForm: AuthFormState = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
}

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '00:00'
  }

  const totalSeconds = Math.floor(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

const PlayerIcon = ({ name }: { name: PlayerIconName }) => {
  const paths: Record<PlayerIconName, string[]> = {
    shuffle: ['M18 14l4 4-4 4', 'M18 2l4 4-4 4', 'M2 18h2.5a5 5 0 0 0 4-2l7-10a5 5 0 0 1 4-2H22', 'M2 6h2.5a5 5 0 0 1 4 2l1 1', 'M14 15l1 1a5 5 0 0 0 4 2H22'],
    previous: ['M19 20 9 12l10-8v16z', 'M5 19V5'],
    play: ['m7 4 13 8-13 8V4z'],
    pause: ['M8 5v14', 'M16 5v14'],
    next: ['m5 4 10 8-10 8V4z', 'M19 5v14'],
    repeat: ['M17 2l4 4-4 4', 'M3 11V9a3 3 0 0 1 3-3h15', 'M7 22l-4-4 4-4', 'M21 13v2a3 3 0 0 1-3 3H3'],
    volume: ['M11 5 6 9H2v6h4l5 4V5z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M19 5a10 10 0 0 1 0 14'],
    muted: ['M11 5 6 9H2v6h4l5 4V5z', 'm22 9-6 6', 'm16 9 6 6'],
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name].map((path) => <path key={path} d={path} />)}
    </svg>
  )
}

const createSongFromFile = (file: File, index: number): Song => {
  const title = file.name.replace(/\.[^/.]+$/, '') || `Track ${index + 1}`
  const audioUrl = URL.createObjectURL(file)

  const song: Song = {
    id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    title,
    artist: 'Unknown Artist',
    duration: 0,
    audioUrl,
    fileName: file.name,
  }

  const metadataAudio = new Audio(audioUrl)
  metadataAudio.preload = 'metadata'
  metadataAudio.onloadedmetadata = () => {
    song.duration = Math.round(metadataAudio.duration || 0)
  }

  return song
}

function App() {
  const [playlistState, setPlaylistState] = useState(() => ({
    list: new DoublyLinkedList<Song>(),
    version: 0,
  }))
  const [searchTerm, setSearchTerm] = useState('')
  const [addMode, setAddMode] = useState<AddMode>('last')
  const [insertPosition, setInsertPosition] = useState(0)
  const [feedback, setFeedback] = useState('Ready to load local songs.')
  const [volume, setVolume] = useState(0.7)
  const [muted, setMuted] = useState(false)
  const [shuffleEnabled, setShuffleEnabled] = useState(false)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)

  const [sessionUser, setSessionUser] = useState<SessionUser | null>(() => AuthService.getSessionUser())
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authForm, setAuthForm] = useState<AuthFormState>(emptyAuthForm)
  const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string }>({
    type: 'info',
    text: 'Inicia sesión para acceder al reproductor.',
  })
  const [authLoading, setAuthLoading] = useState(false)

  useEffect(() => {
    const currentPath = window.location.pathname
    if (sessionUser) {
      if (currentPath !== '/player') {
        window.history.pushState({}, '', '/player')
      }
      return
    }

    if (currentPath !== '/') {
      window.history.pushState({}, '', '/')
    }
  }, [sessionUser])

  const audioServiceRef = useRef<AudioService | null>(null)

  if (!audioServiceRef.current) {
    audioServiceRef.current = new AudioService()
  }

  const audioService = audioServiceRef.current
  const list = playlistState.list
  const songs = useMemo(() => list.toArray(), [playlistState.version])
  const currentSong = list.current?.song ?? null

  const filteredSongs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    if (!query) {
      return songs
    }

    return songs.filter((song) => {
      const matchesTitle = song.title.toLowerCase().includes(query)
      const matchesArtist = song.artist.toLowerCase().includes(query)
      return matchesTitle || matchesArtist
    })
  }, [songs, searchTerm])

  const refreshList = () => {
    setPlaylistState((current) => ({
      ...current,
      version: current.version + 1,
    }))
  }

  const playSong = async (song: Song): Promise<void> => {
    const node = list.find(song.id)

    if (!node) {
      setFeedback('That song is no longer available in the playlist.')
      return
    }

    list.current = node
    refreshList()

    try {
      await audioService.playSong(song)
      setIsPlaying(true)
      setFeedback(`Now playing: ${song.title}`)
    } catch {
      setIsPlaying(false)
      setFeedback(`The browser blocked playback for ${song.title}.`)
    }
  }

  const handlePlayPause = async () => {
    if (!currentSong) {
      setFeedback('There is no song selected to play.')
      return
    }

    if (isPlaying) {
      audioService.pause()
      setIsPlaying(false)
      setFeedback(`Paused: ${currentSong.title}`)
      return
    }

    await playSong(currentSong)
  }

  const handlePrevious = async () => {
    const previousNode = list.previous()

    if (!previousNode?.song) {
      setFeedback('You are already at the first song.')
      return
    }

    refreshList()
    await playSong(previousNode.song)
  }

  const handleNext = async () => {
    if (shuffleEnabled) {
      const alternatives = songs.filter((song) => song.id !== currentSong?.id)
      const randomSong = alternatives[Math.floor(Math.random() * alternatives.length)]

      if (randomSong) {
        await playSong(randomSong)
        return
      }

      if (repeatMode === 'all' && currentSong) {
        await playSong(currentSong)
        return
      }

      setFeedback('There are no other songs to shuffle to.')
      return
    }

    const nextNode = list.next()

    if (!nextNode?.song) {
      if (repeatMode === 'all' && songs[0]) {
        await playSong(songs[0])
        return
      }

      setFeedback('You are already at the last song.')
      return
    }

    refreshList()
    await playSong(nextNode.song)
  }

  const handleAddFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    if (selectedFiles.length === 0) {
      return
    }

    const validAudioFiles = selectedFiles.filter((file) => file.type.startsWith('audio/'))

    if (validAudioFiles.length === 0) {
      setFeedback('Selected files are not valid audio files.')
      event.target.value = ''
      return
    }

    const requestedPosition = Number(insertPosition)
    const safePosition = Number.isFinite(requestedPosition) ? Math.max(0, requestedPosition) : 0

    validAudioFiles.forEach((file, index) => {
      const song = createSongFromFile(file, index)

      setPlaylistState((current) => {
        const targetList = current.list

        if (addMode === 'first') {
          targetList.addFirst(song)
        } else if (addMode === 'position') {
          targetList.insertAt(song, safePosition)
        } else {
          targetList.addLast(song)
        }

        return {
          ...current,
          version: current.version + 1,
        }
      })
    })

    const additionMessage =
      addMode === 'first'
        ? 'Added songs to the beginning of the list.'
        : addMode === 'position'
          ? 'Inserted songs at the requested position.'
          : 'Added songs to the end of the list.'

    setFeedback(`${validAudioFiles.length} song(s) loaded. ${additionMessage}`)
    event.target.value = ''
  }

  const handleRemoveSong = (songId: string) => {
    const removedSong = list.find(songId)?.song

    if (!removedSong) {
      return
    }

    list.remove(songId)
    refreshList()

    if (!list.current) {
      setIsPlaying(false)
      audioService.pause()
      setCurrentTime(0)
      setTotalDuration(0)
    }

    setFeedback(`Deleted: ${removedSong.title}`)
  }

  const handleSortAlphabetically = () => {
    list.sortAlphabetically()
    refreshList()
    setFeedback('Playlist sorted alphabetically by title.')
  }

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(event.target.value)
    audioService.setCurrentTime(nextTime)
    setCurrentTime(nextTime)
  }

  const handleAuthChange = (field: keyof AuthFormState, value: string) => {
    setAuthForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setAuthLoading(true)
    const result = await AuthService.registerUser(authForm)
    setAuthLoading(false)

    if (!result.success) {
      setAuthMessage({ type: 'error', text: result.message })
      return
    }

    setAuthMessage({ type: 'success', text: result.message })
    setAuthForm(emptyAuthForm)
    setAuthMode('login')
  }

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setAuthLoading(true)
    const result = await AuthService.loginUser({
      email: authForm.email,
      password: authForm.password,
    })
    setAuthLoading(false)

    if (!result.success || !result.user) {
      setAuthMessage({ type: 'error', text: result.message })
      return
    }

    setSessionUser(result.user)
    setAuthMessage({ type: 'success', text: result.message })
    setAuthForm(emptyAuthForm)
  }

  const handleLogout = () => {
    AuthService.logout()
    setSessionUser(null)
    setAuthMode('login')
    setAuthForm(emptyAuthForm)
    setAuthMessage({ type: 'info', text: 'Sesión cerrada. Inicia sesión para continuar.' })
  }

  useEffect(() => {
    audioService.setVolume(volume)
    audioService.setMuted(muted)
  }, [audioService, muted, volume])

  useEffect(() => {
    audioService.onTimeUpdate((nextCurrentTime, nextDuration) => {
      setCurrentTime(nextCurrentTime)
      if (nextDuration > 0) {
        setTotalDuration(nextDuration)
      }
    })

    audioService.onLoadedMetadata((nextDuration) => {
      setTotalDuration(nextDuration)
    })

    audioService.onEnded(() => {
      if (repeatMode === 'one' && currentSong) {
        void playSong(currentSong)
        return
      }

      if (shuffleEnabled) {
        const alternatives = songs.filter((song) => song.id !== currentSong?.id)
        const randomSong = alternatives[Math.floor(Math.random() * alternatives.length)]

        if (randomSong) {
          void playSong(randomSong)
          return
        }

        if (repeatMode === 'all' && currentSong) {
          void playSong(currentSong)
          return
        }
      }

      const nextNode = list.next()

      if (nextNode?.song) {
        refreshList()
        void playSong(nextNode.song)
        return
      }

      if (repeatMode === 'all' && songs[0]) {
        void playSong(songs[0])
        return
      }

      setIsPlaying(false)
      setFeedback('The playlist ended.')
    })
  }, [audioService, currentSong, list, playlistState.version, repeatMode, shuffleEnabled, songs])

  if (!sessionUser) {
    const isRegisterMode = authMode === 'register'

    return (
      <div className="auth-shell">
        <div className="auth-card panel">
          <div className="auth-brand">
            <p className="eyebrow">Music Player powered by Doubly Linked List</p>
            <h1>CRAZY MUSIC</h1>
          </div>

          <div className="auth-toggle">
            <button
              type="button"
              className={isRegisterMode ? 'toggle-button' : 'toggle-button active'}
              onClick={() => setAuthMode('login')}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              className={isRegisterMode ? 'toggle-button active' : 'toggle-button'}
              onClick={() => setAuthMode('register')}
            >
              Registrarse
            </button>
          </div>

          {authMessage.text ? (
            <div className={`auth-message ${authMessage.type}`}>{authMessage.text}</div>
          ) : null}

          {isRegisterMode ? (
            <form className="auth-form" onSubmit={handleRegisterSubmit}>
              <label>
                <span>Nombre de usuario</span>
                <input
                  type="text"
                  value={authForm.username}
                  onChange={(event) => handleAuthChange('username', event.target.value)}
                  placeholder="Tu nombre de usuario"
                />
              </label>

              <label>
                <span>Correo electrónico</span>
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  value={authForm.email}
                  onChange={(event) => handleAuthChange('email', event.target.value)}
                  placeholder="tu@correo.com"
                />
              </label>

              <label>
                <span>Contraseña</span>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => handleAuthChange('password', event.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </label>

              <label>
                <span>Confirmar contraseña</span>
                <input
                  type="password"
                  value={authForm.confirmPassword}
                  onChange={(event) => handleAuthChange('confirmPassword', event.target.value)}
                  placeholder="Repite tu contraseña"
                />
              </label>

              <button type="submit" className="primary-button auth-submit" disabled={authLoading}>
                {authLoading ? 'Registrando...' : 'Registrarse'}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleLoginSubmit}>
              <label>
                <span>Correo electrónico</span>
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  value={authForm.email}
                  onChange={(event) => handleAuthChange('email', event.target.value)}
                  placeholder="tu@correo.com"
                />
              </label>

              <label>
                <span>Contraseña</span>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => handleAuthChange('password', event.target.value)}
                  placeholder="Tu contraseña"
                />
              </label>

              <button type="submit" className="primary-button auth-submit" disabled={authLoading}>
                {authLoading ? 'Ingresando...' : 'Iniciar sesión'}
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  const currentPosition = list.getCurrentPosition()
  const firstSong = list.head?.song ?? null
  const lastSong = list.tail?.song ?? null

  return (
    <div className="app-shell">
      <header className="app-header panel">
        <div>
          <p className="eyebrow">Music Player powered by Doubly Linked List</p>
          <h1>CRAZY MUSIC</h1>
        </div>

        <div className="user-session-box">
          <span>Usuario: {sessionUser.username}</span>
          <button type="button" className="ghost-button" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="app-layout">
        <section className="primary-column">
          <div className="panel section-block">
            <div className="section-header">
              <h2>Playlist</h2>
              <div className="search-box">
                <label htmlFor="song-search">Search</label>
                <input
                  id="song-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by title or artist"
                />
              </div>
            </div>

            <div className="toolbar">
              <button type="button" className="primary-button" onClick={handleSortAlphabetically}>
                Sort A-Z
              </button>
              <span className="feedback-pill">{feedback}</span>
            </div>

            <div className="add-tools">
              <div className="file-upload-box">
                <label htmlFor="audio-upload">Add Songs</label>
                <input
                  id="audio-upload"
                  type="file"
                  multiple
                  accept="audio/*"
                  onChange={handleAddFiles}
                />
              </div>

              <div className="insert-box">
                <label htmlFor="add-mode">Add mode</label>
                <select
                  id="add-mode"
                  value={addMode}
                  onChange={(event) => setAddMode(event.target.value as AddMode)}
                >
                  <option value="first">Add First</option>
                  <option value="last">Add Last</option>
                  <option value="position">Insert at Position</option>
                </select>
              </div>

              <div className="insert-box">
                <label htmlFor="position-input">Position</label>
                <input
                  id="position-input"
                  type="number"
                  min="0"
                  step="1"
                  value={insertPosition}
                  onChange={(event) => setInsertPosition(Number(event.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="panel section-block">
            <div className="section-header compact-header">
              <h2>Song List</h2>
              <span>{songs.length} songs</span>
            </div>

            <div className="song-list">
              {filteredSongs.length === 0 ? (
                <div className="empty-state">No songs match the current search.</div>
              ) : (
                filteredSongs.map((song, index) => {
                  const isCurrent = currentSong?.id === song.id
                  const songPosition = songs.findIndex((item) => item.id === song.id)

                  return (
                    <div key={song.id} className={`song-row ${isCurrent ? 'active' : ''}`}>
                      <div className="song-main">
                        <span className="position-badge">#{songPosition >= 0 ? songPosition + 1 : index + 1}</span>
                        <div>
                          <div className="song-title">{song.title}</div>
                          <div className="song-meta">
                            {song.artist} • {formatDuration(song.duration)}
                          </div>
                        </div>
                      </div>

                      <div className="song-actions">
                        <button type="button" className="small-button" onClick={() => void playSong(song)}>
                          {isCurrent && isPlaying ? 'Play' : 'Play'}
                        </button>
                        <button type="button" className="ghost-button" onClick={() => handleRemoveSong(song.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </section>

        <aside className="secondary-column">
          <div className="panel player-panel">
            <p className="player-label">Now Playing</p>
            <h2>{currentSong?.title ?? 'No song selected'}</h2>
            <p className="artist-name">{currentSong?.artist ?? 'Unknown Artist'}</p>

            <div className="player-controls">
              <button
                type="button"
                className={`icon-control ${shuffleEnabled ? 'selected' : ''}`}
                onClick={() => setShuffleEnabled((enabled) => !enabled)}
                aria-label="Shuffle"
                aria-pressed={shuffleEnabled}
                title="Shuffle"
              >
                <PlayerIcon name="shuffle" />
              </button>
              <button type="button" className="icon-control" onClick={() => void handlePrevious()} aria-label="Previous" title="Previous">
                <PlayerIcon name="previous" />
              </button>
              <button
                type="button"
                className="play-control"
                onClick={() => void handlePlayPause()}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                <PlayerIcon name={isPlaying ? 'pause' : 'play'} />
              </button>
              <button type="button" className="icon-control" onClick={() => void handleNext()} aria-label="Next" title="Next">
                <PlayerIcon name="next" />
              </button>
              <button
                type="button"
                className={`icon-control ${repeatMode !== 'off' ? 'selected' : ''}`}
                onClick={() => setRepeatMode((mode) => (mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'))}
                aria-label={`Repeat ${repeatMode === 'off' ? 'off' : repeatMode === 'all' ? 'playlist' : 'current song'}`}
                aria-pressed={repeatMode !== 'off'}
                title={`Repeat: ${repeatMode === 'off' ? 'off' : repeatMode === 'all' ? 'playlist' : 'current song'}`}
              >
                <PlayerIcon name="repeat" />
                {repeatMode === 'one' ? <span className="repeat-one-mark">1</span> : null}
              </button>
            </div>

            <div className="progress-wrap">
              <div className="time-row">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(totalDuration)}</span>
              </div>
              <input
                aria-label="Seek through current song"
                type="range"
                min="0"
                max={Math.max(totalDuration, 0)}
                step="0.1"
                value={Math.min(currentTime, Math.max(totalDuration, 0))}
                style={{ background: `linear-gradient(to right, #1c4bd8 ${totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0}%, #dfe5f0 0)` }}
                onChange={handleSeek}
              />
            </div>

            <div className="volume-wrap">
              <label className="visually-hidden" htmlFor="volume-control">Volume</label>
              <div className="volume-control">
                <button
                  type="button"
                  className="volume-toggle"
                  onClick={() => setMuted((state) => !state)}
                  aria-label={muted ? 'Unmute volume' : 'Mute volume'}
                  title={muted ? 'Unmute volume' : 'Mute volume'}
                >
                  <PlayerIcon name={muted ? 'muted' : 'volume'} />
                </button>
                <input
                  id="volume-control"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  style={{ background: `linear-gradient(to right, #1c4bd8 ${volume * 100}%, #dfe5f0 0)` }}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  aria-label="Volume"
                />
              </div>
            </div>
          </div>

          <div className="panel stats-panel">
            <h3>Statistics</h3>
            <ul className="stats-list">
              <li>
                <span>SONGS</span>
                <strong>{songs.length}</strong>
              </li>
              <li>
                <span>LIST SIZE</span>
                <strong>{list.getSize()}</strong>
              </li>
              <li>
                <span>CURRENT POSITION</span>
                <strong>{currentPosition >= 0 ? currentPosition + 1 : 'N/A'}</strong>
              </li>
              <li>
                <span>HEAD</span>
                <strong>{firstSong?.title ?? 'None'}</strong>
              </li>
              <li>
                <span>TAIL</span>
                <strong>{lastSong?.title ?? 'None'}</strong>
              </li>
              <li>
                <span>CURRENT</span>
                <strong>{currentSong?.title ?? 'None'}</strong>
              </li>
            </ul>
          </div>
        </aside>
      </main>

    </div>
  )
}

export default App
