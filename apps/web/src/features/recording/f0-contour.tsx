export function F0Contour({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = Math.max(1, maximum - minimum);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 120;
      const y = 90 - ((value - minimum) / range) * 80;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg aria-label="F0 궤적" className="f0-contour" preserveAspectRatio="none" role="img" viewBox="0 0 120 100">
      <polyline fill="none" points={points} />
    </svg>
  );
}
