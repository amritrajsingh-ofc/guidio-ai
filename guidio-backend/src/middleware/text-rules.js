/**
 * Shared text rules for request validation.
 *
 * Control characters (for example the NUL character) are never typed by a
 * student. They only appear in broken or hostile input, so they are rejected.
 * Multi-line fields (chat messages, interview answers) may still contain
 * tabs and line breaks.
 */

export const INVALID_CHARACTERS_MESSAGE = "Contains invalid characters.";

function hasControlCharacters(value, allowWhitespace) {
  for (const character of value) {
    const code = character.codePointAt(0);
    const isControl = code < 32 || code === 127;

    if (!isControl) continue;

    // Tab (9), line feed (10) and carriage return (13) are normal in long text.
    if (allowWhitespace && (code === 9 || code === 10 || code === 13)) continue;

    return true;
  }

  return false;
}

/** For one-line fields: no control characters at all. */
export function isSingleLineText(value) {
  return !hasControlCharacters(value, false);
}

/** For multi-line fields: control characters except tab and line breaks. */
export function isMultiLineText(value) {
  return !hasControlCharacters(value, true);
}