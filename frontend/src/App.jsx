import { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import RedFlagReport from './components/RedFlagReport';
import { deleteDocument } from './api/client';
import { Scale, Trash2 } from 'lucide-react';

const API = 'http://localhost:3001';

function App() {
  const [docId, setDocId]       = useState(null);
  const [filename, setFilename] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'flags'

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res  = await fetch(`${API}/upload`, { method: 'POST', body: form });
      const data = await res.json();
      setDocId(data.documentId);
      setFilename(file.name);
      setActiveTab('chat');
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!docId) return;
    await deleteDocument(docId).catch(console.error);
    setDocId(null);
    setFilename(null);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-slate-800 p-4 gap-4">
        <div className="flex items-center gap-2 mb-2">
          <Scale size={18} className="text-blue-400" />
          <span className="font-bold text-sm tracking-wide">LegalEase AI</span>
        </div>

        <label className={`cursor-pointer text-center text-xs px-3 py-2 rounded-lg border border-dashed transition-colors ${uploading ? 'opacity-50 pointer-events-none' : 'border-slate-600 hover:border-blue-500 hover:text-blue-400'}`}>
          {uploading ? 'Uploading…' : '+ Upload PDF'}
          <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
        </label>

        {filename && (
          <div className="flex items-start justify-between gap-1 bg-slate-800 rounded-lg p-2">
            <p className="text-xs text-slate-300 break-all leading-snug">{filename}</p>
            <button onClick={handleDelete} className="text-slate-500 hover:text-red-400 shrink-0 mt-0.5">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex flex-col flex-1 min-w-0">
        {/* Tab bar */}
        <div className="flex border-b border-slate-800 shrink-0">
          {['chat', 'flags'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-xs font-semibold uppercase tracking-widest transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab === 'chat' ? 'Chat' : 'Red Flags'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat'
            ? <ChatInterface docId={docId} />
            : <RedFlagReport docId={docId} />
          }
        </div>
      </main>
    </div>
  );
}

export default App;
