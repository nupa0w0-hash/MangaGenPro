import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Character, Storyboard, Panel, PageTemplate, Dialogue, StyleMode, Bookmark } from './types';
// 주의: geminiService.ts 파일에서 API 키를 localStorage에서 가져오도록 수정해야 할 수도 있습니다.
import { generateStoryboard, generatePanelImage, generateCoverImage, regeneratePanelScript } from './services/geminiService';
import CharacterManager from './components/CharacterManager';
import ComicPanel from './components/ComicPanel';
// import ApiKeySelector from './components/ApiKeySelector'; // <- 이 줄 삭제함 (직접 구현)

import { 
  BookOpen, Sparkles, Layout, Image as ImageIcon, Loader2, ChevronRight, 
  PenTool, Download, Monitor, Edit3, Trash2, Plus, 
  Save, FolderOpen, RefreshCcw, Palette, XCircle, FilePlus, ArchiveRestore,
  Menu, X, MessageSquare, Quote, Eye, Sun, Moon, Key
} from 'lucide-react';

// Extension of Panel type for layout processing
type LayoutPanel = Panel & { 
  gridColSpan: string; 
  gridRowSpan: string;
  displaySize: 'square' | 'wide' | 'tall';
};

const App: React.FC = () => {
  const [isApiReady, setIsApiReady] = useState(false);
  const [inputApiKey, setInputApiKey] = useState(''); // 입력받을 키 상태
  
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Data State
  const [characters, setCharacters] = useState<Character[]>([]);
  const [storyLog, setStoryLog] = useState('');
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [coverRatio, setCoverRatio] = useState<'landscape' | 'portrait'>('landscape');
  const [styleMode, setStyleMode] = useState<StyleMode>('bw');
  const [pageTemplate, setPageTemplate] = useState<PageTemplate>('dynamic');
  
  // Bookmark State
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  
  // UI State
  const [isScripting, setIsScripting] = useState(false);
  const [isRerollingPanel, setIsRerollingPanel] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'preview' | 'result'>('input');
  const [showSidebar, setShowSidebar] = useState(true);
  
  // Generation State
  const [currentPanelIndex, setCurrentPanelIndex] = useState<number>(-1); 
  const [generatingCover, setGeneratingCover] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // Initialize Theme & Check API Key
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : (systemDark ? 'dark' : 'light');
    
    setTheme(initialTheme);
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // 저장된 키 확인
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        setIsApiReady(true);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // API Key 저장 함수
  const handleSaveApiKey = () => {
      if (!inputApiKey.trim()) {
          alert("API 키를 입력해주세요.");
          return;
      }
      localStorage.setItem('gemini_api_key', inputApiKey);
      setIsApiReady(true);
      // 페이지 새로고침을 통해 서비스를 재시작 (확실한 적용을 위해)
      window.location.reload(); 
  };

  // Load bookmarks and Autosave on init
  useEffect(() => {
    const saved = localStorage.getItem('storyBookmarks');
    if (saved) {
        try { setBookmarks(JSON.parse(saved)); } catch(e) { console.error(e); }
    }
    const autosave = localStorage.getItem('mangaGen_autosave');
    if (autosave) {
        try {
            const data = JSON.parse(autosave);
            if (data.storyLog) setStoryLog(data.storyLog);
            if (data.characters) setCharacters(data.characters);
            if (data.storyboard) setStoryboard(data.storyboard);
            if (data.styleMode) setStyleMode(data.styleMode);
            if (data.coverRatio) setCoverRatio(data.coverRatio);
            if (data.pageTemplate) setPageTemplate(data.pageTemplate);
        } catch(e) { console.error("Autosave load failed", e); }
    }
  }, []);

  // Auto-save effect
  useEffect(() => {
      const saveData = {
          storyLog,
          characters,
          storyboard,
          styleMode,
          coverRatio,
          pageTemplate,
          timestamp: Date.now()
      };
      const timer = setTimeout(() => {
          localStorage.setItem('mangaGen_autosave', JSON.stringify(saveData));
      }, 2000); 

      return () => clearTimeout(timer);
  }, [storyLog, characters, storyboard, styleMode, coverRatio, pageTemplate]);

  const saveBookmark = () => {
    if (!storyLog.trim()) return;
    const title = storyLog.slice(0, 20) + (storyLog.length > 20 ? '...' : '');
    const newBookmark: Bookmark = {
        id: Date.now(),
        title,
        storyLog,
        characters, 
        storyboard, 
        date: new Date().toLocaleDateString(),
        styleMode,
        coverRatio,
        pageTemplate
    };
    const updated = [newBookmark, ...bookmarks];
    setBookmarks(updated);
    localStorage.setItem('storyBookmarks', JSON.stringify(updated));
    alert('스토리가 저장되었습니다.');
  };

  const loadBookmark = (bm: Bookmark) => {
    if (confirm('현재 작업 중인 내용이 덮어씌워집니다. 불러오시겠습니까?')) {
        setStoryLog(bm.storyLog);
        setCharacters(bm.characters || []);
        setStoryboard(bm.storyboard);
        if (bm.styleMode) setStyleMode(bm.styleMode);
        setCoverRatio(bm.coverRatio || 'landscape');
        setPageTemplate(bm.pageTemplate || 'dynamic');
        
        if (bm.storyboard) setActiveTab('preview');
        else setActiveTab('input');
    }
  };

  const deleteBookmark = (id: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm('정말 삭제하시겠습니까?')) return;
      const updated = bookmarks.filter(b => b.id !== id);
      setBookmarks(updated);
      localStorage.setItem('storyBookmarks', JSON.stringify(updated));
  };

  const loadAutosave = () => {
      const autosave = localStorage.getItem('mangaGen_autosave');
      if (autosave && confirm('가장 최근 자동 저장 데이터를 불러오시겠습니까?')) {
        try {
            const data = JSON.parse(autosave);
            if (data.storyLog) setStoryLog(data.storyLog);
            if (data.characters) setCharacters(data.characters);
            if (data.storyboard) setStoryboard(data.storyboard);
            if (data.styleMode) setStyleMode(data.styleMode);
            if (data.coverRatio) setCoverRatio(data.coverRatio);
            if (data.pageTemplate) setPageTemplate(data.pageTemplate);
            
            if (data.storyboard) setActiveTab('preview');
            else setActiveTab('input');
        } catch(e) { console.error(e); }
      } else if (!autosave) {
          alert("저장된 데이터가 없습니다.");
      }
  };

  const handleGenerateStoryboard = async () => {
    if (!storyLog.trim()) return;
    if (characters.length === 0) {
      alert("캐릭터를 최소 1명 이상 등록해주세요.");
      return;
    }

    setIsScripting(true);
    try {
      const result = await generateStoryboard(storyLog, characters, coverRatio, styleMode);
      setStoryboard(result);
      setActiveTab('preview');
    } catch (error) {
      console.error(error);
      alert("스토리보드 생성 실패. API Key가 올바른지 확인하거나 잠시 후 다시 시도하세요.");
    } finally {
      setIsScripting(false);
    }
  };

  // --- Panel Management Functions ---
  const handleAddPanel = () => {
      if (!storyboard) return;
      const newId = storyboard.panels.length > 0 
        ? Math.max(...storyboard.panels.map(p => p.id)) + 1 
        : 1;

      const newPanel: Panel = {
          id: newId,
          description: "새로운 장면",
          visualPromptEn: "A detailed description of the new scene.",
          dialogues: [],
          charactersInPanel: [],
          panelSize: 'square',
          status: 'pending'
      };
      
      setStoryboard({
          ...storyboard,
          panels: [...storyboard.panels, newPanel]
      });
  };

  const handleDeletePanel = (index: number) => {
      if (!storyboard) return;
      if (!confirm("이 컷을 삭제하시겠습니까?")) return;
      const newPanels = storyboard.panels.filter((_, i) => i !== index);
      setStoryboard({ ...storyboard, panels: newPanels });
  };

  const handleToggleCover = () => {
      if (!storyboard) return;
      if (storyboard.coverImageUrl || storyboard.coverImagePrompt) {
           if (!confirm("표지를 삭제하시겠습니까?")) return;
           setStoryboard({ ...storyboard, coverImagePrompt: '', coverImageUrl: undefined });
      } else {
           setStoryboard({ ...storyboard, coverImagePrompt: 'Detailed cover art description based on the story theme...', coverImageUrl: undefined });
      }
  };

  const handleRerollPanelScript = async (panelIndex: number) => {
      if (!storyboard) return;
      const panel = storyboard.panels[panelIndex];
      
      setIsRerollingPanel(panel.id);
      try {
          const newPanel = await regeneratePanelScript(panel, storyLog, characters, storyboard.styleMode);
          const newPanels = [...storyboard.panels];
          newPanels[panelIndex] = newPanel;
          setStoryboard({ ...storyboard, panels: newPanels });
      } catch (e) {
          alert("패널 재생성에 실패했습니다.");
      } finally {
          setIsRerollingPanel(null);
      }
  };

  const handleUpdatePanel = (index: number, field: keyof Panel, value: any) => {
    if (!storyboard) return;
    const newPanels = [...storyboard.panels];
    newPanels[index] = { ...newPanels[index], [field]: value };
    setStoryboard({ ...storyboard, panels: newPanels });
  };
  
  const addDialogue = (panelIndex: number) => {
      if (!storyboard) return;
      const panel = storyboard.panels[panelIndex];
      const newDialogue: Dialogue = { speaker: 'Unknown', text: '', type: 'speech' };
      handleUpdatePanel(panelIndex, 'dialogues', [...(panel.dialogues || []), newDialogue]);
  };

  const updateDialogue = (panelIndex: number, dialogueIndex: number, field: keyof Dialogue, value: string) => {
      if (!storyboard) return;
      const panel = storyboard.panels[panelIndex];
      const newDialogues = [...panel.dialogues];
      newDialogues[dialogueIndex] = { ...newDialogues[dialogueIndex], [field]: value };
      handleUpdatePanel(panelIndex, 'dialogues', newDialogues);
  };

  const removeDialogue = (panelIndex: number, dialogueIndex: number) => {
      if (!storyboard) return;
      const panel = storyboard.panels[panelIndex];
      const newDialogues = panel.dialogues.filter((_, i) => i !== dialogueIndex);
      handleUpdatePanel(panelIndex, 'dialogues', newDialogues);
  };

  const handleUpdateStoryboard = (field: keyof Storyboard, value: any) => {
    if (!storyboard) return;
    setStoryboard({ ...storyboard, [field]: value });
  };

  const generateSinglePanel = useCallback(async (panel: Panel, allChars: Character[], currentStyle: StyleMode) => {
     setStoryboard(prev => {
        if (!prev) return null;
        return {
            ...prev,
            panels: prev.panels.map(p => p.id === panel.id ? { ...p, status: 'generating' } : p)
        };
     });

     try {
        const imageUrl = await generatePanelImage(panel, allChars, currentStyle);
        setStoryboard(prev => {
            if (!prev) return null;
            return {
                ...prev,
                panels: prev.panels.map(p => p.id === panel.id ? { ...p, status: 'completed', imageUrl } : p)
            };
        });
        return true;
     } catch (error) {
        setStoryboard(prev => {
            if (!prev) return null;
            return {
                ...prev,
                panels: prev.panels.map(p => p.id === panel.id ? { ...p, status: 'failed' } : p)
            };
        });
        return false;
     }
  }, []);

  const handleStartDrawing = async () => {
    if (!storyboard) return;
    setActiveTab('result');
    
    const currentStyle = storyboard.styleMode;
    if (storyboard.coverImagePrompt && !storyboard.coverImageUrl) {
      setGeneratingCover(true);
      try {
        const coverUrl = await generateCoverImage(storyboard.coverImagePrompt, characters, storyboard.coverAspectRatio, currentStyle);
        setStoryboard(prev => prev ? { ...prev, coverImageUrl: coverUrl } : null);
      } catch (e) { console.error("Cover failed", e); } 
      finally { setGeneratingCover(false); }
    }

    setCurrentPanelIndex(0);
    const panels = storyboard.panels;
    for (let i = 0; i < panels.length; i++) {
       setCurrentPanelIndex(i);
       if (panels[i].status !== 'completed') {
          await generateSinglePanel(panels[i], characters, currentStyle);
       }
    }
    setCurrentPanelIndex(-1);
  };

  const handleRegeneratePanel = async (panel: Panel) => {
    if (!storyboard) return;
    await generateSinglePanel(panel, characters, storyboard.styleMode);
  };

  const handleDownload = async () => {
    if (!resultRef.current) return;
    // @ts-ignore
    if (!window.html2canvas) {
        alert("html2canvas 라이브러리가 로드되지 않았습니다.");
        return;
    }
    try {
      // @ts-ignore
      const canvas = await window.html2canvas(resultRef.current, {
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      const link = document.createElement('a');
      link.download = `${storyboard?.title || 'manga_page'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error("Download failed", err);
      alert("이미지 다운로드에 실패했습니다.");
    }
  };

  const calculateStrictLayout = (): LayoutPanel[] => {
    if (!storyboard) return [];
    const inputPanels = storyboard.panels;
    if (pageTemplate === 'webtoon') {
        return inputPanels.map(p => ({ ...p, gridColSpan: 'col-span-2', gridRowSpan: 'row-span-1', displaySize: 'wide' }));
    }
    if (pageTemplate === 'four_koma') {
         return inputPanels.map(p => ({ ...p, gridColSpan: 'col-span-2', gridRowSpan: 'row-span-1', displaySize: 'wide' }));
    }
    const layoutPanels: LayoutPanel[] = [];
    const blockedCells: Set<string> = new Set();
    const isBlocked = (r: number, c: number) => blockedCells.has(`${r},${c}`);
    const markBlocked = (r: number, c: number) => blockedCells.add(`${r},${c}`);

    let currentRow = 0;
    let currentCol = 0;

    for (let i = 0; i < inputPanels.length; i++) {
      const panel = inputPanels[i];
      while (isBlocked(currentRow, currentCol)) {
        currentCol++;
        if (currentCol > 1) { currentCol = 0; currentRow++; }
      }
      let effectiveSize = panel.panelSize;
      if (effectiveSize === 'wide') {
        if (currentCol !== 0) { effectiveSize = 'square'; } 
        else if (isBlocked(currentRow, 1)) { effectiveSize = 'square'; }
      }
      const lp: LayoutPanel = { 
        ...panel, gridColSpan: 'col-span-1', gridRowSpan: 'row-span-1',
        displaySize: effectiveSize === 'wide' ? 'wide' : effectiveSize === 'tall' ? 'tall' : 'square'
      };
      if (effectiveSize === 'wide') {
        lp.gridColSpan = 'col-span-2';
        markBlocked(currentRow, 0); markBlocked(currentRow, 1);
        currentCol = 0; currentRow++; 
      } else if (effectiveSize === 'tall') {
        lp.gridRowSpan = 'row-span-2';
        markBlocked(currentRow, currentCol); markBlocked(currentRow + 1, currentCol);
        currentCol++;
        if (currentCol > 1) { currentCol = 0; currentRow++; }
      } else { 
        lp.gridColSpan = 'col-span-1'; lp.gridRowSpan = 'row-span-1';
        markBlocked(currentRow, currentCol);
        currentCol++;
        if (currentCol > 1) { currentCol = 0; currentRow++; }
      }
      layoutPanels.push(lp);
    }
    return layoutPanels;
  };
  const layoutPanels = calculateStrictLayout();

  // --------------------------------------------------------------------------------
  // 🔑 API Key가 없을 때 보여주는 화면 (직접 구현됨)
  // --------------------------------------------------------------------------------
  if (!isApiReady) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full animate-fade-in">
                <div className="flex justify-center mb-6">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-xl shadow-lg shadow-indigo-500/20">
                        <BookOpen className="w-8 h-8 text-white" />
                    </div>
                </div>
                
                <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">MangaGen Pro</h1>
                <p className="text-center text-slate-500 dark:text-slate-400 mb-8 text-sm">
                    AI 만화 창작 도구에 오신 것을 환영합니다.<br/>
                    Google Gemini API 키를 입력하여 시작하세요.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Google API Key</label>
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="password" 
                                value={inputApiKey}
                                onChange={(e) => setInputApiKey(e.target.value)}
                                placeholder="sk-..."
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 px-1">
                            * 키는 브라우저(Local Storage)에만 저장되며 서버로 전송되지 않습니다.
                        </p>
                    </div>

                    <button 
                        onClick={handleSaveApiKey}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                    >
                        시작하기 <ChevronRight className="w-4 h-4" />
                    </button>
                    
                    <div className="text-center pt-4">
                         <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline">
                            API 키가 없으신가요? 여기서 발급받으세요.
                         </a>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  // --------------------------------------------------------------------------------
  // 메인 앱 화면
  // --------------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden selection:bg-indigo-500/30 transition-colors duration-300">
      {/* Header */}
      <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-30 transition-colors duration-300">
        <div className="flex items-center gap-4">
          <button onClick={() => setShowSidebar(!showSidebar)} className="md:hidden text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-colors">
             <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-500 p-1.5 rounded-lg shadow-lg shadow-indigo-500/20">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white hidden sm:block">
              MangaGen <span className="text-indigo-600 dark:text-indigo-400 font-light">Pro</span>
            </h1>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800/50 rounded-xl p-1 border border-slate-200 dark:border-slate-700/50">
          {[
            { id: 'input', label: '1. 스토리', icon: PenTool },
            { id: 'preview', label: '2. 콘티/수정', icon: Layout },
            { id: 'result', label: '3. 완성', icon: ImageIcon }
          ].map((tab) => (
             <button 
                key={tab.id}
                onClick={() => {
                   if (tab.id === 'preview' && !storyboard) return;
                   if (tab.id === 'result' && !storyboard) return;
                   setActiveTab(tab.id as any);
                }}
                disabled={(tab.id === 'preview' || tab.id === 'result') && !storyboard}
                className={`relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                   activeTab === tab.id 
                   ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm dark:shadow-md' 
                   : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-30'
                }`}
             >
                <tab.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
             </button>
          ))}
        </div>

        {/* Theme Toggle & Reset Key */}
        <div className="flex gap-2">
            <button 
                onClick={() => {
                    if(confirm("API 키를 삭제하고 초기 화면으로 돌아가시겠습니까?")) {
                        localStorage.removeItem('gemini_api_key');
                        window.location.reload();
                    }
                }}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors border border-slate-200 dark:border-slate-700"
                title="Reset API Key"
            >
                <Key className="w-4 h-4" />
            </button>
            <button 
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-white transition-colors border border-slate-200 dark:border-slate-700"
                title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside 
            className={`absolute md:relative z-20 h-full w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} md:translate-x-0 flex flex-col`}
        >
             <CharacterManager characters={characters} setCharacters={setCharacters} styleMode={styleMode} />
             
             {/* Bookmarks */}
             <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors duration-300">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <FolderOpen className="w-3 h-3"/> Saved Stories
                    </span>
                    <button onClick={loadAutosave} className="text-[10px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors">
                        <ArchiveRestore className="w-3 h-3" /> Auto-Load
                    </button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                    {bookmarks.map(bm => (
                        <div key={bm.id} className="group flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-all" onClick={() => loadBookmark(bm)}>
                            <div className="min-w-0">
                                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate">{bm.title}</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">{bm.date}</p>
                            </div>
                            <button onClick={(e) => deleteBookmark(bm.id, e)} className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    {bookmarks.length === 0 && <p className="text-xs text-slate-400 dark:text-slate-600 text-center py-2">저장된 스토리가 없습니다.</p>}
                </div>
             </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 relative custom-scrollbar transition-colors duration-300">
          
          {/* TAB: INPUT */}
          {activeTab === 'input' && (
            <div className="max-w-4xl mx-auto p-6 md:p-12 animate-fade-in pb-32">
               <div className="text-center mb-10">
                   <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">당신의 이야기를 만화로 만드세요</h2>
                   <p className="text-slate-500 dark:text-slate-400">AI가 줄거리를 분석하여 완벽한 만화 콘티와 이미지를 생성해줍니다.</p>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   {/* Main Input Area */}
                   <div className="lg:col-span-2 space-y-4">
                       <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all">
                           <div className="flex justify-between items-center px-4 py-2 border-b border-slate-100 dark:border-slate-800/50">
                               <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Story Log</span>
                               <button onClick={saveBookmark} className="text-xs flex items-center gap-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                   <Save className="w-3 h-3" /> Save Draft
                               </button>
                           </div>
                           <textarea
                               value={storyLog}
                               onChange={(e) => setStoryLog(e.target.value)}
                               placeholder="예시: 2050년 네오 서울, 비 오는 밤거리. 사립탐정 강철은 의문의 칩을 건네받는다. 그때 뒤에서 검은 양복을 입은 남자들이 나타난다..."
                               className="w-full h-80 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-4 rounded-b-xl focus:outline-none resize-none leading-relaxed text-sm md:text-base selection:bg-indigo-500/30 placeholder-slate-400 dark:placeholder-slate-600"
                           />
                       </div>
                   </div>

                   {/* Settings Panel */}
                   <div className="space-y-4">
                       <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5 shadow-sm">
                           <div>
                               <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block flex items-center gap-2">
                                   <Palette className="w-3 h-3"/> Art Style
                               </label>
                               <div className="grid grid-cols-1 gap-2">
                                   <button onClick={() => setStyleMode('bw')} className={`relative overflow-hidden p-3 rounded-lg border text-left transition-all ${styleMode === 'bw' ? 'bg-slate-100 dark:bg-white text-slate-900 dark:text-black border-slate-300 dark:border-white' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-750'}`}>
                                       <span className="relative z-10 text-sm font-bold">Manga (B&W)</span>
                                       <div className="relative z-10 text-xs opacity-70">Traditional Japanese Ink</div>
                                       {styleMode === 'bw' && <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/5 dark:to-transparent"></div>}
                                   </button>
                                   <button onClick={() => setStyleMode('color')} className={`relative overflow-hidden p-3 rounded-lg border text-left transition-all ${styleMode === 'color' ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-transparent' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-750'}`}>
                                       <span className="relative z-10 text-sm font-bold">Webtoon (Color)</span>
                                       <div className="relative z-10 text-xs opacity-80">Full Color Digital Art</div>
                                   </button>
                               </div>
                           </div>

                           <div>
                               <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block flex items-center gap-2">
                                   <Monitor className="w-3 h-3"/> Cover Ratio
                               </label>
                               <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                   <button onClick={() => setCoverRatio('landscape')} className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${coverRatio === 'landscape' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>16:9 Wide</button>
                                   <button onClick={() => setCoverRatio('portrait')} className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${coverRatio === 'portrait' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>3:4 Tall</button>
                               </div>
                           </div>
                       </div>

                       <button
                         onClick={handleGenerateStoryboard}
                         disabled={isScripting || !storyLog}
                         className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-lg shadow-xl shadow-indigo-500/20 dark:shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 flex items-center justify-center gap-2"
                       >
                         {isScripting ? (
                           <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing...</>
                         ) : (
                           <><Sparkles className="w-5 h-5" /> Generate Script</>
                         )}
                       </button>
                   </div>
               </div>
            </div>
          )}

          {/* TAB: PREVIEW */}
          {activeTab === 'preview' && storyboard && (
             <div className="max-w-6xl mx-auto p-6 md:p-8 pb-32 animate-slide-up">
                
                {/* Editor Header */}
                <div className="sticky top-0 z-30 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md pb-6 mb-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/30">
                                <Edit3 className="w-4 h-4" />
                            </span>
                            콘티 에디터
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 ml-11">AI가 생성한 컷 구성과 프롬프트를 확인하고 수정하세요.</p>
                    </div>
                    <button
                        onClick={handleStartDrawing}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-600/20 dark:shadow-emerald-900/20 transition-all hover:translate-y-[-2px]"
                    >
                        <span>작화 시작</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Global Info Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-8 shadow-sm">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Title</label>
                            <input 
                                type="text" 
                                value={storyboard.title}
                                onChange={(e) => handleUpdateStoryboard('title', e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                            />
                       </div>
                       <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-xs font-bold text-slate-500 uppercase block">Cover Art Prompt</label>
                                <button onClick={handleToggleCover} className={`text-xs flex items-center gap-1 ${storyboard.coverImagePrompt ? 'text-red-500 hover:text-red-400' : 'text-indigo-500 hover:text-indigo-400'}`}>
                                    {storyboard.coverImagePrompt ? <><XCircle className="w-3 h-3"/> Remove</> : <><Plus className="w-3 h-3"/> Add Cover</>}
                                </button>
                            </div>
                            {storyboard.coverImagePrompt ? (
                                <textarea 
                                    value={storyboard.coverImagePrompt}
                                    onChange={(e) => handleUpdateStoryboard('coverImagePrompt', e.target.value)}
                                    className="w-full h-20 bg-slate-50 dark:bg-slate-950 border border-indigo-200 dark:border-indigo-500/30 rounded-lg px-4 py-2 text-sm text-indigo-900 dark:text-indigo-100 focus:border-indigo-500 outline-none resize-none"
                                />
                            ) : (
                                <div className="h-20 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center text-slate-500 text-sm">
                                    No cover selected
                                </div>
                            )}
                       </div>
                   </div>
                </div>

                {/* Panel Editor List */}
                <div className="space-y-6">
                    {storyboard.panels.map((panel, idx) => (
                        <ComicPanel 
                            key={panel.id} 
                            panel={panel} 
                            index={idx} 
                            characters={characters}
                            onUpdate={(field, val) => handleUpdatePanel(idx, field, val)}
                            onDelete={() => handleDeletePanel(idx)}
                            onReroll={() => handleRerollPanelScript(idx)}
                            isRerolling={isRerollingPanel === panel.id}
                            onAddDialogue={() => addDialogue(idx)}
                            onUpdateDialogue={(dIdx, field, val) => updateDialogue(idx, dIdx, field, val)}
                            onRemoveDialogue={(dIdx) => removeDialogue(idx, dIdx)}
                        />
                    ))}
                    <button 
                        onClick={handleAddPanel}
                        className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 hover:text-indigo-500 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all flex items-center justify-center gap-2 font-bold"
                    >
                        <Plus className="w-5 h-5" /> Add New Scene
                    </button>
                </div>
             </div>
          )}

          {/* TAB: RESULT */}
          {activeTab === 'result' && storyboard && (
             <div className="max-w-4xl mx-auto p-4 md:p-8 animate-fade-in pb-32">
                 <div className="flex justify-between items-center mb-6">
                     <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <ImageIcon className="w-6 h-6 text-indigo-500" />
                        최종 결과물
                     </h2>
                     <div className="flex gap-2">
                         <button onClick={handleStartDrawing} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2">
                            <RefreshCcw className="w-3.5 h-3.5" /> Regenerate All
                         </button>
                         <button onClick={handleDownload} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-500 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20">
                            <Download className="w-3.5 h-3.5" /> Download Image
                         </button>
                     </div>
                 </div>

                 {/* Canvas Area */}
                 <div ref={resultRef} className="bg-white text-black p-8 shadow-2xl rounded-sm min-h-[1000px] flex flex-col items-center">
                     {/* Cover */}
                     {storyboard.coverImageUrl && (
                        <div className={`mb-8 w-full ${storyboard.coverAspectRatio === 'landscape' ? 'aspect-video' : 'aspect-[3/4]'} relative group`}>
                             <img src={storyboard.coverImageUrl} alt="Cover" className="w-full h-full object-cover border-4 border-black" />
                             <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-6 pt-20">
                                 <h1 className="text-4xl font-extrabold text-white text-stroke-sm">{storyboard.title}</h1>
                             </div>
                        </div>
                     )}
                     {generatingCover && (
                        <div className="w-full aspect-video flex items-center justify-center bg-slate-100 mb-8 border-4 border-black">
                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                <Loader2 className="w-8 h-8 animate-spin" />
                                <span className="text-xs font-bold uppercase tracking-widest">Drawing Cover...</span>
                            </div>
                        </div>
                     )}

                     {/* Manga Grid */}
                     <div className={`grid grid-cols-2 gap-4 w-full max-w-2xl bg-white auto-rows-min`}>
                        {layoutPanels.map((panel, idx) => (
                           <div 
                                key={panel.id} 
                                className={`relative border-[3px] border-black overflow-hidden bg-white ${panel.gridColSpan} ${panel.gridRowSpan} ${panel.displaySize === 'tall' ? 'min-h-[400px]' : 'min-h-[200px]'}`}
                           >
                               {panel.status === 'completed' && panel.imageUrl ? (
                                   <img src={panel.imageUrl} alt={panel.description} className="w-full h-full object-cover grayscale-[0] contrast-125" />
                               ) : (
                                   <div className="w-full h-full flex items-center justify-center bg-slate-50 relative">
                                       {panel.status === 'generating' && (
                                           <div className="flex flex-col items-center gap-2 z-10">
                                               <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                                               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Drawing...</span>
                                           </div>
                                       )}
                                       {panel.status === 'failed' && (
                                            <div className="flex flex-col items-center gap-2 z-10 text-red-400 cursor-pointer" onClick={() => handleRegeneratePanel(panel)}>
                                                <RefreshCcw className="w-6 h-6" />
                                                <span className="text-[10px] font-bold">Retry</span>
                                            </div>
                                       )}
                                   </div>
                               )}
                               
                               {/* Speech Bubbles Layer */}
                               <div className="absolute inset-0 p-4 pointer-events-none">
                                    {panel.dialogues.map((d, dIdx) => (
                                        <div key={dIdx} className={`absolute bg-white border-[2px] border-black px-3 py-2 rounded-[50%] text-center text-black text-xs font-comic font-bold shadow-[2px_2px_0px_rgba(0,0,0,0.2)] max-w-[70%] break-words
                                            ${dIdx % 2 === 0 ? 'top-2 right-2 rounded-bl-none' : 'bottom-2 left-2 rounded-tr-none'}
                                        `}>
                                            {d.text}
                                        </div>
                                    ))}
                               </div>
                           </div>
                        ))}
                     </div>
                 </div>
             </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
