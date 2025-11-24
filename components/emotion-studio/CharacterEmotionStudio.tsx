
import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Upload, Wand2, Download, RefreshCw, Image as ImageIcon, AlertCircle, Sparkles, Trash2, Plus, Search, Settings2, X, Maximize2, Ratio } from 'lucide-react';
import { ReferenceImage, GeneratedImage, ImageQuality, AspectRatio } from './types';
import { EMOTION_PRESETS } from './constants';
import { generateCharacterVariant } from './services/geminiStudio';

// Helper for file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

const CharacterEmotionStudio: React.FC = () => {
  // Inputs
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(null);
  const [additionalImage, setAdditionalImage] = useState<ReferenceImage | null>(null);
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [imageQuality, setImageQuality] = useState<ImageQuality>('1K');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');

  // Selection & Generation State
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>(['happy_smile', 'angry']);
  const [customEmotion, setCustomEmotion] = useState('');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const additionalFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, isAdditional: boolean = false) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const base64 = await fileToBase64(file);
        const newImage = {
          file,
          previewUrl: URL.createObjectURL(file),
          base64,
          mimeType: file.type
        };

        if (isAdditional) {
          setAdditionalImage(newImage);
        } else {
          setReferenceImage(newImage);
          // Clear previous results when new main reference is uploaded
          setGeneratedImages([]);
        }
      } catch (err) {
        console.error("Error processing file", err);
        alert("Failed to process image file.");
      }
    }
  };

  const removeAdditionalImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdditionalImage(null);
    if (additionalFileInputRef.current) additionalFileInputRef.current.value = '';
  };

  const toggleEmotion = (id: string) => {
    setSelectedEmotions(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const handleAddCustomEmotion = () => {
    if (customEmotion.trim() && !selectedEmotions.includes(customEmotion.trim())) {
      setSelectedEmotions(prev => [...prev, customEmotion.trim()]);
      setCustomEmotion('');
    }
  };

  const handleRemoveEmotion = (id: string) => {
      setSelectedEmotions(prev => prev.filter(e => e !== id));
  };

  const handleGenerate = async () => {
    if (!referenceImage || selectedEmotions.length === 0) return;

    setIsGenerating(true);
    const newPlaceholders: GeneratedImage[] = selectedEmotions.map(emotionId => {
      const predefined = EMOTION_PRESETS.find(e => e.id === emotionId);
      // If it's a custom emotion, we use the ID as the label
      const label = predefined ? predefined.label : emotionId;
      return {
        id: `${emotionId}-${Date.now()}`,
        emotionLabel: label,
        imageUrl: null,
        loading: true
      };
    });

    // Prepend new images to the list instead of replacing
    setGeneratedImages(prev => [...newPlaceholders, ...prev]);

    const promises = newPlaceholders.map(async (item) => {
      const emotionId = selectedEmotions.find(id =>
        EMOTION_PRESETS.find(p => p.id === id)?.label === item.emotionLabel || id === item.emotionLabel
      ) || item.emotionLabel;

      const predefined = EMOTION_PRESETS.find(e => e.id === emotionId);
      const promptTags = predefined ? predefined.tags : `expression of ${item.emotionLabel}`;

      try {
        const imageUrl = await generateCharacterVariant(
          referenceImage.base64,
          referenceImage.mimeType,
          item.emotionLabel,
          promptTags,
          additionalPrompt,
          imageQuality,
          aspectRatio,
          additionalImage?.base64,
          additionalImage?.mimeType
        );

        setGeneratedImages(prev => prev.map(img =>
          img.id === item.id ? { ...img, imageUrl, loading: false } : img
        ));
      } catch (error) {
        setGeneratedImages(prev => prev.map(img =>
          img.id === item.id ? { ...img, loading: false, error: "Generation failed" } : img
        ));
      }
    });

    await Promise.all(promises);
    setIsGenerating(false);
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredEmotions = useMemo(() => {
    return EMOTION_PRESETS.filter(e =>
      e.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.tags.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => a.label.localeCompare(b.label));
  }, [searchQuery]);

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 selection:bg-indigo-500/30 font-sans p-6 md:p-8 animate-fade-in">

      <main className="max-w-7xl mx-auto space-y-8 pb-32">

        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Character Emotion Studio</h2>
            <p className="text-slate-500 dark:text-slate-400">캐릭터 원화를 기반으로 다양한 감정 표현을 생성하세요.</p>
        </div>

        {/* Top Section: Upload & Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left: Upload Area & Additional Settings */}
          <div className="lg:col-span-4 space-y-6">

            {/* Main Reference */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /> Character Reference
              </h2>

              <div
                className={`relative group border-2 border-dashed rounded-xl transition-all duration-300 overflow-hidden aspect-square flex flex-col items-center justify-center cursor-pointer
                  ${referenceImage ? 'border-indigo-500/50 bg-slate-100 dark:bg-slate-800' : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 bg-slate-50 dark:bg-slate-900/50'}
                `}
                onClick={() => fileInputRef.current?.click()}
              >
                {referenceImage ? (
                  <>
                    <img
                      src={referenceImage.previewUrl}
                      alt="Reference"
                      className="w-full h-full object-contain bg-slate-50 dark:bg-slate-950/50"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="flex items-center gap-2 text-white font-medium">
                        <RefreshCw className="w-4 h-4" /> Change Image
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6">
                    <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Click to upload character</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">The source of truth for the art style</p>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e, false)}
                />
              </div>
            </div>

            {/* Additional Instructions / Configuration */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-purple-500 dark:text-purple-400" /> Configuration
              </h2>

              <div className="space-y-5">

                {/* Quality Selector */}
                <div>
                   <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Maximize2 className="w-3 h-3" /> Output Quality
                   </label>
                   <div className="grid grid-cols-3 gap-2">
                      {(['1K', '2K', '4K'] as ImageQuality[]).map((q) => (
                        <button
                          key={q}
                          onClick={() => setImageQuality(q)}
                          className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all
                            ${imageQuality === q
                              ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-500/20'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750 hover:text-slate-900 dark:hover:text-slate-200'}
                          `}
                        >
                          {q}
                        </button>
                      ))}
                   </div>
                </div>

                {/* Aspect Ratio Selector */}
                <div>
                   <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Ratio className="w-3 h-3" /> Aspect Ratio
                   </label>
                   <div className="grid grid-cols-3 gap-2">
                      {(['1:1', '3:4', '4:3', '9:16', '16:9'] as AspectRatio[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => setAspectRatio(r)}
                          className={`py-2 px-2 rounded-lg text-xs font-medium border transition-all
                            ${aspectRatio === r
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750 hover:text-slate-900 dark:hover:text-slate-200'}
                          `}
                        >
                          {r}
                        </button>
                      ))}
                   </div>
                </div>

                {/* Text Prompt */}
                <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Additional Instructions</label>
                    <textarea
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none h-20"
                        placeholder="e.g. Wearing a school uniform, holding an apple..."
                        value={additionalPrompt}
                        onChange={(e) => setAdditionalPrompt(e.target.value)}
                    />
                </div>

                {/* Secondary Image */}
                <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Style/Outfit Reference (Optional)
                    </label>
                    <div
                        className={`relative border border-dashed rounded-xl transition-all duration-300 overflow-hidden h-24 flex flex-col items-center justify-center cursor-pointer
                        ${additionalImage ? 'border-purple-500/50 bg-slate-100 dark:bg-slate-800' : 'border-slate-300 dark:border-slate-700 hover:border-purple-400/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 bg-slate-50 dark:bg-slate-900/50'}
                        `}
                        onClick={() => additionalFileInputRef.current?.click()}
                    >
                        {additionalImage ? (
                        <div className="relative w-full h-full group">
                            <img
                                src={additionalImage.previewUrl}
                                alt="Style Ref"
                                className="w-full h-full object-cover opacity-80"
                            />
                             <button
                                onClick={removeAdditionalImage}
                                className="absolute top-1 right-1 bg-black/60 hover:bg-red-500/80 text-white p-1 rounded-full transition-colors"
                             >
                                <X className="w-3 h-3" />
                             </button>
                        </div>
                        ) : (
                        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-400">
                            <Upload className="w-4 h-4" />
                            <span className="text-xs">Upload Reference</span>
                        </div>
                        )}
                        <input
                            type="file"
                            ref={additionalFileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => handleFileSelect(e, true)}
                        />
                    </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Emotion Selection */}
          <div className="lg:col-span-8 space-y-6">
             <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /> Select Emotions
                  </h2>
                  <div className="text-xs text-slate-500 dark:text-slate-500">
                    {selectedEmotions.length} selected
                  </div>
                </div>

                <div className="flex-1 flex flex-col">

                  {/* Search & Filter */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 dark:text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search 70+ emotions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>

                  {/* Emotion Grid - Scrollable */}
                  <div className="flex-1 overflow-y-auto max-h-[400px] min-h-[300px] pr-2 custom-scrollbar">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {filteredEmotions.map((emotion) => (
                        <button
                          key={emotion.id}
                          onClick={() => toggleEmotion(emotion.id)}
                          disabled={isGenerating}
                          className={`
                            px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border text-left truncate flex items-center justify-between
                            ${selectedEmotions.includes(emotion.id)
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'}
                          `}
                          title={emotion.tags}
                        >
                          <span className="truncate">{emotion.label}</span>
                        </button>
                      ))}
                    </div>
                    {filteredEmotions.length === 0 && (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-500 text-sm">
                        No emotions found matching "{searchQuery}"
                      </div>
                    )}
                  </div>

                  {/* Custom Emotion Input */}
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-2">Custom Emotion Tag</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customEmotion}
                        onChange={(e) => setCustomEmotion(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCustomEmotion()}
                        placeholder="Type custom emotion..."
                        disabled={isGenerating}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                      />
                      <button
                        onClick={handleAddCustomEmotion}
                        disabled={!customEmotion.trim() || isGenerating}
                        className="p-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg disabled:opacity-50 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Selected Tags Display */}
                  {selectedEmotions.length > 0 && (
                     <div className="flex flex-wrap gap-2 mt-4">
                        {selectedEmotions.map(em => {
                          const preset = EMOTION_PRESETS.find(p => p.id === em);
                          return (
                            <span key={em} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 text-xs text-indigo-700 dark:text-indigo-200 animate-in fade-in zoom-in duration-200">
                              {preset ? preset.label : em}
                              <button onClick={() => handleRemoveEmotion(em)} disabled={isGenerating} className="hover:text-indigo-900 dark:hover:text-indigo-100 ml-1">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                        <button
                          onClick={() => setSelectedEmotions([])}
                          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline decoration-slate-400 dark:decoration-slate-600 underline-offset-2"
                        >
                          Clear all
                        </button>
                     </div>
                  )}
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={!referenceImage || selectedEmotions.length === 0 || isGenerating}
                  className={`
                    w-full py-4 mt-6 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-xl transition-all
                    ${!referenceImage || selectedEmotions.length === 0 || isGenerating
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:via-purple-500 hover:to-indigo-500 text-white shadow-indigo-500/25 hover:scale-[1.01] active:scale-[0.99]'}
                  `}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" /> Processing {selectedEmotions.length} Images...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" /> Generate Variations
                    </>
                  )}
                </button>
             </div>
          </div>
        </div>

        {/* Results Grid */}
        {generatedImages.length > 0 && (
          <div className="space-y-4 animate-in fade-in duration-700">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-green-500 dark:text-green-400" /> Generation Results
                </h3>
                <button onClick={() => setGeneratedImages([])} className="text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Clear Results
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {generatedImages.map((img) => (
                <div key={img.id} className="group relative bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-lg transition-all hover:shadow-xl hover:border-indigo-500/30">

                  {/* Image Container */}
                  <div className={`relative bg-slate-50 dark:bg-slate-950 flex items-center justify-center overflow-hidden ${aspectRatio === '1:1' ? 'aspect-square' : aspectRatio === '16:9' ? 'aspect-video' : aspectRatio === '9:16' ? 'aspect-[9/16]' : aspectRatio === '3:4' ? 'aspect-[3/4]' : 'aspect-[4/3]'}`}>
                    {img.loading ? (
                      <div className="flex flex-col items-center gap-3 p-4 text-center">
                        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                        <p className="text-xs text-indigo-500 dark:text-indigo-300 animate-pulse font-medium">Applying emotion:<br/>{img.emotionLabel}</p>
                      </div>
                    ) : img.error ? (
                      <div className="flex flex-col items-center gap-2 text-red-500 dark:text-red-400 px-4 text-center">
                        <AlertCircle className="w-8 h-8 opacity-50" />
                        <span className="text-xs">{img.error}</span>
                      </div>
                    ) : img.imageUrl ? (
                      <img
                        src={img.imageUrl}
                        alt={img.emotionLabel}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : null}

                    {/* Overlay Actions */}
                    {!img.loading && !img.error && img.imageUrl && (
                       <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-end p-3 opacity-0 group-hover:opacity-100">
                          <button
                            onClick={() => downloadImage(img.imageUrl!, `character-${img.emotionLabel}.png`)}
                            className="bg-white/90 hover:bg-white text-slate-900 p-2.5 rounded-lg backdrop-blur-sm transition-all shadow-lg transform translate-y-2 group-hover:translate-y-0 duration-200"
                            title="Download"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                       </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 capitalize flex items-center justify-between">
                      <span className="truncate mr-2">{img.emotionLabel}</span>
                      {img.loading && <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal uppercase tracking-wide">...</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CharacterEmotionStudio;
