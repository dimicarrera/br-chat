interface Props {
  onClick: () => void;
  disabled: boolean;
  atLimit: boolean;
}

export default function EndButton({ onClick, disabled, atLimit }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-xl text-sm font-medium transition-all disabled:opacity-50 px-4 py-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1117] ${
        atLimit
          ? 'bg-[linear-gradient(135deg,#6366F1,#4F46E5)] text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]'
          : 'bg-[rgba(99,102,241,0.1)] text-[#818CF8] border border-[rgba(99,102,241,0.2)]'
      }`}
    >
      {disabled
        ? 'Generating report…'
        : atLimit
        ? 'View wellbeing report →'
        : 'End check-in & view report'}
    </button>
  );
}
