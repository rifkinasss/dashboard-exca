import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import type { ComponentProps } from "react";
import { cn } from "cn";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

export function SheetTitle(props: ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" {...props} />;
}

export function SheetDescription(props: ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description data-slot="sheet-description" {...props} />;
}

export function SheetContent({ className, children, ...props }: ComponentProps<typeof SheetPrimitive.Popup>) {
  return <SheetPrimitive.Portal className="filter-sheet-portal"><SheetPrimitive.Backdrop className="filter-sheet-backdrop" /><SheetPrimitive.Viewport className="filter-sheet-viewport"><SheetPrimitive.Popup className={cn("filter-sheet-content", className)} {...props}>{children}</SheetPrimitive.Popup></SheetPrimitive.Viewport></SheetPrimitive.Portal>;
}
