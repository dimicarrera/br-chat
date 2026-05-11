interface Props {
  onClick: () => void;
  disabled: boolean;
}

export default function EndButton({ onClick, disabled }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-40 transition-colors border border-zinc-200 rounded-lg px-3 py-1.5 hover:border-zinc-400"
    >
      {disabled ? 'Ending…' : 'End conversation'}
    </button>
  );
}
