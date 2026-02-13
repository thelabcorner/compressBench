import { Upload } from 'lucide-react';
import { cn } from '@/lib/cn';

interface UploadZoneProps {
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onFileSelect: (f: File) => void;
}

export function UploadZone({ isDragging, fileInputRef, onDrop, onDragOver, onDragLeave, onFileSelect }: UploadZoneProps) {
  return (
    <div
      onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
      onClick={() => fileInputRef.current?.click()}
      className={cn(
        "relative cursor-pointer rounded-xl border-2 border-dashed p-12 sm:p-16 transition-all duration-200 group",
        isDragging
          ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800"
          : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      )}
    >
      <input ref={fileInputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }} />
      <div className="flex flex-col items-center gap-4">
        <div className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
          isDragging
            ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
        )}>
          <Upload className="w-8 h-8" />
        </div>
        <div className="text-center">
          <p className="text-base font-medium text-zinc-700 dark:text-zinc-300">
            {isDragging ? 'Drop your file here' : 'Drop a file here or click to browse'}
          </p>
          <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">Any file type · No size limit · 100% local processing</p>
        </div>
      </div>
    </div>
  );
}
