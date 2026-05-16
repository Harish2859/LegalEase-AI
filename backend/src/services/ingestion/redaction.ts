import { createHash } from 'crypto';

export const redactPII = async (text: string): Promise<string> => {
  // TODO: Implement axios call to local Presidio API
  console.log("PII Redaction triggered...");
  return text;
};

export const generateFileHash = (buffer: Buffer): string => {
  return createHash('sha256').update(buffer).digest('hex');
};
