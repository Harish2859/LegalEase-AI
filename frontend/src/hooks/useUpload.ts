import { useState } from 'react';

export function useUpload() {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done'>('idle');
  // TODO: POST to /upload
  return { status };
}
