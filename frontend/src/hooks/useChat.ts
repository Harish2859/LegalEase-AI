import { useState } from 'react';

export function useChat() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  // TODO: POST to /analyze
  return { messages };
}
