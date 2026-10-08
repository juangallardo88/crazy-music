import { describe, expect, it } from 'vitest'
import type { Song } from '../models/Song'
import { DoublyLinkedList } from './DoublyLinkedList'

const makeSong = (id: string, title: string, artist = 'Unknown Artist', duration = 180): Song => ({
  id,
  title,
  artist,
  duration,
  audioUrl: `blob:/${id}.mp3`,
  fileName: `${title}.mp3`,
})

describe('DoublyLinkedList', () => {
  it('adds, inserts, removes, and navigates songs while keeping references consistent', () => {
    const list = new DoublyLinkedList<Song>()
    const songA = makeSong('a', 'A Song')
    const songB = makeSong('b', 'B Song')
    const songC = makeSong('c', 'C Song')
    const songD = makeSong('d', 'D Song')

    list.addLast(songA)
    list.addLast(songB)
    list.addFirst(songC)
    list.insertAt(songD, 1)

    expect(list.getSize()).toBe(4)
    expect(list.head?.song).toBe(songC)
    expect(list.tail?.song).toBe(songB)
    expect(list.current?.song).toBe(songC)

    expect(list.head?.next?.song).toBe(songD)
    expect(list.head?.next?.previous?.song).toBe(songC)
    expect(list.tail?.previous?.song).toBe(songA)

    list.next()
    expect(list.current?.song).toBe(songD)

    list.next()
    expect(list.current?.song).toBe(songA)

    list.previous()
    expect(list.current?.song).toBe(songD)

    list.remove(songC.id)
    expect(list.head?.song).toBe(songD)
    expect(list.current?.song).toBe(songD)

    list.removeAt(1)
    expect(list.get(0)?.song).toBe(songD)
    expect(list.get(1)?.song).toBe(songB)

    expect(list.find(songA.id)).toBeNull()
    expect(list.find('missing')).toBeNull()

    const sorted = new DoublyLinkedList<Song>()
    sorted.addLast(songB)
    sorted.addLast(songA)
    sorted.addLast(songC)
    sorted.sortAlphabetically()

    expect(sorted.get(0)?.song).toBe(songA)
    expect(sorted.get(1)?.song).toBe(songB)
    expect(sorted.get(2)?.song).toBe(songC)
  })

  it('inserts songs at the beginning, middle, and end while preserving order', () => {
    const list = new DoublyLinkedList<Song>()
    const first = makeSong('first', 'First Song')
    const middle = makeSong('middle', 'Middle Song')
    const last = makeSong('last', 'Last Song')
    const end = makeSong('end', 'End Song')

    list.addLast(first)
    list.addFirst(middle)
    list.insertAt(last, 1)
    list.insertAt(end, list.getSize())

    expect(list.toArray().map((song) => song.id)).toEqual(['middle', 'last', 'first', 'end'])
    expect(list.head?.song).toBe(middle)
    expect(list.tail?.song).toBe(end)
    expect(list.getCurrentPosition()).toBe(0)
    expect(list.get(1)?.song).toBe(last)
  })

  it('handles edge cases across empty and single-element operations', () => {
    const list = new DoublyLinkedList<Song>()
    const onlySong = makeSong('solo', 'Only Song')

    expect(list.isEmpty()).toBe(true)
    expect(list.getSize()).toBe(0)
    expect(list.next()).toBeNull()
    expect(list.previous()).toBeNull()
    expect(list.clear()).toBe(true)

    list.addFirst(onlySong)
    expect(list.head?.song).toBe(onlySong)
    expect(list.tail?.song).toBe(onlySong)
    expect(list.current?.song).toBe(onlySong)
    expect(list.get(0)?.song).toBe(onlySong)

    list.next()
    expect(list.current?.song).toBe(onlySong)
    list.previous()
    expect(list.current?.song).toBe(onlySong)

    list.remove(onlySong.id)
    expect(list.isEmpty()).toBe(true)
    expect(list.head).toBeNull()
    expect(list.tail).toBeNull()
    expect(list.current).toBeNull()
  })
})
