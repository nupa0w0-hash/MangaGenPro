import React from 'react';
import { Panel, StyleMode } from '../types';
import { RefreshCw, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  panel: Panel;
  onRegenerate: (panel: Panel) => void;
  styleMode: StyleMode;
}

const ComicPanel: React.FC<Props> = ({ panel, onRegenerate, styleMode }) => {
  // Determine aspect ratio styles based on panelSize
  const aspectRatioClass = 
    panel.panelSize === 'wide' ? 'aspect-[16/9]' : 
    panel.panelSize === 'tall' ? 'aspect-[3/4]' : 
    'aspect-square';

  // Bubble rendering logic
  const renderBubbles = () => {
    if (!panel.dialogues || panel.dialogues.length === 0) return null;

    return panel.dialogues.map((dialogue, index) => {
        if (!dialogue.text) return null;
        
        const positions = [
            "bottom-6 left-6",
            "bottom-6 right-6",
            "top-6 right-6",
            "top-6 left-6"
        ];
        const positionClass = positions[index % positions.length];
        
        // Narration styling
        if (dialogue.type === 'narration') {
            return (
                <div key={index} className={`absolute z-10 max-w-[85%] bg-white border-2 border-black px-4 py-2 shadow-[2px_2px_0px_rgba(0,0,0,0.2)] ${index === 0 ? 'top-3 left-3' : 'bottom-3 right-3'}`}>
                    <span className="font-manga font-bold text-sm md:text-base block text-black leading-relaxed">{dialogue.text}</span>
                </div>
            );
        }

        let svgContent;
        let textClass = "relative z-10 text-sm md:text-base text-center leading-snug";
        let containerClass = `absolute z-10 max-w-[65%] flex items-center justify-center p-6 md:p-8 ${positionClass}`;
        
        if (dialogue.type === 'shout') {
            svgContent = (
                <svg viewBox="0 0 200 140" className="absolute inset-0 w-full h-full drop-shadow-lg" preserveAspectRatio="none">
                  <path d="M10,70 L20,50 L10,30 L40,40 L50,10 L70,40 L100,10 L130,40 L150,10 L160,40 L190,30 L180,50 L190,70 L180,90 L190,110 L160,100 L150,130 L130,100 L100,130 L70,100 L50,130 L40,100 L10,110 L20,90 Z" fill="white" stroke="black" strokeWidth="3" />
                </svg>
            );
            textClass += " font-black text-lg md:text-xl font-comic tracking-tighter uppercase";
        } else if (dialogue.type === 'thought') {
            svgContent = (
                <svg viewBox="0 0 200 140" className="absolute inset-0 w-full h-full drop-shadow-md opacity-95" preserveAspectRatio="none">
                  <path d="M30,70 Q10,50 30,30 Q50,10 80,20 Q110,0 140,20 Q180,10 180,50 Q200,80 170,100 Q180,130 140,120 Q110,140 80,120 Q40,140 30,100 Q0,90 30,70 Z M40,145 A5,5 0 1,1 50,155 A5,5 0 1,1 40,145 M25,160 A3,3 0 1,1 30,165 A3,3 0 1,1 25,160" fill="white" stroke="black" strokeWidth="2" />
                </svg>
            );
            textClass += " text-slate-800 font-comic italic";
        } else {
             // standard speech
             svgContent = (
                <svg viewBox="0 0 200 120" className="absolute inset-0 w-full h-full drop-shadow-md" preserveAspectRatio="none">
                    <ellipse cx="100" cy="60" rx="95" ry="55" fill="white" stroke="black" strokeWidth="2.5" />
                </svg>
             );
             textClass += " font-comic text-black";
        }

        return (
            <div key={index} className={containerClass}>
                 {svgContent}
                 <span className={textClass}>{dialogue.text}</span>
            </div>
        );
    });
  };

  return (
    <div className={`relative w-full h-full bg-white border-[3px] border-black group ${aspectRatioClass} shadow-sm overflow-hidden transition-transform`}>
      
      {/* Image Area */}
      {panel.status === 'completed' && panel.imageUrl ? (
         <div className="w-full h-full relative animate-fade-in">
             <img 
                src={panel.imageUrl} 
                alt={`Panel ${panel.id}`} 
                className="w-full h-full object-cover"
                style={{ 
                    filter: styleMode === 'bw' 
                        ? 'grayscale(100%) contrast(1.15) brightness(1.05)' 
                        : 'none' 
                }}
             />
         </div>
      ) : panel.status === 'generating' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-black p-4 text-center">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
              <span className="text-sm font-bold text-slate-500 animate-pulse">그리는 중...</span>
          </div>
      ) : panel.status === 'failed' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 text-red-500 p-4">
              <AlertCircle className="w-8 h-8 mb-2 opacity-80" />
              <span className="text-xs font-medium mb-2">생성 실패</span>
              <button 
                onClick={() => onRegenerate(panel)}
                className="px-3 py-1 bg-white border border-red-200 rounded-full text-xs shadow-sm hover:bg-red-50 transition-colors"
              >
                다시 시도
              </button>
          </div>
      ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Pending</span>
          </div>
      )}

      {/* Bubbles */}
      {panel.status === 'completed' && renderBubbles()}

      {/* Hover Actions */}
      {panel.status === 'completed' && (
          <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <button 
                onClick={() => onRegenerate(panel)}
                className="bg-white/90 backdrop-blur text-slate-800 p-2 rounded-full shadow-lg border border-slate-200 hover:scale-110 transition-transform hover:text-indigo-600"
                title="다시 그리기"
            >
                <RefreshCw className="w-4 h-4" />
            </button>
          </div>
      )}
    </div>
  );
};

export default ComicPanel;