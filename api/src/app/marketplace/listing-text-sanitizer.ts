import { BadRequestException } from '@nestjs/common';

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/i;
const SOCIAL_RE = /\b(?:instagram|facebook|whatsapp|telegram|tiktok|discord|twitter|x\.com|wa\.me|t\.me)\b/i;
const DIRECT_CONTACT_RE = /\b(?:contactame|contactame por|escribime|llamame|hablame|por fuera|arreglamos aparte|cerremos afuera)\b/i;

function normalizeLineBreaks(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function normalizeRequiredText(value: string, fieldName: string): string {
  const normalized = normalizeLineBreaks(value ?? '').trim();
  if (!normalized) {
    throw new BadRequestException(`${fieldName} is required`);
  }
  assertNoDirectContact(normalized, fieldName);
  return normalized;
}

export function normalizeOptionalText(value: string | undefined | null, fieldName: string) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = normalizeLineBreaks(value).trim();
  if (!normalized) {
    return undefined;
  }
  assertNoDirectContact(normalized, fieldName);
  return normalized;
}

export function assertNoDirectContact(value: string, fieldName: string) {
  if (
    EMAIL_RE.test(value) ||
    URL_RE.test(value) ||
    PHONE_RE.test(value) ||
    SOCIAL_RE.test(value) ||
    DIRECT_CONTACT_RE.test(value)
  ) {
    throw new BadRequestException(
      `${fieldName} contains direct contact details or external contact instructions`,
    );
  }
}
