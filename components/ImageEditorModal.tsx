'use client';

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  X,
  Pencil,
  Square,
  Circle,
  Minus,
  Type,
  Undo2,
  Trash2,
  Check,
  ArrowUpRight,
  Highlighter,
  Minus as LineIcon,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = 'pen' | 'rect' | 'ellipse' | 'arrow' | 'line' | 'text' | 'highlight';

interface Point {
  x: number;
  y: number;
}

interface DrawAction {
  tool: Tool;
  color: string;
  lineWidth: number;
  points?: Point[];
  startPoint?: Point;
  endPoint?: Point;
  text?: string;
  textPoint?: Point;
  opacity?: number;
}

interface Props {
  /** File ảnh gốc cần edit */
  file: File;
  /** Callback khi xác nhận → trả về File PNG đã edit */
  onConfirm: (editedFile: File) => void;
  /** Callback khi hủy */
  onCancel: () => void;
}

// ─── Palette màu nhanh ─────────────────────────────────────────────────────

const QUICK_COLORS = [
  '#ef4444', // đỏ
  '#f97316', // cam
  '#eab308', // vàng
  '#22c55e', // xanh lá
  '#3b82f6', // xanh dương
  '#8b5cf6', // tím
  '#ec4899', // hồng
  '#ffffff', // trắng
  '#1e293b', // đen
];

const BRUSH_SIZES = [2, 4, 8, 14];

// ─── Component ────────────────────────────────────────────────────────────────

