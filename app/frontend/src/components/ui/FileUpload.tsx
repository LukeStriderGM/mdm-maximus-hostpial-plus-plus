import { useState, useCallback } from "react";
import { UploadCloud } from "lucide-react";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
}

export function FileUpload({ onFileSelect, accept = ".csv,.xlsx,.xls" }: FileUploadProps) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-border-med"
      }`}
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = accept;
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) onFileSelect(file);
        };
        input.click();
      }}
    >
      <UploadCloud size={32} className="mx-auto mb-3 text-text-disabled" />
      <p className="text-sm text-text-secondary">Drop CSV or Excel files here</p>
      <p className="text-xs text-text-disabled mt-1">{accept}</p>
    </div>
  );
}
