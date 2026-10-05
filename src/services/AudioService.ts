import type { Song } from '../models/Song'

export class AudioService {
  public readonly audio: HTMLAudioElement

  constructor() {
    this.audio = new Audio()
    this.audio.preload = 'metadata'
    this.audio.volume = 0.7
  }

  setVolume(value: number): void {
    const safeValue = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.7))
    this.audio.volume = safeValue
  }

  setMuted(muted: boolean): void {
    this.audio.muted = muted
  }

  async playSong(song: Song): Promise<void> {
    this.audio.src = song.audioUrl
    this.audio.load()

    try {
      await this.audio.play()
    } catch (error) {
      console.error('Audio playback failed.', error)
      throw error
    }
  }

  pause(): void {
    this.audio.pause()
  }

  setCurrentTime(value: number): void {
    const safeValue = Number.isFinite(value) ? value : 0
    this.audio.currentTime = safeValue
  }

  onTimeUpdate(callback: (currentTime: number, duration: number) => void): void {
    this.audio.ontimeupdate = () => {
      callback(this.audio.currentTime, this.audio.duration || 0)
    }
  }

  onLoadedMetadata(callback: (duration: number) => void): void {
    this.audio.onloadedmetadata = () => {
      callback(this.audio.duration || 0)
    }
  }

  onEnded(callback: () => void): void {
    this.audio.onended = callback
  }

  get isPlaying(): boolean {
    return !this.audio.paused && !this.audio.ended
  }
}