export function ImageEditorModal({ file, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null); // live preview layer
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeTool, setActiveTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(3);
  const [customColor, setCustomColor] = useState('#ef4444');

  const [actions, setActions] = useState<DrawAction[]>([]);
  const [snapshots, setSnapshots] = useState<ImageData[]>([]); // for undo

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

  // Text tool
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState<Point | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);

  // Image loaded dims
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });

  // ─── Load ảnh gốc lên canvas ─────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!canvas || !overlay) return;

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const origW = img.naturalWidth;
      const origH = img.naturalHeight;

      // Canvas resolution = độ phân giải GỐC của ảnh (không giảm)
      canvas.width = origW;
      canvas.height = origH;
      overlay.width = origW;
      overlay.height = origH;

      // Tính kích thước HIỂN THỊ (CSS) để vừa màn hình
      const MAX_W = Math.min(window.innerWidth * 0.82, 1200);
      const MAX_H = Math.min(window.innerHeight * 0.70, 820);

      let displayW = origW;
      let displayH = origH;
      if (displayW > MAX_W) {
        displayH = Math.round((displayH * MAX_W) / displayW);
        displayW = Math.round(MAX_W);
      }
      if (displayH > MAX_H) {
        displayW = Math.round((displayW * MAX_H) / displayH);
        displayH = Math.round(MAX_H);
      }

      // CSS: thu nhỏ để vừa màn hình, nhưng canvas buffer vẫn là full res
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;
      overlay.style.width = `${displayW}px`;
      overlay.style.height = `${displayH}px`;

      setImgDims({ w: origW, h: origH });

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, origW, origH);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [file]);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const getPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setSnapshots((prev) => [...prev, snap]);
  }, []);

  const drawActionToCtx = (ctx: CanvasRenderingContext2D, action: DrawAction) => {
    ctx.save();
    ctx.strokeStyle = action.color;
    ctx.fillStyle = action.color;
    ctx.lineWidth = action.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (action.tool) {
      case 'pen': {
        if (!action.points || action.points.length < 2) break;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(action.points[0].x, action.points[0].y);
        for (let i = 1; i < action.points.length; i++) {
          ctx.lineTo(action.points[i].x, action.points[i].y);
        }
        ctx.stroke();
        break;
      }
      case 'highlight': {
        if (!action.points || action.points.length < 2) break;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = action.lineWidth * 6;
        ctx.beginPath();
        ctx.moveTo(action.points[0].x, action.points[0].y);
        for (let i = 1; i < action.points.length; i++) {
          ctx.lineTo(action.points[i].x, action.points[i].y);
        }
        ctx.stroke();
        break;
      }
      case 'rect': {
        if (!action.startPoint || !action.endPoint) break;
        const { x: sx, y: sy } = action.startPoint;
        const { x: ex, y: ey } = action.endPoint;
        ctx.globalAlpha = 1;
        ctx.strokeRect(sx, sy, ex - sx, ey - sy);
        break;
      }
      case 'ellipse': {
        if (!action.startPoint || !action.endPoint) break;
        const { x: sx, y: sy } = action.startPoint;
        const { x: ex, y: ey } = action.endPoint;
        const rx = Math.abs(ex - sx) / 2;
        const ry = Math.abs(ey - sy) / 2;
        const cx = sx + (ex - sx) / 2;
        const cy = sy + (ey - sy) / 2;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'arrow': {
        if (!action.startPoint || !action.endPoint) break;
        const { x: sx, y: sy } = action.startPoint;
        const { x: ex, y: ey } = action.endPoint;
        ctx.globalAlpha = 1;
        const angle = Math.atan2(ey - sy, ex - sx);
        const headLen = Math.max(12, action.lineWidth * 4);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        // arrowhead
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'line': {
        if (!action.startPoint || !action.endPoint) break;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(action.startPoint.x, action.startPoint.y);
        ctx.lineTo(action.endPoint.x, action.endPoint.y);
        ctx.stroke();
        break;
      }
      case 'text': {
        if (!action.text || !action.textPoint) break;
        ctx.globalAlpha = 1;
        ctx.font = `bold ${Math.max(14, action.lineWidth * 5)}px Inter, sans-serif`;
        ctx.fillStyle = action.color;
        // Text shadow for readability
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 3;
        ctx.fillText(action.text, action.textPoint.x, action.textPoint.y);
        ctx.shadowBlur = 0;
        break;
      }
    }
    ctx.restore();
  };

  // ─── Live preview on overlay canvas ──────────────────────────────────────

  const drawPreview = useCallback(
    (currentEnd: Point) => {
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext('2d')!;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      if (!startPoint) return;

      const previewAction: DrawAction = {
        tool: activeTool,
        color,
        lineWidth: brushSize,
        startPoint,
        endPoint: currentEnd,
        points: currentPoints,
      };
      drawActionToCtx(ctx, previewAction);
    },
    [activeTool, color, brushSize, startPoint, currentPoints]
  );

  // ─── Mouse / Touch Events ─────────────────────────────────────────────────

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTool === 'text') return; // text handled by click
    e.preventDefault();
    const pos = getPos(e);
    saveSnapshot();
    setIsDrawing(true);
    setStartPoint(pos);
    setCurrentPoints([pos]);

    if (activeTool === 'pen' || activeTool === 'highlight') {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = activeTool === 'highlight' ? brushSize * 6 : brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (activeTool === 'highlight') ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.restore();
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);

    if (activeTool === 'pen' || activeTool === 'highlight') {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = activeTool === 'highlight' ? brushSize * 6 : brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (activeTool === 'highlight') ctx.globalAlpha = 0.35;
      const prev = currentPoints[currentPoints.length - 1] || pos;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.restore();
      setCurrentPoints((prev) => [...prev, pos]);
    } else {
      // Shape tools: draw preview on overlay
      drawPreview(pos);
    }
  };

  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    setIsDrawing(false);

    const canvas = canvasRef.current!;
    const overlay = overlayCanvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    if (activeTool === 'pen' || activeTool === 'highlight') {
      const action: DrawAction = {
        tool: activeTool,
        color,
        lineWidth: brushSize,
        points: [...currentPoints, pos],
      };
      setActions((prev) => [...prev, action]);
    } else if (startPoint) {
      const action: DrawAction = {
        tool: activeTool,
        color,
        lineWidth: brushSize,
        startPoint,
        endPoint: pos,
      };
      drawActionToCtx(ctx, action);
      setActions((prev) => [...prev, action]);
      // Clear overlay
      const oCtx = overlay.getContext('2d')!;
      oCtx.clearRect(0, 0, overlay.width, overlay.height);
    }

    setStartPoint(null);
    setCurrentPoints([]);
  };

  // ─── Text Tool ────────────────────────────────────────────────────────────

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (activeTool !== 'text') return;
    const pos = getPos(e);
    setTextPosition(pos);
    setShowTextInput(true);
    setTextInput('');
  };

  const commitText = () => {
    if (!textInput.trim() || !textPosition) {
      setShowTextInput(false);
      return;
    }
    saveSnapshot();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const action: DrawAction = {
      tool: 'text',
      color,
      lineWidth: brushSize,
      text: textInput.trim(),
      textPoint: textPosition,
    };
    drawActionToCtx(ctx, action);
    setActions((prev) => [...prev, action]);
    setShowTextInput(false);
    setTextInput('');
    setTextPosition(null);
  };

  // ─── Undo ─────────────────────────────────────────────────────────────────

  const handleUndo = () => {
    if (snapshots.length === 0) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const prev = snapshots[snapshots.length - 1];
    ctx.putImageData(prev, 0, 0);
    setSnapshots((s) => s.slice(0, -1));
    setActions((a) => a.slice(0, -1));
  };

  // ─── Clear ────────────────────────────────────────────────────────────────

  const handleClear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    // Reload original image
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      setActions([]);
      setSnapshots([]);
    };
    img.src = url;
  };

  // ─── Confirm: export canvas → File ───────────────────────────────────────

  const handleConfirm = () => {
    const canvas = canvasRef.current!;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const originalName = file.name.replace(/\.[^.]+$/, '');
        const editedFile = new File([blob], `${originalName}_edited.png`, {
          type: 'image/png',
        });
        onConfirm(editedFile);
      },
      'image/png',
      0.95
    );
  };

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') handleUndo();
      if (e.key === 'Enter' && showTextInput) commitText();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showTextInput, textInput, snapshots]);

  // ─── Toolbar config ───────────────────────────────────────────────────────

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'pen', icon: <Pencil className="w-4 h-4" />, label: 'Bút vẽ' },
    { id: 'highlight', icon: <Highlighter className="w-4 h-4" />, label: 'Highlight' },
    { id: 'rect', icon: <Square className="w-4 h-4" />, label: 'Hình chữ nhật' },
    { id: 'ellipse', icon: <Circle className="w-4 h-4" />, label: 'Hình tròn' },
    { id: 'arrow', icon: <ArrowUpRight className="w-4 h-4" />, label: 'Mũi tên' },
    { id: 'line', icon: <LineIcon className="w-4 h-4" />, label: 'Đường thẳng' },
    { id: 'text', icon: <Type className="w-4 h-4" />, label: 'Văn bản' },
  ];

  // ─── Cursor ───────────────────────────────────────────────────────────────

  const cursorStyle =
    activeTool === 'text' ? 'text' : activeTool === 'pen' || activeTool === 'highlight' ? 'crosshair' : 'crosshair';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div
        className="flex flex-col bg-[#1a1a2e] rounded-2xl shadow-2xl overflow-hidden border border-white/10"
        style={{ maxWidth: '95vw', maxHeight: '96vh' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#16213e]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Pencil className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-none">Chỉnh sửa ảnh</h2>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-none">
                Vẽ chú thích, đánh dấu lỗi trước khi gửi
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Hủy (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body: Toolbar + Canvas ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* LEFT TOOLBAR */}
          <div className="flex flex-col gap-1 p-2.5 border-r border-white/10 bg-[#16213e] overflow-y-auto min-w-[52px]">
            {/* Tools */}
            <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider px-1 mb-0.5">Công cụ</p>
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => { setActiveTool(t.id); setShowTextInput(false); }}
                title={t.label}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  activeTool === t.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {t.icon}
              </button>
            ))}

            <div className="my-1 border-t border-white/10" />

            {/* Brush size */}
            <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider px-1 mb-0.5">Cỡ</p>
            {BRUSH_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setBrushSize(s)}
                title={`${s}px`}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  brushSize === s
                    ? 'bg-white/20 text-white ring-1 ring-white/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <span
                  className="rounded-full bg-current"
                  style={{ width: Math.min(s * 2.5, 20), height: Math.min(s * 2.5, 20) }}
                />
              </button>
            ))}

            <div className="my-1 border-t border-white/10" />

            {/* Quick colors */}
            <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider px-1 mb-0.5">Màu</p>
            <div className="flex flex-col gap-1">
              {QUICK_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setCustomColor(c); }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-[#16213e] scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>

            {/* Custom color picker */}
            <label
              className="w-9 h-9 rounded-xl overflow-hidden cursor-pointer border-2 border-dashed border-white/20 hover:border-white/40 transition-colors relative"
              title="Chọn màu tùy chỉnh"
            >
              <input
                type="color"
                value={customColor}
                onChange={(e) => { setCustomColor(e.target.value); setColor(e.target.value); }}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
              <div
                className="w-full h-full rounded-xl"
                style={{ backgroundColor: customColor }}
              />
            </label>

            <div className="my-1 border-t border-white/10" />

            {/* Undo & Clear */}
            <button
              onClick={handleUndo}
              disabled={snapshots.length === 0}
              title="Hoàn tác (Ctrl+Z)"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-amber-400 hover:bg-amber-900/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleClear}
              title="Xóa tất cả"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-900/20 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* CANVAS AREA */}
          <div
            ref={containerRef}
            className="flex-1 overflow-auto bg-[#0f0f23] flex items-center justify-center p-4 min-w-0"
          >
            <div className="relative inline-block shadow-2xl rounded-lg overflow-hidden" style={{ lineHeight: 0 }}>
              {/* Base canvas (where we draw permanently) */}
              <canvas
                ref={canvasRef}
                style={{ cursor: cursorStyle, display: 'block', maxWidth: '100%', maxHeight: '100%' }}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
                onClick={handleCanvasClick}
              />
              {/* Overlay canvas (live shape preview) */}
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 pointer-events-none"
                style={{ display: 'block' }}
              />

              {/* Text input overlay */}
              {showTextInput && textPosition && (
                <div
                  className="absolute flex gap-1.5 items-center"
                  style={{
                    left: `${(textPosition.x / (canvasRef.current?.width || 1)) * 100}%`,
                    top: `${(textPosition.y / (canvasRef.current?.height || 1)) * 100}%`,
                    transform: 'translate(0, -50%)',
                  }}
                >
                  <input
                    autoFocus
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitText();
                      if (e.key === 'Escape') { setShowTextInput(false); setTextPosition(null); }
                    }}
                    placeholder="Nhập chú thích..."
                    className="px-2.5 py-1.5 text-sm rounded-lg bg-[#1a1a2e]/95 border border-indigo-500 text-white placeholder:text-slate-400 outline-none shadow-xl min-w-[160px]"
                    style={{ color }}
                  />
                  <button
                    onClick={commitText}
                    className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { setShowTextInput(false); setTextPosition(null); }}
                    className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-[#16213e]">
          <p className="text-xs text-slate-500">
            {activeTool === 'text'
              ? '💬 Nhấp vào ảnh để thêm chú thích văn bản'
              : activeTool === 'pen' || activeTool === 'highlight'
              ? '✏️ Kéo chuột để vẽ'
              : '🔲 Kéo chuột để vẽ hình'}
            {' '}· <span className="text-slate-600">Ctrl+Z: Hoàn tác</span>
          </p>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 border border-white/10 transition-all"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirm}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-900/50 transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Xác nhận & Gửi ảnh này
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
