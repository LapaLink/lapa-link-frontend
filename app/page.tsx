import { Button } from "@/components/ui"

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50">
      <main className="p-4 flex flex-col items-center gap-4">
        <h1 className="font-bold text-3xl">Lapa Link</h1>
        <Button>Test button</Button>
      </main>
    </div>
  )
}
