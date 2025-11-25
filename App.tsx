import React, { useState, useCallback, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Character, Storyboard, Panel, PageTemplate, Dialogue, StyleMode, Bookmark, RenderMode, LayoutState } from './types';
import { generateStoryboard, generatePanelImage, generateCoverImage, regeneratePanelScript, regenerateCoverPrompt } from './services/geminiService';
import CharacterManager from './components/CharacterManager';
import ComicPanel from './components/ComicPanel';
import CharacterEmotionStudio from './components/emotion-studio/CharacterEmotionStudio';
import MangaTool from './components/MangaTool';
import { Rnd } from 'react-rnd';

import { 
  BookOpen, Sparkles, Layout, Image as ImageIcon, Loader2, ChevronRight, 
  PenTool, Download, Monitor, Edit3, Trash2, Plus, 
  Save, FolderOpen, RefreshCcw, RefreshCw, Palette, XCircle, FilePlus, ArchiveRestore,
  Menu, X, MessageSquare, Quote, Eye, Sun, Moon, Key, Move, Settings2,
  SmilePlus, Square, BoxSelect, Circle, Type, MessageCircle, Wrench, Zap, Sun as SunIcon
} from 'lucide-react';

// Extension of Panel type for layout processing
type LayoutPanel = Panel & { 
  gridColSpan: string; 
  gridRowSpan: string;
  displaySize: 'square' | 'wide' | 'tall';
};

export interface MangaToolItem {
  id: number;
  type: 'box' | 'circle' | 'text' | 'bubble' | 'image' | 'speed-lines' | 'focus-lines';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  imageUrl?: string;
  rotation?: number;
  textStyle?: { fontWeight?: string, fontSize?: string, color?: string, fontFamily?: string };
}

