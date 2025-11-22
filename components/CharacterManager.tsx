import React, { useState, useRef } from 'react';
import { Character, StyleMode } from '../types';
import { Plus, Trash2, Upload, User, Users } from 'lucide-react';

interface Props {
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  styleMode?: StyleMode;
}

const CharacterManager: React.FC<Props> = ({ characters, setCharacters, styleMode = 'bw' }) => {
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addCharacter = () => {
    if (!newName.trim()) return;
    if (characters.length >= 10) {
      alert("최대 10명까지만 등록 가능합니다.");
      return;
    }

    const newChar: Character = {
      id: Date.now().toString(),
      name: newName,
      description: newDesc,
      imageBase64: preview
    };

    setCharacters([...characters, newChar]);
    setNewName('');
    setNewDesc('');
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeCharacter = (id: string) => {
    setCharacters(characters.filter(c => c.id !== id));
  };

  return (
    <div className="bg-white dark:bg-slate-900 h-full flex flex-col border-r border-slate-200 dark:border-slate-800 transition-colors duration-300">
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
         <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wider">
            <Users className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            Characters <span className="text-slate-500 font-normal ml-auto text-xs">{characters.length}/10</span>
         </h2>
      </div>
      
      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {characters.map(char => (
          <div key={char.id} className="group relative flex items-start gap-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-all shadow-sm">
            <div className={`w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0 border border-slate-200 dark:border-slate-600 ${styleMode === 'bw' ? 'grayscale' : ''}`}>
              {char.imageBase64 ? (
                <img 
                    src={char.imageBase64} 
                    alt={char.name} 
                    className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-800">
                    <User className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="font-bold text-slate-900 dark:text-slate-200 text-sm truncate">{char.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{char.description || "설명 없음"}</p>
            </div>
            <button 
              onClick={() => removeCharacter(char.id)}
              className="absolute top-2 right-2 p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {characters.length === 0 && (
          <div className="text-center py-10 opacity-60 dark:opacity-40">
              <User className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-500" />
              <p className="text-xs text-slate-500">캐릭터를 등록해주세요</p>
          </div>
        )}
      </div>

      {/* Add Form */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-3 transition-colors duration-300">
        <div className="space-y-2">
            <input
            type="text"
            placeholder="이름 (예: 강철)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
            />
            <input
            type="text"
            placeholder="특징 (예: 붉은 망토, 사이보그 눈)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
            />
        </div>
        
        <div className="flex gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="hidden"
            id="char-upload"
            />
            <label 
                htmlFor="char-upload" 
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg cursor-pointer text-xs transition-colors border border-dashed 
                ${preview 
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500/50 text-indigo-600 dark:text-indigo-300' 
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
            >
            {preview ? <span className="truncate max-w-[80px]">이미지 선택됨</span> : <><Upload className="w-3 h-3" /> 참조 이미지</>}
            </label>

          <button 
            onClick={addCharacter}
            disabled={characters.length >= 10 || !newName}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white p-2 rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CharacterManager;