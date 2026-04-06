// ROUTflex — Logger
// Extracted from map.html — Phase 3 Wave 1

const logger = Object.freeze({
  info(message, context) {
    if (context !== undefined) {
      console.info(message, context);
      return;
    }
    console.info(message);
  },
  warn(message, context) {
    if (context !== undefined) {
      console.warn(message, context);
      return;
    }
    console.warn(message);
  },
  error(message, context) {
    if (context !== undefined) {
      console.error(message, context);
      return;
    }
    console.error(message);
  }
});
