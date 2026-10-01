"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const EMPTY_VALUE = "__mxpage_empty__";

type SelectProps = {
  children: React.ReactNode;
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

function optionText(node: React.ReactNode): string {
  return React.Children.toArray(node).map(child => {
    if (React.isValidElement<{ children?: React.ReactNode }>(child)) return optionText(child.props.children);
    return String(child);
  }).join("");
}

// Keep option declarations at the call site while Radix owns focus, typeahead and positioning.
export function Select({ children, value, defaultValue, onValueChange, name, disabled, required, className, ...triggerProps }: SelectProps) {
  const options = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<{
    value?: string | number; children?: React.ReactNode; disabled?: boolean;
  }>[];
  const encode = (value: string | number) => String(value) || EMPTY_VALUE;
  return (
    <SelectPrimitive.Root
      value={value === undefined ? undefined : encode(value)}
      defaultValue={defaultValue === undefined ? undefined : encode(defaultValue)}
      onValueChange={next => onValueChange?.(next === EMPTY_VALUE ? "" : next)}
      name={name}
      disabled={disabled}
      required={required}
    >
      <SelectPrimitive.Trigger
        {...triggerProps}
        className={cn("group flex h-10 w-full min-w-0 select-none items-center justify-between gap-3 rounded-xl border border-input bg-card px-3 py-2 text-left text-sm text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-card disabled:cursor-not-allowed disabled:opacity-50 [&>span:first-child]:truncate", className)}
      >
        <SelectPrimitive.Value placeholder="请选择" />
        <SelectPrimitive.Icon asChild><ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" sideOffset={6} collisionPadding={12} className="z-[100] max-h-[min(20rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
          <SelectPrimitive.ScrollUpButton className="flex h-7 items-center justify-center bg-popover text-muted-foreground"><ChevronUp className="h-4 w-4" /></SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1.5">
            {options.map(option => {
              const text = optionText(option.props.children);
              const optionValue = encode(option.props.value ?? text);
              return <SelectPrimitive.Item key={optionValue} value={optionValue} disabled={option.props.disabled} textValue={text} className="relative flex min-h-9 cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-9 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[state=checked]:bg-secondary data-[state=checked]:font-medium data-[disabled]:pointer-events-none data-[disabled]:opacity-40">
                <SelectPrimitive.ItemText><span className="break-all">{option.props.children}</span></SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3"><Check className="h-4 w-4" /></SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>;
            })}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-7 items-center justify-center bg-popover text-muted-foreground"><ChevronDown className="h-4 w-4" /></SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
