import { describe, it, expect } from 'vitest';
import { extractToolArguments } from '@/lib/server/extractToolArguments';

describe('Playground Chat - Task 3.2: Tool Argument Extraction Module', () => {
  describe('Notes Server Patterns', () => {
    it('extracts arguments for create_note with "about" pattern', () => {
      const args = extractToolArguments(
        'Add a note about team retrospective',
        'create_note',
        'notes'
      );
      expect(args).toEqual({
        title: 'team retrospective',
        content: 'team retrospective',
      });
    });

    it('extracts arguments for create_note with "titled" pattern', () => {
      const args = extractToolArguments(
        'Create a note titled Project Roadmap',
        'create_note',
        'notes'
      );
      expect(args).toEqual({
        title: 'Project Roadmap',
        content: 'Project Roadmap',
      });
    });

    it('extracts arguments for create_note with direct phrase', () => {
      const args = extractToolArguments('Create note Shopping list', 'create_note', 'notes');
      expect(args).toEqual({
        title: 'Shopping list',
        content: 'Shopping list',
      });
    });

    it('returns empty object for list_notes tool', () => {
      const args = extractToolArguments('Show all my notes', 'list_notes', 'notes');
      expect(args).toEqual({});
    });

    it('returns null for other note tools requiring explicit IDs', () => {
      expect(extractToolArguments('Read note 123', 'read_note', 'notes')).toBeNull();
      expect(extractToolArguments('Delete note 456', 'delete_note', 'notes')).toBeNull();
      expect(extractToolArguments('Update note 789', 'update_note', 'notes')).toBeNull();
    });

    it('returns null for non-matching notes query', () => {
      const args = extractToolArguments('Hello world notes', 'create_note', 'notes');
      expect(args).toBeNull();
    });
  });

  describe('Tasks Server Patterns', () => {
    it('extracts arguments for create_task with "Add task"', () => {
      const args = extractToolArguments('Add task write documentation', 'create_task', 'tasks');
      expect(args).toEqual({
        title: 'write documentation',
        priority: 'medium',
      });
    });

    it('extracts arguments for create_task with "Create a task"', () => {
      const args = extractToolArguments('Create a task deploy to production', 'create_task', 'tasks');
      expect(args).toEqual({
        title: 'deploy to production',
        priority: 'medium',
      });
    });

    it('returns empty object for list_tasks tool', () => {
      const args = extractToolArguments('List all active tasks', 'list_tasks', 'tasks');
      expect(args).toEqual({});
    });

    it('returns null for other task tools requiring explicit IDs', () => {
      expect(extractToolArguments('Toggle task 1', 'toggle_task', 'tasks')).toBeNull();
      expect(extractToolArguments('Delete task 2', 'delete_task', 'tasks')).toBeNull();
    });

    it('returns null for non-matching tasks query', () => {
      const args = extractToolArguments('General task query', 'create_task', 'tasks');
      expect(args).toBeNull();
    });
  });

  describe('Calculator Server Patterns', () => {
    it('extracts arguments for add with integer and float operands', () => {
      expect(extractToolArguments('What is 42 + 58?', 'add', 'calculator')).toEqual({
        a: 42,
        b: 58,
      });
      expect(extractToolArguments('Calculate 12.5 + 7.5', 'add', 'calculator')).toEqual({
        a: 12.5,
        b: 7.5,
      });
    });

    it('extracts arguments for subtract', () => {
      expect(extractToolArguments('Calculate 100 - 37', 'subtract', 'calculator')).toEqual({
        a: 100,
        b: 37,
      });
      expect(extractToolArguments('9.5 - 2.5', 'subtract', 'calculator')).toEqual({
        a: 9.5,
        b: 2.5,
      });
    });

    it('extracts arguments for multiply with * and ×', () => {
      expect(extractToolArguments('What is 6 * 7?', 'multiply', 'calculator')).toEqual({
        a: 6,
        b: 7,
      });
      expect(extractToolArguments('Calculate 8 × 9', 'multiply', 'calculator')).toEqual({
        a: 8,
        b: 9,
      });
      expect(extractToolArguments('12.5 * 4', 'multiply', 'calculator')).toEqual({
        a: 12.5,
        b: 4,
      });
    });

    it('extracts arguments for divide with / and ÷', () => {
      expect(extractToolArguments('144 / 12', 'divide', 'calculator')).toEqual({
        a: 144,
        b: 12,
      });
      expect(extractToolArguments('What is 100 ÷ 4?', 'divide', 'calculator')).toEqual({
        a: 100,
        b: 4,
      });
    });

    it('returns null for non-matching calculator query', () => {
      expect(extractToolArguments('Tell me a math joke', 'add', 'calculator')).toBeNull();
    });
  });

  describe('Edge Cases & Unknown Servers', () => {
    it('returns null for empty, whitespace, or invalid query inputs', () => {
      expect(extractToolArguments('', 'add', 'calculator')).toBeNull();
      expect(extractToolArguments('   ', 'add', 'calculator')).toBeNull();
      expect(extractToolArguments(null as any, 'add', 'calculator')).toBeNull();
    });

    it('returns null for unrecognized server IDs', () => {
      expect(extractToolArguments('What is 1 + 1?', 'add', 'unknown_server')).toBeNull();
    });
  });
});
