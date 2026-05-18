import { useEffect, useState } from 'react';
import { getRedFlags, scanRedFlags } from '../api/client';
import { AlertTriangle, AlertCircle, Info, ScanSearch } from 'lucide-react';

const SEVERITY_STYLES = {
  critical: { color: 'text-red-400',    bg: 'bg-red-950/40 border-red-800',    Icon: AlertTriangle },
  high:     { color: 'text-orange-400', bg: 'bg-orange-950/40 border-orange-800', Icon: AlertCircle },
  medium:   { color: 'text-yellow-400', bg: 'bg-yellow-950/40 border-yellow-800', Icon: Info },
};

const getStyle = (severity) => SEVERITY_STYLES[severity?.toLowerCase()] ?? SEVERITY_STYLES.medium;

const RedFlagReport = ({ docId }) => {
  const [flags, setFlags]       = useState([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (docId) getRedFlags(docId).then(setFlags).catch(console.error);
  }, [docId]);

  const handleScan = async () => {
    setScanning(true);
    try { setFlags(await scanRedFlags(docId)); }
    catch (e) { console.error(e); }
    finally { setScanning(false); }
  };

  return (
    <div className="flex flex-col h-full p-4 bg-slate-900 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Risk Assessment</h3>
        <button
          onClick={handleScan}
          disabled={!docId || scanning}
          className="flex items-center gap-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
        >
          <ScanSearch size={13} />
          {scanning ? 'Scanning…' : 'Run Scan'}
        </button>
      </div>

      {flags.length === 0 ? (
        <p className="text-slate-500 text-sm text-center mt-10">
          {docId ? 'No flags found. Run a scan to detect risks.' : 'Upload a document to begin.'}
        </p>
      ) : (
        <div className="space-y-2">
          {flags.map((flag) => {
            const { color, bg, Icon } = getStyle(flag.severity);
            return (
              <div key={flag.id} className={`p-3 rounded-lg border flex gap-3 ${bg}`}>
                <Icon size={15} className={`mt-0.5 shrink-0 ${color}`} />
                <div className="min-w-0">
                  <p className={`font-bold uppercase text-xs tracking-wide ${color}`}>{flag.flagType}</p>
                  <p className="text-sm text-slate-200 mt-0.5 leading-snug">{flag.explanation}</p>
                  <p className="text-xs text-slate-400 mt-1 italic">↳ {flag.recommendation}</p>
                  {flag.sectionTitle && (
                    <p className="text-xs text-slate-500 mt-1">
                      {flag.sectionTitle}{flag.pageStart != null ? ` · Pg ${flag.pageStart}` : ''}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RedFlagReport;
