"use client"

import type { ComponentProps } from "react"
import {
  FormProvider,
  type FieldValues,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form"
import { cn } from "cn"

type FormProps<T extends FieldValues> = Omit<
  ComponentProps<"form">,
  "onSubmit"
> & {
  form: UseFormReturn<T>
  onSubmit: SubmitHandler<T>
  busy?: boolean
}

export function Form<T extends FieldValues>({
  form,
  onSubmit,
  busy,
  className,
  children,
  ...props
}: FormProps<T>) {
  return (
    <FormProvider {...form}>
      <form
        {...props}
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        aria-busy={busy}
        className={cn("flex flex-col gap-6", className)}
      >
        {children}
      </form>
    </FormProvider>
  )
}
