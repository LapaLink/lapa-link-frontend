import { Alert, AlertDescription } from "@/components/ui"

export function FormAlert({ message }: { message?: string }) {
  return message ? (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  ) : null
}
