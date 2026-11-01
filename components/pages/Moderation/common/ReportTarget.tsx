import type { ModerationTarget } from "@/types"
import { caseStatusLabel } from "@/lib/cases"
import { userStatusLabels } from "@/lib/moderation"

export function ReportTarget({ target }: { target: ModerationTarget }) {
  return (
    <section
      className="flex min-w-0 flex-col gap-3 rounded-xl border p-4 text-sm [overflow-wrap:anywhere]"
      aria-label="Объект жалобы"
    >
      {target.type === "CASE" ? (
        <>
          <h3 className="font-bold">{target.title}</h3>
          <p>Статус: {caseStatusLabel(target.status)}</p>
          <p className="whitespace-pre-wrap">{target.description}</p>
          <p className="text-muted-foreground">Автор: {target.authorId}</p>
        </>
      ) : target.type === "USER" ? (
        <>
          <h3 className="font-bold">{target.displayName || "Пользователь"}</h3>
          <p>Статус: {userStatusLabels[target.status] ?? target.status}</p>
          <p className="text-muted-foreground">ID: {target.userId}</p>
        </>
      ) : (
        <>
          <h3 className="font-bold">{target.chatTitle || "Переписка"}</h3>
          <p className="text-muted-foreground">
            Снимок сообщений на момент подачи жалобы. После срока хранения он
            может быть недоступен.
          </p>
          <p className="text-muted-foreground">
            Участники: {target.participantIds.join(", ") || "Данные недоступны"}
          </p>
          {target.messages.length ? (
            <ol className="flex flex-col gap-3">
              {target.messages.map((message) => (
                <li
                  key={message.messageId}
                  className="flex flex-col gap-1 rounded-lg bg-muted p-3"
                >
                  <span className="text-xs text-muted-foreground">
                    {message.senderId}
                  </span>
                  <p className="whitespace-pre-wrap">
                    {message.deletedAt
                      ? "Сообщение удалено до подачи жалобы"
                      : message.text}
                  </p>
                  <time
                    dateTime={message.createdAt}
                    className="text-xs text-muted-foreground"
                  >
                    {new Date(message.createdAt).toLocaleString("ru")}
                    {message.editedAt ? " · изменено" : ""}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p>Сохранённых сообщений нет.</p>
          )}
        </>
      )}
    </section>
  )
}
