import { useState } from 'react';
import { analyzeContract } from '../api/client';

const ChatInterface = ({ docId, onCiteClick }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || !docId) return;

    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: input }]);

    try {
      const data = await analyzeContract(input, docId);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
      }]);
    } catch (error) {
      console.error('Analysis failed:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
      }]);
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) handleSend();
  };

  return (
    <div className="flex flex-col h-full p-4 bg-slate-900">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <p className="text-slate-500 text-sm text-center mt-8">
            Ask anything about the contract...
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-3 rounded-lg max-w-[85%] ${
              m.role === 'user'
                ? 'bg-blue-600 text-white ml-auto'
                : 'bg-slate-700 text-slate-100'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap">{m.content}</p>
            {m.sources && m.sources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {m.sources.map((source, si) => (
                  <button
                    key={si}
                    onClick={() => onCiteClick?.(source)}
                    className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-400"
                  >
                    {source.section} (Pg {source.page})
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="bg-slate-700 text-slate-400 p-3 rounded-lg max-w-[85%] text-sm">
            Analyzing...
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          placeholder="Ask about the contract..."
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
        >
          {loading ? 'Thinking...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;
