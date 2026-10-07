"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { casesApi } from "@/api"
import { setFormError } from "@/lib/forms"
import { invalidateCaseData } from "@/lib/queryKeys"
import type { CaseDetails } from "@/types"
import {
  editCaseSchema,
  getEditCaseValues,
  toUpdateCaseDto,
  type EditCaseValues,
} from "../schemas"

export function useEditCase(item: CaseDetails) {
  const client = useQueryClient()
  const form = useForm<EditCaseValues>({
    resolver: zodResolver(editCaseSchema),
    defaultValues: getEditCaseValues(item),
  })
  const save = useMutation({
    mutationFn: (values: EditCaseValues) =>
      casesApi.update(item.id, toUpdateCaseDto(values, item)),
    onSuccess: async (_updated, values) => {
      form.reset(values)
      await invalidateCaseData(client, item.id)
    },
    onError: (error) => setFormError(form, error),
  })
  return { form, save }
}
