import React, { useEffect, useState } from 'react';
import { Key, ExternalLink, Loader2, Sparkles } from 'lucide-react';

interface Props {
  onReady: () => void;
}

const ApiKeySelector: React.FC<Props> = ({ onReady }) => {
  const [status, setStatus] = useState<'checking' | 'no-key' | 'ready'>('checking');
  const [error, setError] = useState<string | null>(null);

  const checkKey = async () => {
    try {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (hasKey) {
          setStatus('ready');
          onReady();
        } else {
          setStatus('no-key');
        }
      } else {
        console.warn("window.aistudio not found");
        setStatus('no-key');
      }
    } catch (e) {
      console.error(e);
      setStatus('no-key');
    }
  };

  useEffect(() => {
    checkKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectKey = async () => {
    setError(null);
    try {
      if (window.aistudio && window.aistudio.openSelectKey) {
        await window.aistudio.openSelectKey();
        setStatus('ready');
        onReady();
      }
    } catch (e: any) {
      console.error("Key selection failed", e);
      if (e.message && e.message.includes("Requested entity was not found")) {
        setError("프로젝트를 찾을 수 없거나 유효하지 않습니다. 유료 GCP 프로젝트를 선택해 주세요.");
        setStatus('no-key');
      }
    }
  };

  if (status === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-sm tracking-wider">INITIALIZING...</span>
      </div>
    );
  }

  if (status === 'ready') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/50 dark:bg-slate-950/80 backdrop-blur-md p-6">
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-8 max-w-md w-full shadow-2xl overflow-hidden transition-colors duration-300">
        
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-purple-500/10 dark:bg-purple-500/20 rounded-full blur-3xl"></div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/20">
             <Sparkles className="w-8 h-8 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">MangaGen Pro</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed text-sm">
            전문적인 만화 창작을 위해 <br/>
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Gemini 3 Pro</span> 모델의 접근 권한이 필요합니다.
          </p>
          
          {error && (
             <div className="w-full bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 p-3 rounded-lg mb-6 text-xs text-left">
               ⚠️ {error}
             </div>
          )}

          <button
            onClick={handleSelectKey}
            className="group w-full py-3.5 px-6 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-50 text-white dark:text-slate-900 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <Key className="w-4 h-4 text-indigo-300 dark:text-indigo-600 group-hover:scale-110 transition-transform" />
            <span>API 키 선택하기</span>
          </button>
          
          <div className="mt-6">
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">
              <span>결제 및 요금제 안내</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeySelector;