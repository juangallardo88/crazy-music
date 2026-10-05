import type { Song } from '../models/Song'

export class SongNode {
  song: Song
  previous: SongNode | null
  next: SongNode | null

  constructor(song: Song) {
    this.song = song
    this.previous = null
    this.next = null
  }
}
