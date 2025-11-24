import React from 'react';
import { Rnd } from 'react-rnd';
import { X, Move } from 'lucide-react';

interface MangaToolProps {
  id: number;
  type: 'box'; // extensible later
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  onUpdate: (id: number, data: { x: number, y: number, width: number, height: number }) => void;
  onDelete: (id: number) => void;
}

const MangaTool: React.FC<MangaToolProps> = ({
  id,
  type,
  x,
  y,
  width,
  height,
  scale,
  onUpdate,
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
      className="group/tool-container z-[50]" // High z-index to sit on top of panels
      dragHandleClassName="drag-handle-tool"
      resizeHandleStyles={{
          bottomRight: { cursor: 'se-resize', width: 20, height: 20, bottom: -5, right: -5, background: 'transparent' }
      }}
    >
      <div className="relative w-full h-full">

        {/* The Actual Tool Content */}
        {type === 'box' && (
           <div className="w-full h-full bg-white border-[3px] border-black shadow-sm" />
        )}

        {/* --- UI Overlays (Ignored by html2canvas) --- */}

        {/* Drag Handle (Center) */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover/tool-container:opacity-100 transition-opacity drag-handle-tool cursor-move"
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

        {/* Selection Border */}
        <div className="absolute inset-0 border border-indigo-500/50 opacity-0 group-hover/tool-container:opacity-100 pointer-events-none transition-opacity" data-html2canvas-ignore="true" />
      </div>
    </Rnd>
  );
};

export default MangaTool;
