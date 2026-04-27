import { useState } from "react";
import { Panel } from "../components/ui/Panel";
import { FileUpload } from "../components/ui/FileUpload";
import { StatCard } from "../components/ui/StatCard";
import { Spinner } from "../components/ui/Spinner";
import { AlertBanner } from "../components/ui/AlertBanner";
import { uploadFile, type IngestionResult } from "../lib/api";

export function Upload() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const res = await uploadFile(file);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-lg font-semibold">Data Upload</h2>
      <p className="text-sm text-text-secondary">
        Upload DHA medical supply inventory data (CSV or Excel). The system will automatically
        create hubs, spokes, and inventory items from the MTF data.
      </p>

      <Panel title="Upload File">
        {uploading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner size={32} />
            <p className="text-sm text-text-secondary">Processing {fileName}...</p>
          </div>
        ) : (
          <FileUpload onFileSelect={handleFile} />
        )}
      </Panel>

      {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}

      {result && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Rows Processed" value={result.rows_processed} status="default" />
            <StatCard label="Hubs Created" value={result.hubs_created} status="success" />
            <StatCard label="Spokes Created" value={result.spokes_created} status="success" />
            <StatCard label="Items Created" value={result.items_created} status="success" />
          </div>
          {result.errors.length > 0 && (
            <Panel title="Errors">
              <ul className="text-sm text-error-text space-y-1">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
