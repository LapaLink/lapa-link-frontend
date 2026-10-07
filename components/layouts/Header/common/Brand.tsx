import Image from "next/image"
import Link from "next/link"
import { ROUTES } from "@/lib/constants"

export function Brand() {
  return (
    <Link
      href={ROUTES.HOME}
      aria-label="LapaLink — на главную"
      className="flex shrink-0 items-center gap-2.5"
    >
      <span
        aria-hidden="true"
        className="relative block size-12 overflow-hidden"
      >
        <Image
          src="/lapalink-logo.png"
          alt=""
          width={1254}
          height={1254}
          priority
          className="absolute left-1/2 -top-4 w-24 max-w-none -translate-x-1/2"
        />
      </span>
      <span className="text-2xl font-extrabold tracking-tight">
        Lapa<span className="text-primary">Link</span>
      </span>
    </Link>
  )
}
