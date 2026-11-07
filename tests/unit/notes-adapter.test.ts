import { describe, it, expect } from 'vitest';
import { NotesCore, NOTE_TOOLS } from '@/mcp-servers/notes/core.mjs';
import { NotesAdapter } from '@/mcp-servers/notes/adapter';

describe('Task 2.1: Notes Core & In-Process Adapter', () => {
  describe('NotesCore logic and fixtures', () => {
    it('loads 3 fixtures automatically on initialization with [DEMO] tag', () => {
      const core = new NotesCore();
      const notes = core.listNotes();

      expect(notes).toHaveLength(3);
      expect(notes.map((n) => n.title)).toEqual([
        'Lab Supply Checklist',
        'Architecture Blueprint',
        'Project Kickoff',
      ]);

      // All fixtures contain [DEMO] tag
      for (const note of notes) {
        expect(note.content).toContain('[DEMO]');
      }
    });

    it('creates note and returns it alongside fixtures, sorted newest first', async () => {
      const core = new NotesCore();
      const created = core.createNote('New Lab Finding', '[DEMO] High voltage stabilized.');

      expect(created.id).toMatch(/^note-\d+$/);
      expect(created.title).toBe('New Lab Finding');

      const all = core.listNotes();
      expect(all).toHaveLength(4);
      // Newest note should be at index 0
      expect(all[0].id).toBe(created.id);
      expect(all[0].title).toBe('New Lab Finding');
    });

    it('performs CRUD operations correctly', () => {
      const core = new NotesCore();

      // Read
      const note1 = core.readNote('note-1');
      expect(note1.title).toBe('Project Kickoff');

      // Update
      const updated = core.updateNote('note-1', 'Updated Title', 'Updated Content');
      expect(updated.title).toBe('Updated Title');
      expect(updated.content).toBe('Updated Content');

      // Delete
      const delRes = core.deleteNote('note-1');
      expect(delRes.success).toBe(true);
      expect(() => core.readNote('note-1')).toThrow("Note not found with id: 'note-1'");
    });

    it('fails loud on invalid arguments or missing notes', () => {
      const core = new NotesCore();

      expect(() => (core as any).createNote('', '')).toThrow(/requires non-empty string parameters/);
      expect(() => (core as any).readNote('')).toThrow(/requires parameter: id/);
      expect(() => core.readNote('non-existent')).toThrow(/Note not found with id/);
      expect(() => core.updateNote('non-existent', 'x', 'y')).toThrow(/Cannot update: note not found/);
      expect(() => core.deleteNote('non-existent')).toThrow(/Cannot delete: note not found/);
    });
  });

  describe('NotesAdapter and Parity', () => {
    it('implements InProcessMCPAdapter and listTools matches stdio NOTE_TOOLS exactly', () => {
      const adapter = new NotesAdapter();

      expect(adapter.serverID).toBe('notes');
      expect(adapter.name).toBe('Notes Server');

      const tools = adapter.listTools();
      expect(tools).toHaveLength(5);
      expect(tools).toEqual(NOTE_TOOLS);
    });

    it('invokes tools directly in-process via invokeTool', async () => {
      const adapter = new NotesAdapter();

      // list_notes
      const initialNotes = await adapter.invokeTool('list_notes');
      expect(initialNotes).toHaveLength(3);

      // create_note
      const created = await adapter.invokeTool('create_note', {
        title: 'Adapter Note',
        content: 'Created via in-process adapter',
      });
      expect(created.id).toBeDefined();

      // read_note
      const read = await adapter.invokeTool('read_note', { id: created.id });
      expect(read.title).toBe('Adapter Note');

      // update_note
      const updated = await adapter.invokeTool('update_note', {
        id: created.id,
        title: 'Updated Adapter Note',
      });
      expect(updated.title).toBe('Updated Adapter Note');

      // delete_note
      const deleted = await adapter.invokeTool('delete_note', { id: created.id });
      expect(deleted.success).toBe(true);

      // unknown tool
      await expect(adapter.invokeTool('unknown_tool')).rejects.toThrow("Unknown tool: 'unknown_tool'");
    });
  });
});
