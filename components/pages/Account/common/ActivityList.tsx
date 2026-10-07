"use client"

import Link from "next/link"
import { useCities, useDictionaryLocale, useNeedTypes } from "@/hooks"
import { getCityName, getDictionaryName } from "@/lib/dictionaries"
import { ROUTES } from "@/lib/constants"
import { filterValidTaskRecords } from "@/lib/tasks"
import { CasePhoto, FormAlert, ListPagination } from "@/components/common"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
  Skeleton,
} from "@/components/ui"
import type { MyHelpApplication, MyAssignment } from "@/types"
import {
  responseStatusLabels,
  assignmentStatusLabels,
} from "../../Cases/statusLabels"

type ActivityProps = {
  title: string
  status: string
  options: Array<{ value: string; label: string }>
  onStatusChange: (status: string) => void
  items: Array<MyHelpApplication | MyAssignment>
  loading: boolean
  error?: Error | null
  page: number
  totalPages: number
  busy: boolean
  onPageChange: (page: number) => void
  empty: string
}

export function ActivityList({
  title,
  status,
  options,
  onStatusChange,
  items,
  loading,
  error,
  page,
  totalPages,
  busy,
  onPageChange,
  empty,
}: ActivityProps) {
  const cities = useCities()
  const needTypes = useNeedTypes()
  const locale = useDictionaryLocale()
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger
            aria-label={`Фильтр: ${title}`}
            className="w-full sm:w-44"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      {loading ? (
        <div
          role="status"
          aria-label={`Загружаем: ${title}`}
          className="flex flex-col gap-3"
        >
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <FormAlert message={error.message} />
      ) : !items.length ? (
        <Card>
          <CardHeader>
            <CardDescription>{empty}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filterValidTaskRecords(items).map((item) => (
            <Link
              key={item.id}
              href={ROUTES.CASE_DETAILS(item.animalCase.id)}
              className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <Card className="min-w-0 transition-shadow hover:shadow-md">
                <CardContent className="flex gap-4">
                  <div className="w-20 shrink-0 self-start overflow-hidden rounded-lg sm:w-24">
                    <CasePhoto
                      src={item.animalCase.photoUrl}
                      alt={item.animalCase.title}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <CardTitle className="line-clamp-2 [overflow-wrap:anywhere]">
                      {item.animalCase.title}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {item.animalCase.animalType === "CAT"
                        ? "Кошка"
                        : "Собака"}{" "}
                      ·{" "}
                      {getCityName(
                        cities.data,
                        item.animalCase.cityCode,
                        locale,
                      ) || "Город не указан"}
                    </p>
                    <p className="text-sm">
                      {getDictionaryName(
                        needTypes.data,
                        item.need.type,
                        locale,
                      )}
                    </p>
                    <p className="text-xs font-medium text-primary">
                      {"message" in item
                        ? responseStatusLabels[
                            item.status as MyHelpApplication["status"]
                          ]
                        : assignmentStatusLabels[
                            item.status as MyAssignment["status"]
                          ]}
                    </p>
                    {"message" in item && item.message && (
                      <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground [overflow-wrap:anywhere]">
                        {item.message}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <ListPagination
        page={page}
        totalPages={totalPages}
        busy={busy}
        onPageChange={onPageChange}
      />
    </section>
  )
}
