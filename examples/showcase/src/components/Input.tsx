interface InputProps {
  label: string;
  placeholder?: string;
  type?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function Input({ label, placeholder, type = 'text', onChange }: InputProps) {
  return (
    <div className="flui-input-group">
      <label className="flui-input-label">{label}</label>
      <input
        className="flui-input"
        type={type}
        placeholder={placeholder}
        onChange={onChange}
      />
    </div>
  );
}
