import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import './App.css'
import type { Song } from './models/Song'
import { AudioService } from './services/AudioService'
import { DoublyLinkedList } from './structures/DoublyLinkedList'

type AddMode = 'first' | 'last' | 'position'

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '00:00'
  }

  const totalSeconds = Math.floor(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
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
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)

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
    const nextNode = list.next()

    if (!nextNode?.song) {
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
      const nextNode = list.next()
      refreshList()

      if (nextNode?.song) {
        void playSong(nextNode.song)
        return
      }

      setIsPlaying(false)
      setFeedback('The playlist ended.')
    })
  }, [audioService, list, playlistState.version])

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
              <button type="button" className="control-button" onClick={() => void handlePrevious()}>
                Previous
              </button>
              <button type="button" className="control-button primary" onClick={() => void handlePlayPause()}>
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button type="button" className="control-button" onClick={() => void handleNext()}>
                Next
              </button>
            </div>

            <div className="progress-wrap">
              <input
                type="range"
                min="0"
                max={Math.max(totalDuration, 0)}
                step="0.1"
                value={Math.min(currentTime, Math.max(totalDuration, 0))}
                onChange={handleSeek}
              />
              <div className="time-row">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(totalDuration)}</span>
              </div>
            </div>

            <div className="volume-wrap">
              <label htmlFor="volume-control">Volume</label>
              <input
                id="volume-control"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
              <button type="button" className="mute-toggle" onClick={() => setMuted((state) => !state)}>
                {muted ? 'Unmute' : 'Mute'}
              </button>
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

      <section className="panel structure-panel">
        <h2>Data Structure</h2>
        <div className="structure-summary">
          <span className="structure-label">HEAD</span>
          {songs.length > 0 ? (
            <>
              {songs.map((song, index) => (
                <div key={song.id} className="structure-node-group">
                  <div className={`structure-node ${song.id === currentSong?.id ? 'current' : ''}`}>
                    <span className="node-name">{song.title}</span>
                    <small>PREVIOUS ←</small>
                    <small>NEXT →</small>
                  </div>
                  {index < songs.length - 1 ? <span className="structure-arrow">⇄</span> : null}
                </div>
              ))}
              <span className="structure-label">TAIL</span>
            </>
          ) : (
            <span className="empty-state-inline">Empty list</span>
          )}
        </div>

        {currentSong ? (
          <div className="current-indicator">
            <span className="indicator-label">CURRENT</span>
            <span className="indicator-arrow">↑</span>
            <span>{currentSong.title}</span>
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default App
