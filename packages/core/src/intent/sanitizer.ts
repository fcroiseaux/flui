import type { SanitizationConfig } from './intent.types';

// ── Unicode homoglyph normalization map ──────────────────────────────────
// Maps common Cyrillic/Greek lookalike characters to their ASCII equivalents.
// This prevents bypasses using visually identical characters.

const HOMOGLYPH_MAP: ReadonlyMap<string, string> = new Map([
  // Cyrillic lookalikes
  ['\u0430', 'a'], // а → a
  ['\u0435', 'e'], // е → e
  ['\u043E', 'o'], // о → o
  ['\u0440', 'p'], // р → p
  ['\u0441', 'c'], // с → c
  ['\u0443', 'y'], // у → y
  ['\u0445', 'x'], // х → x
  ['\u0410', 'A'], // А → A
  ['\u0412', 'B'], // В → B
  ['\u0415', 'E'], // Е → E
  ['\u041A', 'K'], // К → K
  ['\u041C', 'M'], // М → M
  ['\u041D', 'H'], // Н → H
  ['\u041E', 'O'], // О → O
  ['\u0420', 'P'], // Р → P
  ['\u0421', 'C'], // С → C
  ['\u0422', 'T'], // Т → T
  ['\u0425', 'X'], // Х → X
  // Greek lookalikes
  ['\u03B1', 'a'], // α → a
  ['\u03BF', 'o'], // ο → o
  ['\u0391', 'A'], // Α → A
  ['\u0392', 'B'], // Β → B
  ['\u0395', 'E'], // Ε → E
  ['\u0397', 'H'], // Η → H
  ['\u0399', 'I'], // Ι → I
  ['\u039A', 'K'], // Κ → K
  ['\u039C', 'M'], // Μ → M
  ['\u039D', 'N'], // Ν → N
  ['\u039F', 'O'], // Ο → O
  ['\u03A1', 'P'], // Ρ → P
  ['\u03A4', 'T'], // Τ → T
  ['\u03A7', 'X'], // Χ → X
  ['\u03A5', 'Y'], // Υ → Y
  ['\u0396', 'Z'], // Ζ → Z
]);

// ── Built-in injection pattern categories ────────────────────────────────

/** Category 1: Instruction overrides */
const INSTRUCTION_OVERRIDE_PATTERNS: readonly RegExp[] = [
  /ignore\s+(?:all\s+)?previous\s+instructions/gi,
  /disregard\s+(?:all\s+)?(?:above|previous|prior)/gi,
  /forget\s+(?:all\s+)?(?:your\s+)?instructions/gi,
  /override\s+(?:your\s+)?system/gi,
  /new\s+instructions\s*:/gi,
];

/** Category 2: Role injections */
const ROLE_INJECTION_PATTERNS: readonly RegExp[] = [
  /you\s+are\s+now\b/gi,
  /act\s+as\s+(?:a\s+)?/gi,
  /pretend\s+to\s+be\b/gi,
  /roleplay\s+as\b/gi,
  /your\s+new\s+role\s+is\b/gi,
];

/** Category 3: Delimiter escapes */
const DELIMITER_ESCAPE_PATTERNS: readonly RegExp[] = [
  /```/g,
  /----+/g,
  /<\|/g,
  /\|>/g,
  /<\|endoftext\|>/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
];

/** Category 4: System prompt extraction */
const SYSTEM_PROMPT_EXTRACTION_PATTERNS: readonly RegExp[] = [
  /repeat\s+your\s+system\s+prompt/gi,
  /show\s+me\s+your\s+instructions/gi,
  /what\s+are\s+your\s+rules/gi,
  /output\s+your\s+prompt/gi,
];

/**
 * Normalizes unicode homoglyphs to their ASCII equivalents for injection detection.
 * This is applied before pattern matching to prevent bypasses.
 */
function normalizeHomoglyphs(text: string): string {
  let result = '';
  for (const char of text) {
    const replacement = HOMOGLYPH_MAP.get(char);
    result += replacement !== undefined ? replacement : char;
  }
  return result;
}

/**
 * Detects and removes base64-encoded instruction blocks that contain injection patterns.
 * Looks for base64-encoded blocks (20+ chars of base64 alphabet) and checks if
 * the decoded content contains known injection keywords.
 */
function removeBase64Injections(text: string): string {
  const base64Pattern = /[A-Za-z0-9+/=]{20,}/g;
  return text.replace(base64Pattern, (match) => {
    try {
      const decoded = atob(match);
      const decodedLower = decoded.toLowerCase();
      const injectionKeywords = [
        'ignore previous',
        'disregard',
        'system prompt',
        'you are now',
        'act as',
        'new instructions',
        'override system',
      ];
      const containsInjection = injectionKeywords.some((keyword) => decodedLower.includes(keyword));
      return containsInjection ? '' : match;
    } catch {
      return match;
    }
  });
}

/**
 * Sanitizes intent text by removing known prompt injection patterns.
 *
 * This is a **pure function** — no side effects, no external state, deterministic output.
 *
 * Pattern categories:
 * 1. Instruction overrides (e.g., "ignore previous instructions")
 * 2. Role injections (e.g., "you are now", "act as a")
 * 3. Delimiter escapes (e.g., ```, ----, <|)
 * 4. System prompt extraction (e.g., "repeat your system prompt")
 * 5. Encoding-based bypasses (unicode homoglyphs, base64 instructions)
 *
 * @param text - The raw intent text to sanitize
 * @param config - Optional configuration with custom patterns
 * @returns Sanitized text safe for inclusion in LLM prompts
 */
export function sanitizeIntent(text: string, config?: SanitizationConfig | undefined): string {
  // Step 1: Normalize unicode homoglyphs to ASCII equivalents
  let sanitized = normalizeHomoglyphs(text);

  // Step 2: Remove base64-encoded injection attempts
  sanitized = removeBase64Injections(sanitized);

  // Step 3: Apply built-in pattern categories (1–4)
  const builtInPatterns: readonly RegExp[] = [
    ...INSTRUCTION_OVERRIDE_PATTERNS,
    ...ROLE_INJECTION_PATTERNS,
    ...DELIMITER_ESCAPE_PATTERNS,
    ...SYSTEM_PROMPT_EXTRACTION_PATTERNS,
  ];

  for (const pattern of builtInPatterns) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Step 4: Apply custom patterns from config
  if (config?.customPatterns !== undefined) {
    for (const pattern of config.customPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }
  }

  // Step 5: Normalize whitespace and trim
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}
