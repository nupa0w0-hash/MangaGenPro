import React from 'react';
import { Rnd } from 'react-rnd';
import { X, Move } from 'lucide-react';

export interface MangaToolProps {
  id: number;
  type: 'box' | 'circle' | 'text' | 'bubble';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  scale: number;
  onUpdate: (id: number, data: { x: number, y: number, width: number, height: number }) => void;
  onContentChange?: (id: number, content: string) => void;
  onDelete: (id: number) => void;
}

const MangaTool: React.FC<MangaToolProps> = ({
  id,
  type,
  x,
  y,
  width,
  height,
  content,
  scale,
  onUpdate,
  onContentChange,
  onDelete
}) => {
  return (
    <Rnd
      size={{ width, height }}
      position={{ x, y }}
      onDragStop={(_e, d) => onUpdate(id, { x: d.x, y: d.y, width, height })}
      onResizeStop={(_e, _direction, ref, _delta, position) => {
        onUpdate(id, {
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
          ...position,
        });
      }}
      scale={scale}
      bounds="parent"
      className="group/tool-container z-[50]"
      dragHandleClassName="drag-handle-tool"
      cancel=".no-drag" // Crucial for text inputs
      resizeHandleStyles={{
          bottomRight: { cursor: 'se-resize', width: 20, height: 20, bottom: -5, right: -5, background: 'transparent' }
      }}
    >
      <div className="relative w-full h-full">

        {/* --- Tool Renderers --- */}

        {/* Square Box */}
        {type === 'box' && (
           <div className="w-full h-full bg-white border-[3px] border-black shadow-sm" />
        )}

        {/* Circle */}
        {type === 'circle' && (
           <div className="w-full h-full bg-white border-[3px] border-black rounded-full shadow-sm" />
        )}

        {/* Speech Bubble */}
        {type === 'bubble' && (
           <div className="w-full h-full bg-white border-[3px] border-black rounded-[2rem] rounded-bl-none shadow-sm" />
        )}

        {/* Text Area */}
        {type === 'text' && (
            <textarea
                className="w-full h-full bg-transparent border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 p-2 resize-none outline-none font-comic text-black text-center leading-snug no-drag focus:bg-white/50 transition-colors"
                value={content || ''}
                onChange={(e) => onContentChange && onContentChange(id, e.target.value)}
                placeholder="Text..."
                style={{ fontSize: Math.max(12, Math.min(width, height) / 4) + 'px' }} // Simple dynamic font size
            />
        )}

        {/* --- UI Overlays (Ignored by html2canvas) --- */}

        {/* Drag Handle (Center) */}
        {/* For text, we move the handle to top-left to avoid blocking typing, or keep it generic but smaller */}
        <div
          className={`absolute ${type === 'text' ? '-top-4 -left-4' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'} opacity-0 group-hover/tool-container:opacity-100 transition-opacity drag-handle-tool cursor-move z-50`}
          data-html2canvas-ignore="true"
        >
             <div className="bg-indigo-600/90 text-white p-1.5 rounded-full shadow-md backdrop-blur-sm">
                 <Move className="w-3 h-3" />
             </div>
        </div>

        {/* Delete Button (Top Right) */}
        <button
           onClick={(e) => { e.stopPropagation(); onDelete(id); }}
           className="absolute -top-3 -right-3 bg-red-500 text-white p-1 rounded-full shadow-md opacity-0 group-hover/tool-container:opacity-100 transition-opacity hover:bg-red-600 z-50"
           data-html2canvas-ignore="true"
           title="Delete"
        >
            <X className="w-3 h-3" />
        </button>

        {/* Resize Handle Visual */}
        <div
            className="absolute bottom-0 right-0 w-3 h-3 bg-indigo-500/50 rounded-tl cursor-se-resize opacity-0 group-hover/tool-container:opacity-100 transition-opacity pointer-events-none"
            data-html2canvas-ignore="true"
        />

        {/* Selection Border (Hover) */}
        <div className="absolute inset-0 border border-indigo-500/50 opacity-0 group-hover/tool-container:opacity-100 pointer-events-none transition-opacity" data-html2canvas-ignore="true" />
      </div>
    </Rnd>
  );
};

export default MangaTool;
