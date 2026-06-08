type BadgeVariant = "blue" | "slate" | "green" | "amber" | "red";

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
};

const variants: Record<BadgeVariant, string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-green-50 text-green-700 ring-green-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  red: "bg-red-50 text-red-700 ring-red-100",
};

export default function Badge({ children, variant = "slate" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${variants[variant]}`}
    >
      {children}
    </span>
  );
}