const App: React.FC = () => {
  const [isApiReady, setIsApiReady] = useState(false);
  const [inputApiKey, setInputApiKey] = useState(''); // Input state for API Key
  
  // App Mode State
  const [appMode, setAppMode] = useState<'story' | 'character-studio'>('story');

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Data State
  const [characters, setCharacters] = useState<Character[]>([]);
  const [storyLog, setStoryLog] = useState('');
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [coverRatio, setCoverRatio] = useState<'landscape' | 'portrait'>('landscape');
  const [styleMode, setStyleMode] = useState<StyleMode>('bw');
  const [renderMode, setRenderMode] = useState<RenderMode>('overlay');
  const [pageTemplate, setPageTemplate] = useState<PageTemplate>('dynamic');
  const [panelCount, setPanelCount] = useState<number | 'unlimited'>(8);

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
  const [isRerollingCoverPrompt, setIsRerollingCoverPrompt] = useState(false);
  const [activeSettingsPanel, setActiveSettingsPanel] = useState<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manga Tools State
  const [addedTools, setAddedTools] = useState<MangaToolItem[]>([]);
  const [showBorders, setShowBorders] = useState(true);
  const [isToolboxOpen, setIsToolboxOpen] = useState(false);
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null);

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

    // Check for saved key
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

  // API Key Save Handler
  const handleSaveApiKey = () => {
      if (!inputApiKey.trim()) {
          alert("API 키를 입력해주세요.");
          return;
      }
      localStorage.setItem('gemini_api_key', inputApiKey);
      setIsApiReady(true);
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
            if (data.renderMode) setRenderMode(data.renderMode);
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
  }, [storyLog, characters, storyboard, styleMode, renderMode, coverRatio, pageTemplate]);

  // ------------------------------------------------------------------
  // Layout Management & Initialization
  // ------------------------------------------------------------------
  const [containerHeight, setContainerHeight] = useState<number>(1200);
  const [scale, setScale] = useState(1);

  // Responsive Scale Handler
  useEffect(() => {
      const handleResize = () => {
          if (activeTab === 'result') {
              const availableWidth = window.innerWidth - 32; // 32px padding
              const newScale = Math.min(1, availableWidth / 800);
              setScale(newScale);
          }
      };

      window.addEventListener('resize', handleResize);
      handleResize(); // Init

      return () => window.removeEventListener('resize', handleResize);
  }, [activeTab]);

  useEffect(() => {
      if (activeTab !== 'result' || !storyboard || pageTemplate !== 'dynamic') return;

      // Check if layout needs initialization (or re-sync)
      const needsInit = storyboard.panels.some(p => !p.layout) || (storyboard.coverImagePrompt && !storyboard.coverLayout);

      if (needsInit) {
          initializeLayouts();
      }

      recalcContainerHeight();
  }, [activeTab, storyboard, pageTemplate]);

  const calculateMaxHeight = (panels: Panel[], coverLayout?: LayoutState) => {
      let maxY = 0;
      panels.forEach(p => {
          if (p.layout) {
              const bottom = p.layout.y + (typeof p.layout.height === 'number' ? p.layout.height : parseInt(String(p.layout.height)));
              if (bottom > maxY) maxY = bottom;
          }
      });
      if (coverLayout) {
          const bottom = coverLayout.y + (typeof coverLayout.height === 'number' ? coverLayout.height : parseInt(String(coverLayout.height)));
          if (bottom > maxY) maxY = bottom;
      }
      return Math.max(1200, maxY + 200);
  };

  const recalcContainerHeight = () => {
      if (!storyboard) return;
      setContainerHeight(calculateMaxHeight(storyboard.panels, storyboard.coverLayout));
  };

  const initializeLayouts = () => {
      if (!storyboard) return;

      const canvasWidth = 672;

      const gap = 24;
      const colWidth = (canvasWidth - gap * 3) / 2; // 2 columns

      let colHeights = [gap, gap]; // y-offset for col 0 and col 1

      // 1. Initialize Cover if exists
      let newCoverLayout = storyboard.coverLayout;
      if ((storyboard.coverImagePrompt || storyboard.coverImageUrl) && !newCoverLayout) {
          // Default cover at top
          newCoverLayout = {
              x: gap,
              y: gap,
              width: canvasWidth - (gap * 2), // Full width
              height: storyboard.coverAspectRatio === 'landscape'
                ? (canvasWidth - gap*2) * 0.56
                : (canvasWidth - gap*2) * 1.33,
              zIndex: 0
          };

          // Push columns down
          const coverHeight = typeof newCoverLayout.height === 'number' ? newCoverLayout.height : 400;
          colHeights[0] += coverHeight + gap;
          colHeights[1] += coverHeight + gap;
      }

      const newPanels = storyboard.panels.map((panel, idx) => {
          // If already has layout, keep it (unless we want to force reset?)
          // Let's keep existing layout if valid to prevent jumps
          if (panel.layout && panel.layout.width && panel.layout.height) return panel;

          // Determine dimensions based on panelSize preference
          let w = colWidth;
          let h = colWidth; // Square default (1:1)

          if (panel.panelSize === 'wide') {
              w = (colWidth * 2) + gap; // Span 2 cols
              h = colWidth * 0.56; // 16:9 approx
          } else if (panel.panelSize === 'tall') {
              h = colWidth * 1.33; // 3:4 approx
          }

          // Determine position
          // Simple Masonry: pick shorter column
          // Exception: Wide panels always start at col 0
          let colIndex = colHeights[0] <= colHeights[1] ? 0 : 1;

          if (panel.panelSize === 'wide') {
              colIndex = 0;
              // Push down to max of both columns to avoid overlap
              const startY = Math.max(colHeights[0], colHeights[1]);
              colHeights[0] = startY;
              colHeights[1] = startY;
          }

          const x = gap + (colIndex * (colWidth + gap));
          const y = colHeights[colIndex];

          // Update heights
          if (panel.panelSize === 'wide') {
              colHeights[0] += h + gap;
              colHeights[1] += h + gap;
          } else {
              colHeights[colIndex] += h + gap;
          }

          return {
              ...panel,
              layout: {
                  x, y, width: w, height: h, zIndex: idx + 1
              }
          };
      });

      setStoryboard(prev => prev ? { ...prev, panels: newPanels, coverLayout: newCoverLayout } : null);
  };

  const resetLayouts = () => {
      if (!storyboard) return;
      // Clear layouts and re-run initialization
      const clearedPanels = storyboard.panels.map(p => ({ ...p, layout: undefined }));
      setStoryboard({ ...storyboard, panels: clearedPanels, coverLayout: undefined });

      // Let's construct fully here to be safe
      const canvasWidth = 672;

      const gap = 24;
      const colWidth = (canvasWidth - gap * 3) / 2;
      let colHeights = [gap, gap];

      // 1. Cover
      let newCoverLayout;
      if (storyboard.coverImagePrompt || storyboard.coverImageUrl) {
          newCoverLayout = {
              x: gap,
              y: gap,
              width: canvasWidth - (gap * 2),
              height: storyboard.coverAspectRatio === 'landscape'
                ? (canvasWidth - gap*2) * 0.56
                : (canvasWidth - gap*2) * 1.33,
              zIndex: 0
          };
          const ch = typeof newCoverLayout.height === 'number' ? newCoverLayout.height : 400;
          colHeights[0] += ch + gap;
          colHeights[1] += ch + gap;
      }

      const newPanels = clearedPanels.map((panel, idx) => {
          let w = colWidth;
          let h = colWidth;
          if (panel.panelSize === 'wide') {
              w = (colWidth * 2) + gap;
              h = colWidth * 0.56;
          } else if (panel.panelSize === 'tall') {
              h = colWidth * 1.33;
          }

          let colIndex = colHeights[0] <= colHeights[1] ? 0 : 1;
          if (panel.panelSize === 'wide') {
              colIndex = 0;
              const startY = Math.max(colHeights[0], colHeights[1]);
              colHeights[0] = startY;
              colHeights[1] = startY;
          }

          const x = gap + (colIndex * (colWidth + gap));
          const y = colHeights[colIndex];

          if (panel.panelSize === 'wide') {
              colHeights[0] += h + gap;
              colHeights[1] += h + gap;
          } else {
              colHeights[colIndex] += h + gap;
          }

          return {
              ...panel,
              layout: { x, y, width: w, height: h, zIndex: idx + 1 }
          };
      });

      setStoryboard({ ...storyboard, panels: newPanels, coverLayout: newCoverLayout });
      setContainerHeight(calculateMaxHeight(newPanels, newCoverLayout));
  };

  // ... (rest of functions)

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

  const loadAutosave = () => {
    const autosave = localStorage.getItem('mangaGen_autosave');
    if (!autosave) {
        alert("자동 저장된 데이터가 없습니다.");
        return;
    }

    if (confirm("자동 저장된 내용을 불러오시겠습니까? 현재 작업 중인 내용은 사라질 수 있습니다.")) {
        try {
            const data = JSON.parse(autosave);
            if (data.storyLog) setStoryLog(data.storyLog);
            if (data.characters) setCharacters(data.characters || []);
            if (data.storyboard) setStoryboard(data.storyboard);
            if (data.styleMode) setStyleMode(data.styleMode);
            if (data.renderMode) setRenderMode(data.renderMode);
            if (data.coverRatio) setCoverRatio(data.coverRatio);
            if (data.pageTemplate) setPageTemplate(data.pageTemplate);

            // Set active tab based on data presence
            if (data.storyboard) setActiveTab('preview');
            else setActiveTab('input');

            alert("불러오기 완료");
        } catch(e) {
            console.error("Autosave load failed", e);
            alert("데이터를 불러오는 중 오류가 발생했습니다.");
        }
    }
  };

  const loadBookmark = (bm: Bookmark) => {
    if (confirm('현재 작업 중인 내용이 덮어씌워집니다. 불러오시겠습니까?')) {
        setStoryLog(bm.storyLog);
        setCharacters(bm.characters || []);
        setStoryboard(bm.storyboard);
        if (bm.styleMode) setStyleMode(bm.styleMode);
        if (bm.renderMode) setRenderMode(bm.renderMode);
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

  const handleGenerateStoryboard = async () => {
    if (!storyLog.trim()) return;
    if (characters.length === 0) {
      alert("캐릭터를 최소 1명 이상 등록해주세요.");
      return;
    }

    setIsScripting(true);
    try {
      const result = await generateStoryboard(storyLog, characters, coverRatio, styleMode, renderMode, panelCount);

      // Ensure no layout data is present to force fresh initialization (Auto-Reset)
      const cleanResult: Storyboard = {
           ...result,
           panels: result.panels.map(p => ({...p, layout: undefined})),
           coverLayout: undefined
      };

      setStoryboard(cleanResult);
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

  const handleRegenerateCoverPrompt = async () => {
      if (!storyboard) return;
      setIsRerollingCoverPrompt(true);
      try {
          const newPrompt = await regenerateCoverPrompt(storyLog, characters, storyboard.styleMode);
          setStoryboard({ ...storyboard, coverImagePrompt: newPrompt });
      } catch (e) {
          alert("표지 프롬프트 재생성에 실패했습니다.");
      } finally {
          setIsRerollingCoverPrompt(false);
      }
  };

  const handleRegenerateCoverImage = async () => {
      if (!storyboard || !storyboard.coverImagePrompt) return;
      setGeneratingCover(true);
      try {
          const coverUrl = await generateCoverImage(storyboard.coverImagePrompt, characters, storyboard.coverAspectRatio, storyboard.styleMode);
          setStoryboard(prev => prev ? { ...prev, coverImageUrl: coverUrl } : null);
      } catch (e) {
          console.error(e);
          alert("표지 이미지 생성 실패");
      } finally {
          setGeneratingCover(false);
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

  // --- Manga Tool Handlers ---
  const handleAddTool = (type: MangaToolItem['type'], imageUrl?: string) => {
      const newTool: MangaToolItem = {
          id: Date.now(),
          type,
          x: 250, // Roughly center
          y: 200,
          width: type === 'text' ? 150 : 200,
          height: type === 'text' ? 50 : 100,
          content: type === 'text' ? '' : undefined,
          imageUrl,
          rotation: 0
      };
      setAddedTools([...addedTools, newTool]);
      if (window.innerWidth < 768) setIsToolboxOpen(false); // Close on mobile after select
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          if (event.target?.result) {
              handleAddTool('image', event.target.result as string);
          }
      };
      reader.readAsDataURL(file);

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpdateTool = (id: number, data: { x: number, y: number, width: number, height: number, rotation?: number }) => {
      setAddedTools(prev => prev.map(tool => tool.id === id ? { ...tool, ...data } : tool));
  };

  const handleUpdateToolContent = (id: number, content: string) => {
      setAddedTools(prev => prev.map(tool => tool.id === id ? { ...tool, content } : tool));
  };

  const handleDeleteTool = (id: number) => {
      setAddedTools(prev => prev.filter(tool => tool.id !== id));
  };

  const generateSinglePanel = useCallback(async (panel: Panel, allChars: Character[], currentStyle: StyleMode, currentRenderMode: RenderMode) => {
     setStoryboard(prev => {
        if (!prev) return null;
        return {
            ...prev,
            panels: prev.panels.map(p => p.id === panel.id ? { ...p, status: 'generating' } : p)
        };
     });

     try {
        const imageUrl = await generatePanelImage(panel, allChars, currentStyle, currentRenderMode);
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

  const handleDownload = async () => {
    if (!resultRef.current || !storyboard) return;

    try {
        // Create a temporary container for export to ensure 800px fixed layout regardless of screen size
        const exportContainer = document.createElement('div');
        exportContainer.style.width = '800px';
        exportContainer.style.height = 'auto';
        exportContainer.style.position = 'absolute';
        exportContainer.style.top = '-9999px';
        exportContainer.style.left = '-9999px';
        exportContainer.style.zIndex = '-1';
        exportContainer.style.backgroundColor = theme === 'dark' ? '#020617' : '#ffffff'; // Match bg
        document.body.appendChild(exportContainer);

        // Clone the result content
        const clone = resultRef.current.cloneNode(true) as HTMLElement;

        // Remove any transform scales from the clone (though resultRef shouldn't have them,
        // its parent does. We are capturing the inner content purely)
        clone.style.transform = 'none';
        clone.style.minHeight = 'auto';

        // Fix Centering for Export:
        // Container is 800px. Content is 672px.
        // We need 64px padding on each side to center it (800 - 672 = 128, 128/2 = 64).
        // The original UI has p-8 (32px). We override it here.
        clone.style.paddingLeft = '64px';
        clone.style.paddingRight = '64px';

        // Explicitly set height to scrollHeight to ensure full capture
        const fullHeight = resultRef.current.scrollHeight;
        clone.style.height = `${fullHeight}px`;
        exportContainer.style.height = `${fullHeight}px`;

        exportContainer.appendChild(clone);

        // Wait for images to be "ready" in the new DOM context
        // (They should be cached, but a small delay helps html2canvas catch up)
        await new Promise(resolve => setTimeout(resolve, 300));

        const canvas = await html2canvas(clone, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: null,
            width: 800, // Force width
            height: fullHeight, // Force height
            windowWidth: 800, // Force window width context
            windowHeight: fullHeight, // Force window height context
            scrollY: 0, // Reset scroll
        });

        const link = document.createElement('a');
        link.download = `${storyboard.title || 'manga-result'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        // Cleanup
        document.body.removeChild(exportContainer);

    } catch (e) {
        console.error("Export failed", e);
        alert("이미지 저장에 실패했습니다.");
    }
  };

  const handleStartDrawing = async () => {
    if (!storyboard) return;
    setActiveTab('result');
    
    const currentStyle = storyboard.styleMode;
    const currentRenderMode = storyboard.renderMode;
    if (storyboard.coverImagePrompt && !storyboard.coverImageUrl) {
      setGeneratingCover(true);
      try {
        const coverUrl = await generateCoverImage(storyboard.coverImagePrompt, characters, storyboard.coverAspectRatio, currentStyle);
        setStoryboard(prev => prev ? { ...prev, coverImageUrl: coverUrl } : null);
      } catch (e) { console.error("Cover failed", e); } 
      finally { setGeneratingCover(false); }
    }

    // We no longer initialize layout here explicitly, the useEffect handles it
    // However, we need to ensure panels are ready
    setCurrentPanelIndex(0);
    const panels = storyboard.panels;
    for (let i = 0; i < panels.length; i++) {
       setCurrentPanelIndex(i);
       if (panels[i].status !== 'completed') {
          await generateSinglePanel(panels[i], characters, currentStyle, currentRenderMode);
       }
    }
    setCurrentPanelIndex(-1);
  };

  const handleRegeneratePanel = async (panel: Panel) => {
    if (!storyboard) return;
    await generateSinglePanel(panel, characters, storyboard.styleMode, storyboard.renderMode);
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
    // Fallback empty array as Dynamic uses Rnd now
    return [];
  };
  const layoutPanels = calculateStrictLayout();

  // Handlers for Rnd
  const updatePanelLayout = (index: number, newLayout: Partial<LayoutState>) => {
      if (!storyboard) return;
      const newPanels = [...storyboard.panels];
      const current = newPanels[index].layout || { x: 0, y: 0, width: 300, height: 300, zIndex: 1 };

      const updatedPanel = {
          ...newPanels[index],
          layout: { ...current, ...newLayout }
      };
      newPanels[index] = updatedPanel;

      setStoryboard({ ...storyboard, panels: newPanels });
      setContainerHeight(calculateMaxHeight(newPanels, storyboard.coverLayout));
  };

  const updateCoverLayout = (newLayout: Partial<LayoutState>) => {
      if (!storyboard) return;
      const current = storyboard.coverLayout || { x: 0, y: 0, width: 800, height: 600, zIndex: 0 };
      const updatedCoverLayout = { ...current, ...newLayout };

      setStoryboard({ ...storyboard, coverLayout: updatedCoverLayout });
      setContainerHeight(calculateMaxHeight(storyboard.panels, updatedCoverLayout));
  };

  const bringToFront = (index: number) => {
      if (!storyboard) return;
      const newPanels = [...storyboard.panels];
      // Find max zIndex
      const maxZ = Math.max(...newPanels.map(p => p.layout?.zIndex || 0), 0);
      if (newPanels[index].layout) {
          newPanels[index].layout = { ...newPanels[index].layout!, zIndex: maxZ + 1 };
          setStoryboard({ ...storyboard, panels: newPanels });
      }
  };

  // --------------------------------------------------------------------------------
  // 🔑 API Key Input Screen (Inline)
  // --------------------------------------------------------------------------------
  if (!isApiReady) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
            {/* ... (same as before) */}
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
  // Main App
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
        {appMode === 'story' ? (
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
        ) : (
           <div className="flex bg-slate-100 dark:bg-slate-800/50 rounded-xl p-1 border border-slate-200 dark:border-slate-700/50">
              <span className="relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-700 text-purple-600 dark:text-white shadow-sm">
                 <SmilePlus className="w-3.5 h-3.5" />
                 Character Emotion Studio
              </span>
           </div>
        )}

        {/* Mode Switcher & Tools */}
        <div className="flex gap-2 items-center">
            {/* Mode Toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 mr-2">
                <button
                    onClick={() => setAppMode('story')}
                    className={`p-2 rounded-md transition-all ${appMode === 'story' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Manga Story Mode"
                >
                    <BookOpen className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setAppMode('character-studio')}
                    className={`p-2 rounded-md transition-all ${appMode === 'character-studio' ? 'bg-white dark:bg-slate-600 text-purple-600 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Character Emotion Studio"
                >
                    <SmilePlus className="w-4 h-4" />
                </button>
            </div>

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

        {/* --------------------------------------------------------------------------------
           MODE: CHARACTER EMOTION STUDIO
           -------------------------------------------------------------------------------- */}
        {appMode === 'character-studio' ? (
           <div className="w-full h-full overflow-y-auto">
              <CharacterEmotionStudio />
           </div>
        ) : (
          /* --------------------------------------------------------------------------------
             MODE: MANGA STORY
             -------------------------------------------------------------------------------- */
          <>
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

                           <div>
                               <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block flex items-center gap-2">
                                   <MessageSquare className="w-3 h-3"/> Text Rendering
                               </label>
                               <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                   <button onClick={() => setRenderMode('overlay')} className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${renderMode === 'overlay' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
                                     Overlay (HTML)
                                   </button>
                                   <button onClick={() => setRenderMode('native')} className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${renderMode === 'native' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
                                     AI Native (Baked-in)
                                   </button>
                               </div>
                           </div>

                           <div>
                               <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block flex items-center gap-2">
                                   <Layout className="w-3 h-3"/> Panel Count
                               </label>
                               <div className="grid grid-cols-3 gap-2">
                                   {[4, 8, 12, 20, 30, 'unlimited'].map((count) => (
                                       <button
                                           key={count}
                                           onClick={() => setPanelCount(count as number | 'unlimited')}
                                           className={`py-2 text-xs font-medium rounded-md transition-all border ${
                                               panelCount === count
                                               ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                                               : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                           }`}
                                       >
                                           {count === 'unlimited' ? '∞' : `${count} Panels`}
                                       </button>
                                   ))}
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
                {/* ... (Same Preview code as before) ... */}
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
                   <div className="grid grid-cols-1 gap-6">
                       <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-xs font-bold text-slate-500 uppercase block">Cover Art Prompt (Include Title Here)</label>
                                <div className="flex gap-2">
                                    {storyboard.coverImagePrompt && (
                                        <>
                                            <button onClick={handleRegenerateCoverPrompt} disabled={isRerollingCoverPrompt} className="text-xs flex items-center gap-1 text-indigo-500 hover:text-indigo-400 disabled:opacity-50" title="Reroll Prompt">
                                                {isRerollingCoverPrompt ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCcw className="w-3 h-3"/>} Prompt
                                            </button>
                                            <button onClick={handleRegenerateCoverImage} disabled={generatingCover} className="text-xs flex items-center gap-1 text-indigo-500 hover:text-indigo-400 disabled:opacity-50" title="Generate/Reroll Image">
                                                {generatingCover ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>} Image
                                            </button>
                                        </>
                                    )}
                                    <button onClick={handleToggleCover} className={`text-xs flex items-center gap-1 ${storyboard.coverImagePrompt ? 'text-red-500 hover:text-red-400' : 'text-indigo-500 hover:text-indigo-400'}`}>
                                        {storyboard.coverImagePrompt ? <><XCircle className="w-3 h-3"/> Remove</> : <><Plus className="w-3 h-3"/> Add Cover</>}
                                    </button>
                                </div>
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
                <div className="space-y-8">
                  {storyboard.panels.map((panel, index) => (
                    <div key={panel.id} className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-lg hover:border-indigo-500/30 transition-all overflow-hidden">
                      
                      {/* Panel Toolbar */}
                      <div className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex flex-wrap justify-between items-center gap-4">
                          <div className="flex items-center gap-4">
                              <span className="text-lg font-black text-indigo-500 dark:text-indigo-400 font-mono">#{panel.id}</span>
                              <div className="h-4 w-px bg-slate-300 dark:bg-slate-700"></div>
                              <select 
                                value={panel.panelSize} 
                                onChange={(e) => handleUpdatePanel(index, 'panelSize', e.target.value)}
                                className="bg-transparent text-xs text-slate-600 dark:text-slate-300 border-none focus:ring-0 cursor-pointer font-medium uppercase tracking-wide hover:text-slate-900 dark:hover:text-white"
                              >
                                <option value="square">Square Layout</option>
                                <option value="wide">Wide Layout</option>
                                <option value="tall">Tall Layout</option>
                              </select>
                          </div>
                          
                          <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleRerollPanelScript(index)}
                                disabled={isRerollingPanel === panel.id}
                                className="text-xs bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-all disabled:opacity-50"
                              >
                                {isRerollingPanel === panel.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                                AI Reroll
                              </button>
                              <button onClick={() => handleDeletePanel(index)} className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all">
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                      </div>

                      <div className="p-6 grid grid-cols-1 xl:grid-cols-12 gap-8">
                          
                          {/* Left Col: Visuals (7/12) */}
                          <div className="xl:col-span-7 space-y-5">
                             {/* NEW: Explicit fields for stricter control */}
                             <div className="grid grid-cols-2 gap-4">
                                 <div>
                                     <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1">Location</label>
                                     <input
                                         type="text"
                                         value={panel.location || ''}
                                         onChange={(e) => handleUpdatePanel(index, 'location', e.target.value)}
                                         placeholder="e.g. Classroom"
                                         className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                                     />
                                 </div>
                                 <div>
                                     <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1">Time</label>
                                     <input
                                         type="text"
                                         value={panel.time || ''}
                                         onChange={(e) => handleUpdatePanel(index, 'time', e.target.value)}
                                         placeholder="e.g. Afternoon"
                                         className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                                     />
                                 </div>
                             </div>
                             <div>
                                 <label className="flex items-center gap-2 text-xs font-bold text-orange-500 uppercase mb-1">
                                    Costume Override <span className="text-[10px] font-normal text-slate-400">(Optional)</span>
                                 </label>
                                 <input
                                     type="text"
                                     value={panel.costumeOverride || ''}
                                     onChange={(e) => handleUpdatePanel(index, 'costumeOverride', e.target.value)}
                                     placeholder="Leave empty to use Character Reference"
                                     className="w-full bg-orange-50/50 dark:bg-slate-950/50 border border-orange-200 dark:border-orange-500/20 rounded-lg px-3 py-2 text-sm text-orange-900 dark:text-orange-100"
                                 />
                             </div>

                             <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                                    <Eye className="w-3.5 h-3.5" /> Scene Description
                                </label>
                                <textarea
                                  value={panel.description}
                                  onChange={(e) => handleUpdatePanel(index, 'description', e.target.value)}
                                  className="w-full h-20 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-700 dark:text-slate-300 focus:border-indigo-500 focus:ring-0 outline-none resize-none"
                                />
                             </div>
                             
                             <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-indigo-500 uppercase">
                                    <Sparkles className="w-3.5 h-3.5" /> Visual Prompt (Action & Angle)
                                </label>
                                <textarea
                                  value={panel.visualPromptEn}
                                  onChange={(e) => handleUpdatePanel(index, 'visualPromptEn', e.target.value)}
                                  className="w-full h-24 bg-indigo-50/50 dark:bg-slate-950/50 border border-indigo-200 dark:border-indigo-500/20 rounded-xl p-3 text-sm text-indigo-900 dark:text-indigo-100/90 font-mono leading-relaxed focus:border-indigo-500 focus:ring-0 outline-none resize-none"
                                />
                             </div>
                          </div>

                          {/* Right Col: Story Elements (5/12) */}
                          <div className="xl:col-span-5 flex flex-col gap-6 border-l border-slate-200 dark:border-slate-800 xl:pl-8">
                              {/* Characters */}
                              <div>
                                  <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">In this Scene</label>
                                  <div className="flex flex-wrap gap-2">
                                      {characters.map(char => (
                                          <button
                                            key={char.id}
                                            onClick={() => {
                                                const current = panel.charactersInPanel;
                                                const newChars = current.includes(char.name) 
                                                ? current.filter(n => n !== char.name)
                                                : [...current, char.name];
                                                handleUpdatePanel(index, 'charactersInPanel', newChars);
                                            }}
                                            className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-all ${
                                                panel.charactersInPanel.includes(char.name)
                                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20'
                                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
                                            }`}
                                          >
                                            {char.imageBase64 && <img src={char.imageBase64} alt="" className="w-4 h-4 rounded-full object-cover" />}
                                            {char.name}
                                          </button>
                                      ))}
                                      {characters.length === 0 && <span className="text-xs text-slate-400 dark:text-slate-600">No characters registered</span>}
                                  </div>
                              </div>

                              {/* Dialogues */}
                              <div className="flex-1 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                                  <div className="flex justify-between items-center mb-4">
                                      <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                                          <MessageSquare className="w-3.5 h-3.5" /> Dialogues
                                      </label>
                                      <button onClick={() => addDialogue(index)} className="text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1">
                                          <Plus className="w-3 h-3" /> Add
                                      </button>
                                  </div>
                                  <div className="space-y-3">
                                      {panel.dialogues?.map((dialogue, dIndex) => (
                                          <div key={dIndex} className="flex gap-2 items-start group/dialogue">
                                              <div className="flex-1 space-y-1">
                                                  <div className="flex gap-2">
                                                      <select
                                                          value={dialogue.speaker}
                                                          onChange={(e) => updateDialogue(index, dIndex, 'speaker', e.target.value)}
                                                          className="bg-white dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 focus:border-indigo-500 outline-none max-w-[80px]"
                                                      >
                                                          <option value="Unknown">???</option>
                                                          {characters.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                                      </select>
                                                      <select
                                                          value={dialogue.type}
                                                          onChange={(e) => updateDialogue(index, dIndex, 'type', e.target.value as any)}
                                                          className="bg-white dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 focus:border-indigo-500 outline-none"
                                                      >
                                                          <option value="speech">말풍선</option>
                                                          <option value="shout">외침</option>
                                                          <option value="thought">생각</option>
                                                          <option value="narration">해설</option>
                                                      </select>
                                                  </div>
                                                  <input 
                                                      type="text"
                                                      value={dialogue.text}
                                                      onChange={(e) => updateDialogue(index, dIndex, 'text', e.target.value)}
                                                      placeholder="..."
                                                      className="w-full bg-transparent border-b border-slate-200 dark:border-slate-800 focus:border-indigo-500 text-sm py-1 text-slate-900 dark:text-slate-200 outline-none placeholder-slate-400 dark:placeholder-slate-700"
                                                  />
                                              </div>
                                              <button 
                                                  onClick={() => removeDialogue(index, dIndex)}
                                                  className="mt-1 text-slate-400 hover:text-red-500 opacity-0 group-hover/dialogue:opacity-100 transition-opacity"
                                              >
                                                  <X className="w-3 h-3" />
                                              </button>
                                          </div>
                                      ))}
                                      {(!panel.dialogues || panel.dialogues.length === 0) && (
                                          <div className="text-center py-4">
                                              <Quote className="w-6 h-6 text-slate-300 dark:text-slate-800 mx-auto mb-1" />
                                              <span className="text-[10px] text-slate-400 dark:text-slate-600">No dialogue</span>
                                          </div>
                                      )}
                                  </div>
                              </div>
                          </div>
                      </div>
                    </div>
                  ))}

                   <button 
                     onClick={handleAddPanel}
                     className="w-full py-6 border-2 border-dashed border-slate-300 dark:border-slate-800 text-slate-500 rounded-2xl hover:border-indigo-500/50 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all flex items-center justify-center gap-2 group"
                   >
                       <FilePlus className="w-6 h-6 group-hover:scale-110 transition-transform" /> 
                       <span className="font-bold">Add New Scene</span>
                   </button>
                </div>
             </div>
          )}

            {/* TAB: RESULT */}
            {activeTab === 'result' && storyboard && (
              <div className="w-full min-h-full bg-slate-100 dark:bg-slate-950 flex flex-col items-center animate-fade-in transition-colors duration-300">

                {/* Toolbar - Sticky */}
              <div className="sticky top-0 z-40 w-full flex justify-center p-4 md:p-6 bg-slate-100/90 dark:bg-slate-950/90 backdrop-blur-md">
                 <div className="w-full max-w-[800px]">
                     <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xl">
                         <div className="text-sm font-bold flex items-center gap-3 pl-2">
                            {(currentPanelIndex !== -1 || generatingCover) ? (
                                <div className="flex items-center gap-2 text-indigo-500 dark:text-indigo-400">
                                   <Loader2 className="w-4 h-4 animate-spin" />
                                   <span>
                                      {generatingCover ? "Generating Cover..." : `Painting Panel ${currentPanelIndex + 1}/${storyboard.panels.length}...`}
                                   </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-emerald-500 dark:text-emerald-400">
                                    <span className="relative flex h-2.5 w-2.5">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                    </span>
                                    <span>Completed</span>
                                </div>
                            )}
                         </div>

                         <div className="flex items-center gap-4 w-full sm:w-auto">
                            <select 
                                value={pageTemplate}
                                onChange={(e) => setPageTemplate(e.target.value as PageTemplate)}
                                className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:border-indigo-500 outline-none min-w-[140px]"
                            >
                                <option value="dynamic">Layout: Free Canvas</option>
                                <option value="webtoon">Layout: Webtoon</option>
                                <option value="four_koma">Layout: 4-Koma</option>
                            </select>

                            <button
                                onClick={resetLayouts}
                                className="flex items-center justify-center gap-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                                title="Reset Layout Positions"
                            >
                                <RefreshCcw className="w-3.5 h-3.5" /> Reset
                            </button>

                            {/* Tool Controls (Collapsible) */}
                            <div className="relative border-l border-slate-300 dark:border-slate-700 pl-3">
                                <button
                                    onClick={() => setIsToolboxOpen(!isToolboxOpen)}
                                    className={`p-2 rounded-lg transition-all flex items-center gap-2 ${isToolboxOpen ? 'bg-indigo-100 text-indigo-600 dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                    title="Toggle Tools"
                                >
                                    <Wrench className="w-4 h-4" />
                                    <span className="text-xs font-bold hidden sm:inline">Tools</span>
                                </button>

                                {/* Dropdown / Collapsible Area */}
                                {isToolboxOpen && (
                                    <div className="absolute top-full right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 flex flex-col gap-1 z-50 animate-fade-in min-w-[160px]">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">Canvas Tools</div>

                                        <button
                                            onClick={() => setShowBorders(!showBorders)}
                                            className={`p-2 rounded-lg transition-all flex items-center gap-3 text-xs font-medium w-full text-left ${!showBorders ? 'bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                        >
                                            <BoxSelect className="w-4 h-4" />
                                            <span>{showBorders ? 'Hide Borders' : 'Show Borders'}</span>
                                        </button>

                                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>

                                        <button
                                            onClick={() => handleAddTool('box')}
                                            className="p-2 rounded-lg transition-all flex items-center gap-3 text-xs font-medium w-full text-left text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        >
                                            <Square className="w-4 h-4" />
                                            <span>Add Box</span>
                                        </button>
                                        <button
                                            onClick={() => handleAddTool('circle')}
                                            className="p-2 rounded-lg transition-all flex items-center gap-3 text-xs font-medium w-full text-left text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        >
                                            <Circle className="w-4 h-4" />
                                            <span>Add Circle</span>
                                        </button>
                                        <button
                                            onClick={() => handleAddTool('bubble')}
                                            className="p-2 rounded-lg transition-all flex items-center gap-3 text-xs font-medium w-full text-left text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        >
                                            <MessageCircle className="w-4 h-4" />
                                            <span>Add Bubble</span>
                                        </button>
                                        <button
                                            onClick={() => handleAddTool('text')}
                                            className="p-2 rounded-lg transition-all flex items-center gap-3 text-xs font-medium w-full text-left text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        >
                                            <Type className="w-4 h-4" />
                                            <span>Add Text</span>
                                        </button>
                                        <button
                                            onClick={() => handleAddTool('speed-lines')}
                                            className="p-2 rounded-lg transition-all flex items-center gap-3 text-xs font-medium w-full text-left text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        >
                                            <Zap className="w-4 h-4" />
                                            <span>Speed Lines</span>
                                        </button>
                                        <button
                                            onClick={() => handleAddTool('focus-lines')}
                                            className="p-2 rounded-lg transition-all flex items-center gap-3 text-xs font-medium w-full text-left text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        >
                                            <SunIcon className="w-4 h-4" />
                                            <span>Focus Lines</span>
                                        </button>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="p-2 rounded-lg transition-all flex items-center gap-3 text-xs font-medium w-full text-left text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        >
                                            <ImageIcon className="w-4 h-4" />
                                            <span>Add Image</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageUpload}
                            />

                            <button 
                            onClick={handleDownload}
                            disabled={currentPanelIndex !== -1 || generatingCover}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 shadow-lg shadow-indigo-500/20 dark:shadow-indigo-900/20"
                            >
                                <Download className="w-4 h-4" /> Export
                            </button>
                         </div>
                     </div>
                 </div>
              </div>

              {/* Canvas Container */}
              <div className="w-full px-4 md:px-8 pb-40 flex justify-center overflow-x-hidden">
                  {/* Scaled Wrapper: Adjusts width/height to fit screen while keeping internal 800px layout */}
                  <div
                    className="relative transition-transform duration-200 ease-out origin-top"
                    style={{
                        width: 800 * scale,
                        height: (pageTemplate === 'dynamic' ? containerHeight : 2000) * scale // Approx height for non-dynamic
                    }}
                  >
                    <div
                        className="w-[800px] bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transition-colors duration-300 origin-top-left absolute top-0 left-0"
                        style={{ transform: `scale(${scale})` }}
                    >
                      {/* Note: We force min-height based on calculation to allow scrolling */}
                      <div
                         ref={resultRef}
                         className={`w-full bg-white mx-auto p-8 box-border relative transition-all duration-300 ease-out`}
                         style={{ height: pageTemplate === 'dynamic' ? containerHeight : 'auto', minHeight: '1200px' }}
                      >
                        
                        {/* Render Cover & Panels */}
                        {pageTemplate === 'dynamic' ? (
                            <div className="relative w-full h-full">
                                {/* Cover (Draggable) */}
                                {(storyboard.coverImagePrompt || storyboard.coverImageUrl) && (
                                    <Rnd
                                        size={{
                                            width: storyboard.coverLayout?.width || 736,
                                            height: storyboard.coverLayout?.height || 400
                                        }}
                                        position={{
                                            x: storyboard.coverLayout?.x || 16,
                                            y: storyboard.coverLayout?.y || 16
                                        }}
                                        onDragStop={(_e, d) => updateCoverLayout({ x: d.x, y: d.y })}
                                        onResizeStop={(_e, _direction, ref, _delta, position) => {
                                            updateCoverLayout({
                                                width: ref.style.width,
                                                height: ref.style.height,
                                                ...position,
                                            });
                                        }}
                                        scale={scale}
                                        bounds="parent"
                                        className="group/cover-container"
                                        dragHandleClassName="drag-handle-cover"
                                        style={{ zIndex: storyboard.coverLayout?.zIndex || 0 }}
                                    >
                                        <div className="w-full h-full relative group cursor-move drag-handle-cover">
                                            {storyboard.coverImageUrl ? (
                                                <div className={`w-full h-full relative overflow-hidden border-[4px] border-black shadow-lg`}>
                                                    <img
                                                    src={storyboard.coverImageUrl}
                                                    alt="Cover"
                                                    className="w-full h-full object-cover"
                                                    style={storyboard.styleMode === 'bw' ? { filter: 'grayscale(100%) contrast(1.15) brightness(1.05)' } : {}}
                                                    />
                                                </div>
                                            ) : (
                                                <div className={`w-full h-full border-[4px] border-black flex flex-col items-center justify-center bg-gray-50 gap-4`}>
                                                    {generatingCover ? (
                                                        <>
                                                            <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
                                                            <span className="font-comic text-gray-500 animate-pulse">Drawing Cover...</span>
                                                        </>
                                                    ) : (
                                                        <h1 className="font-manga text-4xl text-black text-center px-4">{storyboard.title}</h1>
                                                    )}
                                                </div>
                                            )}

                                            {/* Hover Frame to indicate draggable */}
                                            <div
                                                className="absolute inset-0 border-2 border-indigo-500/0 group-hover:border-indigo-500/50 transition-colors pointer-events-none"
                                                data-html2canvas-ignore="true"
                                            />
                                            <div
                                                className="absolute top-3 left-3 bg-indigo-500 text-white text-[10px] px-2 py-1 rounded opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                                data-html2canvas-ignore="true"
                                            >
                                                Cover (Drag/Resize)
                                            </div>

                                            {/* Cover Reroll Button */}
                                            {storyboard.coverImageUrl && (
                                                <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity z-50" data-html2canvas-ignore="true">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRegenerateCoverImage(); }}
                                                        className="bg-white/90 backdrop-blur text-slate-800 p-2 rounded-full shadow-lg border border-slate-200 hover:scale-110 transition-transform hover:text-indigo-600"
                                                        title="표지 다시 그리기"
                                                    >
                                                        <RefreshCw className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </Rnd>
                                )}

                                {storyboard.panels.map((panel, idx) => (
                                    <Rnd
                                        key={panel.id}
                                        size={{
                                            width: panel.layout?.width || 300,
                                            height: panel.layout?.height || 300
                                        }}
                                        position={{
                                            x: panel.layout?.x || 0,
                                            y: panel.layout?.y || 0
                                        }}
                                        onDragStop={(_e, d) => updatePanelLayout(idx, { x: d.x, y: d.y })}
                                        onResizeStop={(_e, _direction, ref, _delta, position) => {
                                            updatePanelLayout(idx, {
                                                width: ref.style.width,
                                                height: ref.style.height,
                                                ...position,
                                            });
                                        }}
                                        onMouseDown={(e) => {
                                            // Don't deselect if clicking inside
                                            e.stopPropagation();
                                            bringToFront(idx);
                                        }}
                                        onTouchStart={(e) => {
                                            e.stopPropagation();
                                            setSelectedPanelId(panel.id);
                                            bringToFront(idx);
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedPanelId(panel.id);
                                        }}
                                        style={{ zIndex: panel.layout?.zIndex || 1 }}
                                        scale={scale}
                                        bounds="parent"
                                        className={`group/panel-container ${selectedPanelId === panel.id ? 'z-20' : ''}`}
                                        enableUserSelectHack={false}
                                        dragHandleClassName="drag-handle"
                                        cancel=".no-drag"
                                        resizeHandleStyles={{
                                            bottomRight: { cursor: 'se-resize', width: 40, height: 40, bottom: -10, right: -10, background: 'transparent' }
                                        }}
                                    >
                                        <div className={`w-full h-full relative shadow-lg hover:shadow-xl transition-shadow drag-handle cursor-move ${selectedPanelId === panel.id ? 'ring-2 ring-indigo-500' : ''}`}>
                                            <ComicPanel
                                                panel={{...panel, panelSize: 'square'}} // Aspect ratio handled by Rnd dimensions now
                                                onRegenerate={handleRegeneratePanel}
                                                styleMode={storyboard.styleMode}
                                                renderMode={storyboard.renderMode}
                                                isFreeMode={true}
                                                showBorders={showBorders}
                                            />

                                            {/* Resize Handle Visual */}
                                            <div
                                                className={`absolute bottom-0 right-0 w-4 h-4 bg-indigo-500/50 rounded-tl-lg cursor-se-resize transition-opacity z-50 pointer-events-none ${selectedPanelId === panel.id ? 'opacity-100' : 'opacity-0 group-hover/panel-container:opacity-100'}`}
                                                data-html2canvas-ignore="true"
                                            />

                                            {/* Move Indicator (Top Center) - Now acts as a drag handle */}
                                            <div
                                                className={`absolute top-2 left-1/2 -translate-x-1/2 transition-opacity z-50 drag-handle cursor-move ${selectedPanelId === panel.id ? 'opacity-100' : 'opacity-0 group-hover/panel-container:opacity-100'}`}
                                                data-html2canvas-ignore="true"
                                            >
                                                <div className="bg-indigo-600/90 text-white text-[10px] px-2 py-1 rounded-full shadow-md flex items-center gap-1 backdrop-blur-sm">
                                                    <Move className="w-3 h-3" />
                                                    <span className="font-bold">Drag to Move</span>
                                                </div>
                                            </div>

                                            {/* Size Presets (Floating) - Toggleable on click */}
                                            <div className="absolute top-2 left-2 z-50 flex gap-1 no-drag" data-html2canvas-ignore="true">
                                                {activeSettingsPanel === idx ? (
                                                    <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg border border-slate-200 p-1 flex gap-1 animate-fade-in no-drag">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); updatePanelLayout(idx, { width: 300, height: 300 }); setActiveSettingsPanel(null); }}
                                                            className="p-2 md:p-1 rounded hover:bg-slate-100 text-slate-500 no-drag"
                                                            title="Square (300x300)"
                                                        >
                                                            <div className="w-3 h-3 border border-current"></div>
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); updatePanelLayout(idx, { width: 616, height: 300 }); setActiveSettingsPanel(null); }}
                                                            className="p-2 md:p-1 rounded hover:bg-slate-100 text-slate-500 no-drag"
                                                            title="Wide (616x300)"
                                                        >
                                                            <div className="w-5 h-3 border border-current"></div>
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); updatePanelLayout(idx, { width: 300, height: 450 }); setActiveSettingsPanel(null); }}
                                                            className="p-2 md:p-1 rounded hover:bg-slate-100 text-slate-500 no-drag"
                                                            title="Tall (300x450)"
                                                        >
                                                            <div className="w-3 h-5 border border-current"></div>
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setActiveSettingsPanel(null); }}
                                                            className="p-2 md:p-1 rounded hover:bg-slate-100 text-slate-400 no-drag"
                                                            aria-label="Close layout settings"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setActiveSettingsPanel(idx); }}
                                                        className="bg-white/90 backdrop-blur text-slate-500 p-2 rounded-lg shadow-md border border-slate-200 hover:text-indigo-600 transition-colors opacity-100 md:opacity-0 md:group-hover/panel-container:opacity-100 no-drag"
                                                        aria-label="Open layout settings"
                                                    >
                                                       <Settings2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </Rnd>
                                ))}

                                {/* Render Added Tools */}
                                {addedTools.map(tool => (
                                    <MangaTool
                                        key={tool.id}
                                        {...tool}
                                        scale={scale}
                                        onUpdate={handleUpdateTool}
                                        onContentChange={handleUpdateToolContent}
                                        onDelete={handleDeleteTool}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="w-full flex flex-col gap-4">
                                {/* Cover (Static for non-dynamic) */}
                                {(storyboard.coverImagePrompt || storyboard.coverImageUrl) && (
                                    <div className="mb-16 w-full relative">
                                    {storyboard.coverImageUrl ? (
                                        <div className={`w-full ${storyboard.coverAspectRatio === 'landscape' ? 'aspect-[16/9]' : 'aspect-[3/4] max-w-[600px] mx-auto'} relative overflow-hidden border-[4px] border-black shadow-lg`}>
                                            <img
                                            src={storyboard.coverImageUrl}
                                            alt="Cover"
                                            className="w-full h-full object-cover"
                                            style={storyboard.styleMode === 'bw' ? { filter: 'grayscale(100%) contrast(1.15) brightness(1.05)' } : {}}
                                            />
                                        </div>
                                    ) : (
                                        <div className={`w-full ${storyboard.coverAspectRatio === 'landscape' ? 'aspect-[16/9]' : 'aspect-[3/4] max-w-[600px] mx-auto'} border-[4px] border-black flex flex-col items-center justify-center bg-gray-50 gap-4`}>
                                            {generatingCover ? (
                                                <>
                                                    <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
                                                    <span className="font-comic text-gray-500 animate-pulse">Drawing Cover...</span>
                                                </>
                                            ) : (
                                                <h1 className="font-manga text-4xl text-black text-center px-4">{storyboard.title}</h1>
                                            )}
                                        </div>
                                    )}
                                    </div>
                                )}

                                {layoutPanels.map((panel) => (
                                    <div
                                      key={panel.id}
                                      className={`${panel.gridColSpan} ${panel.gridRowSpan} relative`}
                                    >
                                        <ComicPanel
                                            panel={{...panel, panelSize: panel.displaySize}}
                                            onRegenerate={handleRegeneratePanel}
                                            styleMode={storyboard.styleMode}
                                            renderMode={storyboard.renderMode}
                                            showBorders={showBorders}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div className="mt-32 flex justify-between text-black/40 font-mono text-[10px] border-t-2 border-black/10 pt-2 uppercase tracking-widest">
                            <span>Generated by MangaGen Pro</span>
                            <span>{new Date().toLocaleDateString()}</span>
                        </div>
                      </div>
                  </div>
                </div>
                </div>
              </div>
            )}

            </main>
          </>
        )}
      </div>
    </div>
  );
};

export default App;