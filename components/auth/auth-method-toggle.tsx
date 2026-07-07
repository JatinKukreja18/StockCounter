export type AuthMethod = "phone" | "email";

export function AuthMethodToggle({
  value,
  onChange,
  label = "Sign-in method"
}: {
  value: AuthMethod;
  onChange: (method: AuthMethod) => void;
  label?: string;
}) {
  return (
    <div className="grid grid-cols-2 rounded-xl bg-[#eef2ef] p-1" aria-label={label}>
      {(["phone", "email"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`h-10 rounded-lg text-sm font-bold transition ${
            value === option ? "bg-white text-[#18794e] shadow-sm" : "text-[#68726c]"
          }`}
          aria-pressed={value === option}
        >
          {option === "phone" ? "Phone + PIN" : "Email + password"}
        </button>
      ))}
    </div>
  );
}
