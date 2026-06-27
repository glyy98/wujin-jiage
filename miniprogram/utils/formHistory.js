const MAX_STEPS = 30;

function cloneSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot));
}

function createHistory() {
  let undoStack = [];
  let redoStack = [];
  let current = null;

  return {
    reset(snapshot) {
      undoStack = [];
      redoStack = [];
      current = snapshot ? cloneSnapshot(snapshot) : null;
    },

    getCurrent() {
      return current ? cloneSnapshot(current) : null;
    },

    recordChange(newSnapshot) {
      const next = cloneSnapshot(newSnapshot);
      if (current && JSON.stringify(current) === JSON.stringify(next)) return;
      if (current !== null) {
        undoStack.push(cloneSnapshot(current));
        if (undoStack.length > MAX_STEPS) undoStack.shift();
      }
      redoStack = [];
      current = next;
    },

    canUndo() {
      return undoStack.length > 0;
    },

    canRedo() {
      return redoStack.length > 0;
    },

    undo() {
      if (!undoStack.length) return null;
      redoStack.push(cloneSnapshot(current));
      current = undoStack.pop();
      return cloneSnapshot(current);
    },

    redo() {
      if (!redoStack.length) return null;
      undoStack.push(cloneSnapshot(current));
      current = redoStack.pop();
      return cloneSnapshot(current);
    },
  };
}

module.exports = {
  createHistory,
};
