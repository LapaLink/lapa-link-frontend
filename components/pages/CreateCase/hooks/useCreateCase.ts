"use client"

import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ApiError, casesApi } from "@/api"
import { getSessionRevision, readTokens } from "@/lib/auth"
import { setFormError } from "@/lib/forms"
import { dictionaryQueries } from "@/hooks"
import type { AnimalCase } from "@/types"
import {
  createCaseSchema,
  toCreateCaseDto,
  type CreateCaseValues,
} from "../schemas"

export function useCreateCase() {
  const client = useQueryClient()
  const form = useForm<CreateCaseValues>({
    resolver: zodResolver(createCaseSchema),
    defaultValues: {
      title: "",
      cityCode: "",
      latitude: "",
      longitude: "",
      description: "",
      sex: "UNKNOWN",
      approximateAge: "",
      condition: "",
      needTypes: [],
    },
  })
  const [created, setCreated] = useState<AnimalCase | null>(null)
  const savedCase = useRef<AnimalCase | null>(null)
  const [pendingTypes, setPendingTypes] = useState<string[]>([])
  const [publicationError, setPublicationError] = useState("")
  const [finished, setFinished] = useState(false)
  const [revision, setRevision] = useState<number | null>(null)
  const publishing = useMutation({
    gcTime: 0,
    mutationFn: async (values: CreateCaseValues | null) => {
      const currentRevision = getSessionRevision()
      const ensureSession = () => {
        if (!readTokens() || currentRevision !== getSessionRevision())
          throw new ApiError("Сессия изменилась. Войдите заново.", 401)
      }
      let animalCase = created
      let types = pendingTypes
      if (!animalCase) {
        if (!values) return
        animalCase = await casesApi.create(
          toCreateCaseDto(values),
          values.photo,
        )
        ensureSession()
        savedCase.current = animalCase
        setCreated(animalCase)
        setRevision(currentRevision)
        types = values.needTypes
        setPendingTypes(types)
        client.setQueryData(["cases", "detail", animalCase.id], animalCase)
        form.reset()
      } else {
        if (revision !== currentRevision)
          throw new ApiError("Сессия изменилась. Войдите заново.", 401)
        // Reconcile a response lost in transit before retrying a need.
        const existing = await casesApi.getNeeds(animalCase.id)
        ensureSession()
        types = types.filter(
          (type) => !existing.some((need) => need.type === type),
        )
        setPendingTypes(types)
      }
      try {
        for (const type of types) {
          ensureSession()
          await casesApi.addNeed(animalCase.id, type)
          ensureSession()
          setPendingTypes((current) => current.filter((item) => item !== type))
        }
        setFinished(true)
      } catch (error) {
        if (error instanceof ApiError && error.code === "UNKNOWN_NEED_TYPE")
          void client.invalidateQueries({
            queryKey: dictionaryQueries.needTypes().queryKey,
          })
        throw error
      } finally {
        void client.invalidateQueries({ queryKey: ["cases", "list"] })
      }
    },
  })

  async function submit(values: CreateCaseValues | null) {
    if (publishing.isPending) return
    setPublicationError("")
    form.clearErrors()
    try {
      await publishing.mutateAsync(values)
    } catch (error) {
      if (savedCase.current) {
        setPublicationError(
          error instanceof Error
            ? error.message
            : "Не удалось добавить помощь. Попробуйте ещё раз.",
        )
      } else {
        if (error instanceof ApiError && error.code === "UNKNOWN_CITY") {
          form.setError("cityCode", { message: error.message })
          void client.invalidateQueries({
            queryKey: dictionaryQueries.cities().queryKey,
          })
        } else setFormError(form, error)
      }
    } finally {
      publishing.reset()
    }
  }

  function startAgain() {
    savedCase.current = null
    setCreated(null)
    setPendingTypes([])
    setPublicationError("")
    setFinished(false)
    setRevision(null)
    form.reset()
  }

  function skipType(type: string) {
    if (publishing.isPending) return
    const remaining = pendingTypes.filter((code) => code !== type)
    setPendingTypes(remaining)
    setPublicationError("")
    if (remaining.length === 0) setFinished(true)
  }

  return {
    form,
    created,
    pendingTypes,
    publicationError,
    finished,
    busy: publishing.isPending || form.formState.isSubmitting,
    submit,
    startAgain,
    skipType,
  }
}
