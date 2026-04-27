interface FormFieldProps {
  label: string;
  type?: "text" | "number" | "select" | "textarea";
  value: string | number;
  onChange: (value: string) => void;
  options?: { value: string; label: string }[];
  error?: string;
  placeholder?: string;
}

export function FormField({ label, type = "text", value, onChange, options, error, placeholder }: FormFieldProps) {
  const baseClass = "w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:border-primary focus:outline-none";
  return (
    <div className="mb-3">
      <label className="block text-sm text-text-secondary mb-1">{label}</label>
      {type === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={baseClass}>
          {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className={`${baseClass} min-h-[80px] resize-y`} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className={baseClass} />
      )}
      {error && <p className="text-error-text text-xs mt-1">{error}</p>}
    </div>
  );
}
