import Image from "next/image"
import { NavigationLink as Link } from "@/components/providers"
import { ROUTES } from "@/lib/constants"

export function Brand() {
  return (
    <Link
      href={ROUTES.HOME}
      aria-label="LapaLink — на главную"
      className="flex shrink-0 items-center gap-2 sm:gap-2.5"
    >
      <span
        aria-hidden="true"
        className="relative block size-10 overflow-hidden sm:size-12"
      >
        <Image
          src="/lapalink-logo.png"
          alt=""
          width={1254}
          height={1254}
          priority
          className="absolute left-1/2 -top-3.5 w-20 max-w-none -translate-x-1/2 sm:-top-4 sm:w-24"
        />
      </span>
      <span className="hidden text-2xl font-extrabold tracking-tight sm:inline">
        Lapa<span className="text-primary">Link</span>
      </span>
    </Link>
  )
}
