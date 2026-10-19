export default function BrandMark({ className = "" }: { className?: string }) {
  return (
    <img
      className={`brand-mark-image${className ? ` ${className}` : ""}`}
      src="/brand/atelier-care-mark.png"
      alt=""
      aria-hidden="true"
      decoding="async"
    />
  );
}
