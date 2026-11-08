/**
 * @file core.mjs
 * @description In-memory business logic for Notes MCP server.
 * Shared between stdio server (index.mjs) and in-process adapter (adapter.ts).
 */

export const NOTE_TOOLS = [
  {
    name: 'create_note',
    description: 'Create a new note with a title and content',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the note' },
        content: { type: 'string', description: 'Body text of the note' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'read_note',
    description: 'Read a note by its unique identifier',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the note to retrieve' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_note',
    description: 'Update the title or content of an existing note',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the note to update' },
        title: { type: 'string', description: 'New title (optional)' },
        content: { type: 'string', description: 'New content (optional)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_note',
    description: 'Delete a note by its identifier',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the note to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_notes',
    description: 'List all notes available in the local store',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

export class NotesCore {
  constructor() {
    this.notes = new Map();
    this.idCounter = 4;
    this.loadFixtures();
  }

  /**
   * Seeds demo notes fixture data.
   */
  loadFixtures() {
    this.notes.clear();
    const now = Date.now();
    const fixtures = [
      {
        id: 'note-1',
        title: '[DEMO] Project Kickoff',
        content: '[DEMO] Welcome to FrankenMCP Monster Lab. Heterogeneous MCP routing is live.',
        created: now - 3600000,
        createdAt: now - 3600000,
        updatedAt: now - 3600000,
      },
      {
        id: 'note-2',
        title: '[DEMO] Architecture Blueprint',
        content: '[DEMO] Dynamic router trims unnecessary tool definitions per turn to save LLM context.',
        created: now - 1800000,
        createdAt: now - 1800000,
        updatedAt: now - 1800000,
      },
      {
        id: 'note-3',
        title: '[DEMO] Lab Supply Checklist',
        content: '[DEMO] Electrodes, lightning rod ground cables, test tubes, and spare CPU cores.',
        created: now - 600000,
        createdAt: now - 600000,
        updatedAt: now - 600000,
      },
    ];

    for (const fixture of fixtures) {
      this.notes.set(fixture.id, fixture);
    }
  }

  /**
   * Creates a new note.
   */
  createNote(title, content) {
    if (!title || typeof title !== 'string' || !content || typeof content !== 'string') {
      throw new Error('create_note requires non-empty string parameters: title, content');
    }
    const id = `note-${this.idCounter++}`;
    const now = Date.now();
    const note = {
      id,
      title: title.trim(),
      content: content.trim(),
      created: now,
      createdAt: now,
      updatedAt: now,
    };
    this.notes.set(id, note);
    return note;
  }

  /**
   * Returns all notes sorted by creation date (newest first).
   */
  listNotes() {
    return Array.from(this.notes.values()).sort(
      (a, b) => (b.createdAt || b.created || 0) - (a.createdAt || a.created || 0)
    );
  }

  /**
   * Reads a note by ID.
   */
  readNote(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('read_note requires parameter: id');
    }
    const note = this.notes.get(id);
    if (!note) {
      throw new Error(`Note not found with id: '${id}'`);
    }
    return note;
  }

  /**
   * Updates an existing note.
   */
  updateNote(id, title, content) {
    if (!id || typeof id !== 'string') {
      throw new Error('update_note requires parameter: id');
    }
    const note = this.notes.get(id);
    if (!note) {
      throw new Error(`Cannot update: note not found with id: '${id}'`);
    }
    if (typeof title === 'string') {
      note.title = title;
    }
    if (typeof content === 'string') {
      note.content = content;
    }
    note.updatedAt = Date.now();
    return note;
  }

  /**
   * Deletes a note by ID.
   */
  deleteNote(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('delete_note requires parameter: id');
    }
    if (!this.notes.has(id)) {
      throw new Error(`Cannot delete: note not found with id: '${id}'`);
    }
    this.notes.delete(id);
    return { success: true };
  }
}
