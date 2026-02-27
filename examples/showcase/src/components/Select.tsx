interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  options: SelectOption[];
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

export function Select({ label, options, onChange }: SelectProps) {
  return (
    <div className="flui-input-group">
      <label className="flui-input-label">{label}</label>
      <select className="flui-select" onChange={onChange}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
