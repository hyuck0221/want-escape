interface Props {
  value?: number;
  /** Default slot count. If value exceeds this, we render value slots instead. */
  max?: number;
  /** Render nothing when value is nullish. Default: true */
  hideIfEmpty?: boolean;
}

export default function Dots({ value, max = 3, hideIfEmpty = true }: Props) {
  if (value == null) return hideIfEmpty ? null : <span className="dots" aria-hidden />;
  const total = Math.max(max, value);
  const over = value > max;
  return (
    <span
      className="dots"
      data-over={over ? 'true' : undefined}
      aria-label={`${value} / ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} data-on={i < value} />
      ))}
    </span>
  );
}
