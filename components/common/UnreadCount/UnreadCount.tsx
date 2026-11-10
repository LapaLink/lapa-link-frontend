export function UnreadCount({ count }: { count: number }) {
  if (count <= 0) return null

  return (
    <span
      aria-hidden="true"
      className="absolute -top-1.5 -right-2 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-bold text-primary-foreground"
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}
