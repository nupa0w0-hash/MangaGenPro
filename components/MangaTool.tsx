import React, { useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { X, Move, RotateCw } from 'lucide-react';

export interface MangaToolProps {
  id: number;
  type: 'box' | 'circle' | 'text' | 'bubble' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  imageUrl?: string;
  rotation?: number;
  textStyle?: { fontWeight?: string, fontSize?: string, color?: string, fontFamily?: string };
  scale: number;
  onUpdate: (id: number, data: { x: number, y: number, width: number, height: number, rotation?: number }) => void;
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
  imageUrl,
  rotation = 0,
  textStyle,
  scale,
  onUpdate,
  onContentChange,
  onDelete
}) => {
  const rotationRef = useRef<HTMLDivElement>(null);
  const rndRef = useRef<Rnd>(null);

  // Rotation Logic
  useEffect(() => {
    const handleRotate = (e: MouseEvent) => {
       if (!rotationRef.current || !rndRef.current) return;
       // We are dragging the handle.
       // Calculate center of the element
       // Note: Rnd element position is absolute.
       // We need screen coordinates.
       const el = rndRef.current.getSelfElement();
       if (!el) return;

       const rect = el.getBoundingClientRect();
       const centerX = rect.left + rect.width / 2;
       const centerY = rect.top + rect.height / 2;

       const angleRad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
       let angleDeg = angleRad * (180 / Math.PI);

       // Snap to 45 degrees if Shift is held? (Optional enhancement)
       // Add 90 degrees because handle is at top (-90deg relative to 0 at 3 o'clock)
       // Actually handle is at top. Standard atan2 0 is Right. -90 is Top.
       // So if mouse is at Top, angle is -90.
       // We want rotation to be 0 at Top? Or standard CSS rotation (0 is upright).
       // CSS rotate(0) is upright.
       // If handle is at top, and we drag it, we want the element to follow.
       // Offset by 90 degrees.
       angleDeg += 90;

       onUpdate(id, { x, y, width, height, rotation: angleDeg });
    };

    const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleRotate);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent drag
        document.addEventListener('mousemove', handleRotate);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleEl = rotationRef.current;
    if (handleEl) {
        handleEl.addEventListener('mousedown', handleMouseDown as any);
    }

    return () => {
        if (handleEl) handleEl.removeEventListener('mousedown', handleMouseDown as any);
        document.removeEventListener('mousemove', handleRotate);
        document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [id, x, y, width, height, onUpdate]);

  return (
    <Rnd
      ref={rndRef}
      size={{ width, height }}
      position={{ x, y }}
      onDragStop={(_e, d) => onUpdate(id, { x: d.x, y: d.y, width, height, rotation })}
      onResizeStop={(_e, _direction, ref, _delta, position) => {
        onUpdate(id, {
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
          rotation,
          ...position,
        });
      }}
      scale={scale}
      bounds="parent"
      className="group/tool-container z-[50]"
      dragHandleClassName="drag-handle-tool"
      cancel=".no-drag"
      resizeHandleStyles={{
          bottomRight: { cursor: 'se-resize', width: 20, height: 20, bottom: -5, right: -5, background: 'transparent' }
      }}
    >
      <div className="relative w-full h-full">

        {/* ROTATED CONTENT WRAPPER */}
        <div
            className="w-full h-full"
            style={{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: 'center center'
            }}
        >
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

            {/* Image */}
            {type === 'image' && imageUrl && (
               <img
                 src={imageUrl}
                 alt="User Upload"
                 className="w-full h-full object-contain pointer-events-none select-none"
               />
            )}

            {/* Text Area */}
            {type === 'text' && (
                <textarea
                    className="w-full h-full bg-transparent p-2 resize-none outline-none font-comic text-center leading-snug no-drag focus:bg-white/20 transition-colors border border-dashed border-transparent hover:border-slate-300 focus:border-indigo-400/50 rounded"
                    value={content || ''}
                    onChange={(e) => onContentChange && onContentChange(id, e.target.value)}
                    placeholder="Text..."
                    style={{
                        fontSize: textStyle?.fontSize ? textStyle.fontSize : Math.max(12, Math.min(width, height) / 4) + 'px',
                        fontWeight: textStyle?.fontWeight || 'normal',
                        color: textStyle?.color || 'black',
                        fontFamily: textStyle?.fontFamily || 'inherit'
                    }}
                />
            )}
        </div>

        {/* --- UI Overlays (Ignored by html2canvas) --- */}

        {/* Rotation Handle (Sticks out top) */}
        <div
             ref={rotationRef}
             className="absolute -top-8 left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing opacity-0 group-hover/tool-container:opacity-100 transition-opacity z-50 no-drag"
             data-html2canvas-ignore="true"
             title="Rotate"
        >
             <div className="bg-white text-slate-600 p-1.5 rounded-full shadow-md border border-slate-200 hover:text-indigo-600 hover:border-indigo-500 transition-colors">
                 <RotateCw className="w-3.5 h-3.5" />
             </div>
             {/* Connector Line */}
             <div className="w-px h-3 bg-indigo-500/50 mx-auto"></div>
        </div>

        {/* Drag Handle (Center) */}
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
