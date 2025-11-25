
import React, { useState, useRef } from 'react';
import { generateReferenceImage } from '../../services/geminiService';
import { Loader2, Sparkles, Upload } from 'lucide-react';

type AspectRatio = '1:1' | '16:9' | '3:4';
type Resolution = '1K' | '2K' | '4K';

const ReferenceStudio: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [imageData, setImageData] = useState<string | null>(null);
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [resolution, setResolution] = useState<Resolution>('1K');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            setImageData(event.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleGenerate = async () => {
        if (!prompt && !imageData) {
            alert('Please provide a prompt or upload an image.');
            return;
        }
        setIsGenerating(true);
        setGeneratedImage(null);
        try {
            const result = await generateReferenceImage(prompt, imageData, aspectRatio, resolution);
            setGeneratedImage(result);
        } catch (error) {
            console.error('Reference image generation failed:', error);
            alert('Failed to generate reference image. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-8 bg-slate-100 dark:bg-slate-950">
            <div className="w-full max-w-4xl mx-auto">
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Reference Studio</h2>
                    <p className="text-slate-500 dark:text-slate-400">Create reference images from text or other images.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Panel: Inputs */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
                        {/* Prompt Input */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Prompt</label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g., A magical sword glowing with blue energy, intricate elven design..."
                                className="w-full h-32 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                        </div>

                        {/* Image Upload */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Reference Image (Optional)</label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full h-40 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center cursor-pointer hover:border-indigo-500 transition-colors"
                            >
                                {imageData ? (
                                    <img src={imageData} alt="Uploaded reference" className="max-h-full max-w-full object-contain rounded-md" />
                                ) : (
                                    <div className="text-center text-slate-500">
                                        <Upload className="mx-auto w-8 h-8 mb-2" />
                                        <p className="text-sm">Click to upload an image</p>
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
                             {imageData && (
                                <button onClick={() => setImageData(null)} className="text-xs text-red-500 mt-2">Remove Image</button>
                            )}
                        </div>

                        {/* Settings */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Aspect Ratio</label>
                                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                    <option value="1:1">Square (1:1)</option>
                                    <option value="16:9">Landscape (16:9)</option>
                                    <option value="3:4">Portrait (3:4)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Resolution</label>
                                <select value={resolution} onChange={(e) => setResolution(e.target.value as Resolution)} className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                    <option value="1K">1K</option>
                                    <option value="2K">2K</option>
                                    <option value="4K">4K</option>
                                </select>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="w-full py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-white rounded-xl font-bold text-lg shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isGenerating ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</>
                            ) : (
                                <><Sparkles className="w-5 h-5" /> Generate</>
                            )}
                        </button>
                    </div>

                    {/* Right Panel: Output */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex items-center justify-center">
                        {isGenerating && (
                             <div className="text-center text-slate-500">
                                <Loader2 className="mx-auto w-12 h-12 animate-spin mb-4" />
                                <p>Generating your reference image...</p>
                            </div>
                        )}
                        {!isGenerating && generatedImage && (
                            <img src={generatedImage} alt="Generated reference" className="max-h-full max-w-full object-contain rounded-md shadow-lg" />
                        )}
                        {!isGenerating && !generatedImage && (
                            <div className="text-center text-slate-400 dark:text-slate-600">
                                <p>Your generated image will appear here.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReferenceStudio;
