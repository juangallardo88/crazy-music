import type { Song } from '../models/Song'
import { SongNode } from './SongNode'

export class DoublyLinkedList<T extends Song> {
  head: SongNode | null
  tail: SongNode | null
  current: SongNode | null
  size: number

  constructor() {
    this.head = null
    this.tail = null
    this.current = null
    this.size = 0
  }

  addFirst(song: T): SongNode {
    const node = new SongNode(song)

    if (this.isEmpty()) {
      this.head = node
      this.tail = node
      this.current = node
      this.size = 1
      return node
    }

    const previousHead = this.head
    if (previousHead === null) {
      throw new Error('Head cannot be null when adding a node to a non-empty list.')
    }

    node.next = previousHead
    previousHead.previous = node
    this.head = node
    this.current = node
    this.size += 1
    return node
  }

  addLast(song: T): SongNode {
    const node = new SongNode(song)

    if (this.isEmpty()) {
      this.head = node
      this.tail = node
      this.current = node
      this.size = 1
      return node
    }

    const previousTail = this.tail
    if (previousTail === null) {
      throw new Error('Tail cannot be null when adding a node to a non-empty list.')
    }

    node.previous = previousTail
    previousTail.next = node
    this.tail = node
    this.size += 1
    return node
  }

  insertAt(song: T, position: number): SongNode | null {
    if (this.isEmpty()) {
      return this.addFirst(song)
    }

    const safePosition = Math.max(0, Math.min(position, this.size))

    if (safePosition === 0) {
      return this.addFirst(song)
    }

    if (safePosition === this.size) {
      return this.addLast(song)
    }

    const node = new SongNode(song)
    const target = this.get(safePosition)

    if (!target) {
      return this.addLast(song)
    }

    node.previous = target.previous
    node.next = target

    if (target.previous) {
      target.previous.next = node
    }

    target.previous = node
    this.size += 1

    return node
  }

  remove(songId: string): SongNode | null {
    const target = this.find(songId)
    if (!target) {
      return null
    }

    return this.removeNode(target)
  }

  removeAt(position: number): SongNode | null {
    const target = this.get(position)
    if (!target) {
      return null
    }

    return this.removeNode(target)
  }

  get(position: number): SongNode | null {
    if (position < 0 || position >= this.size) {
      return null
    }

    let currentNode = this.head
    let index = 0

    while (currentNode && index < position) {
      currentNode = currentNode.next
      index += 1
    }

    return currentNode
  }

  find(songId: string): SongNode | null {
    let currentNode = this.head

    while (currentNode) {
      if (currentNode.song.id === songId) {
        return currentNode
      }
      currentNode = currentNode.next
    }

    return null
  }

  next(): SongNode | null {
    if (!this.current) {
      return this.head
    }

    if (!this.current.next) {
      this.current = this.tail
      return this.current
    }

    this.current = this.current.next
    return this.current
  }

  previous(): SongNode | null {
    if (!this.current) {
      return this.tail
    }

    if (!this.current.previous) {
      this.current = this.head
      return this.current
    }

    this.current = this.current.previous
    return this.current
  }

  clear(): boolean {
    this.head = null
    this.tail = null
    this.current = null
    this.size = 0
    return true
  }

  isEmpty(): boolean {
    return this.size === 0
  }

  getSize(): number {
    return this.size
  }

  getCurrentPosition(): number {
    if (!this.current) {
      return -1
    }

    let index = 0
    let currentNode = this.head

    while (currentNode) {
      if (currentNode === this.current) {
        return index
      }
      currentNode = currentNode.next
      index += 1
    }

    return -1
  }

  toArray(): T[] {
    const items: T[] = []
    let currentNode = this.head

    while (currentNode) {
      items.push(currentNode.song as T)
      currentNode = currentNode.next
    }

    return items
  }

  sortAlphabetically(): void {
    if (this.size < 2) {
      return
    }

    const currentSongId = this.current?.song.id ?? null
    const orderedNodes: SongNode[] = []
    let currentNode = this.head

    while (currentNode) {
      orderedNodes.push(currentNode)
      currentNode = currentNode.next
    }

    orderedNodes.sort((left, right) =>
      left.song.title.localeCompare(right.song.title, undefined, {
        sensitivity: 'base',
      }),
    )

    this.head = null
    this.tail = null
    this.current = null
    this.size = 0

    orderedNodes.forEach((node, index) => {
      node.previous = null
      node.next = null

      if (index === 0) {
        this.head = node
      }

      if (index > 0) {
        const previousNode = orderedNodes[index - 1]
        previousNode.next = node
        node.previous = previousNode
      }

      this.tail = node
      this.size += 1
    })

    this.current = currentSongId ? this.find(currentSongId) : this.head
  }

  private removeNode(node: SongNode): SongNode | null {
    if (this.size === 1) {
      const removed = this.head
      this.clear()
      return removed
    }

    if (node.previous) {
      node.previous.next = node.next
    } else {
      this.head = node.next
    }

    if (node.next) {
      node.next.previous = node.previous
    } else {
      this.tail = node.previous
    }

    const nextCurrent = node.next ?? node.previous
    if (this.current === node) {
      this.current = nextCurrent ?? this.head ?? this.tail ?? null
    }

    node.previous = null
    node.next = null
    this.size -= 1

    return node
  }
}
