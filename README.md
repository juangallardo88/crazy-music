# CRAZY MUSIC

Music Player powered by Doubly Linked List

## Project objective

CRAZY MUSIC is a frontend academic application that demonstrates how a Doubly Linked List works while simulating a modern music player. The playlist is not stored in an array as the main source of truth. Instead, the project uses a real doubly linked structure where each song is a node with `previous` and `next` references.

## Technologies used

- TypeScript
- React
- Vite
- HTML5
- CSS
- HTML5 Audio API

## How to install

1. Open the project folder.
2. Run:

```bash
npm install
```

## How to run

```bash
npm run dev -- --host 0.0.0.0
```

Then open the local URL shown in the terminal, usually:

```text
http://localhost:5173/
```

## How to add local songs

1. Click the file input labeled "Add Songs".
2. Select one or multiple audio files from your computer or mobile device.
3. Choose whether to add them at the beginning, end, or a custom position.
4. The song is converted into a browser object URL and inserted into the doubly linked playlist.

The application works entirely in the browser and does not upload files to a server.

## How the Doubly Linked List works

Each song is stored as a `SongNode`, and the playlist is managed by a `DoublyLinkedList` class.

### SongNode

A node contains:

- the song data
- a reference to the previous node
- a reference to the next node

### Head

The `head` property points to the first node in the list.

### Tail

The `tail` property points to the last node in the list.

### Current

The `current` property marks the active song being played or selected.

### Next

The `next` reference moves from the current node to the following node in the playlist.

### Previous

The `previous` reference moves from the current node to the prior node in the playlist.

### Insertion

Songs can be inserted at the beginning, end, or in a specific position. The node references are updated so that all `previous` and `next` relationships remain consistent.

### Deletion

When a song is deleted, the previous and next links are reconnected. The `head`, `tail`, and `current` references are also adjusted when needed.

## Conceptual example

```text
HEAD ⇄ A ⇄ B ⇄ C ⇄ TAIL
                 ↑
              CURRENT
```

This shows the basic behavior of a doubly linked list: each node points backward and forward, while `current` indicates the active song.

## Academic presentation notes

The project is designed so a professor can clearly see:

- what a node is
- what a doubly linked list is
- where the head is
- where the tail is
- where the current node is
- how `next` and `previous` work
- how insertion operates
- how deletion updates the structure

## Main files

- src/models/Song.ts
- src/structures/SongNode.ts
- src/structures/DoublyLinkedList.ts
- src/services/AudioService.ts
- src/App.tsx
