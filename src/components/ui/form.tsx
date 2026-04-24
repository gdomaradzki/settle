'use client';
import * as React from 'react';
import type { FieldPath, FieldValues, UseFormReturn, ControllerRenderProps } from 'react-hook-form';
import { FormProvider, Controller, useFormContext } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { Label } from './label';

export const Form = FormProvider;

type FormFieldContextValue = { name: string };
const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue);

export function FormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  name,
  render,
}: {
  name: TName;
  render: (props: { field: ControllerRenderProps<TFieldValues, TName> }) => React.ReactElement;
}) {
  const { control } = useFormContext<TFieldValues>();
  return (
    <FormFieldContext.Provider value={{ name }}>
      <Controller control={control} name={name} render={({ field }) => render({ field })} />
    </FormFieldContext.Provider>
  );
}

export function FormItem({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5', className)} {...props} />;
}

export function FormLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return <Label className={cn('text-sm font-medium', className)} {...props} />;
}

export function FormControl({ ...props }: React.ComponentProps<'div'>) {
  return <div {...props} />;
}

export function FormDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-xs text-muted-foreground', className)} {...props} />;
}

export function FormMessage({ className, children, ...props }: React.ComponentProps<'p'>) {
  const { name } = React.useContext(FormFieldContext);
  const { formState } = useFormContext();
  const error = name ? (formState.errors[name] as { message?: string } | undefined) : undefined;
  const message = error?.message ?? children;
  if (!message) return null;
  return (
    <p className={cn('text-xs text-destructive', className)} {...props}>
      {message}
    </p>
  );
}

export type { UseFormReturn };
