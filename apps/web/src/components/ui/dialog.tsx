import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "../../lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[100]",
      "bg-black/70 backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      "transition-all duration-300",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-[101] grid w-full max-w-5xl translate-x-[-50%] translate-y-[-50%]",
        // Dramatic elevation with multiple shadows and glow
        "gap-6 p-8 rounded-2xl",
        // LIGHT MODE: Pure white, bright and clean
        "bg-white text-gray-900",
        // DARK MODE: DARK background that actually works!
        "dark:!bg-slate-900 dark:!text-gray-100",
        // LIGHT MODE: Dramatic shadow with blue glow
        "shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_20px_60px_-15px_rgba(0,0,0,0.5),0_0_80px_-20px_rgba(59,130,246,0.3)]",
        // DARK MODE: Softer shadows, less glow
        "dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_20px_60px_-15px_rgba(0,0,0,0.9),0_0_60px_-15px_rgba(99,102,241,0.2)]",
        // Subtle border
        "border border-border/50 dark:border-gray-700/50",
        // Enhanced animations
        "duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-90 data-[state=open]:zoom-in-100",
        "data-[state=closed]:slide-out-to-top-[10%] data-[state=open]:slide-in-from-top-[10%]",
        "max-h-[92vh] overflow-y-auto",
        // LIGHT MODE: Subtle inner glow
        "before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-primary/3 before:to-transparent before:pointer-events-none",
        // DARK MODE: No inner glow (too bright)
        "dark:before:from-transparent dark:before:to-transparent",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(
          "absolute right-6 top-6 rounded-lg",
          "opacity-70 transition-all duration-200",
          "hover:opacity-100 hover:bg-accent hover:scale-110 hover:rotate-90",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          "disabled:pointer-events-none p-2",
          // LIGHT MODE: Subtle glow on hover
          "hover:shadow-lg hover:shadow-primary/20",
          // DARK MODE: Less intense glow
          "dark:hover:shadow-primary/10"
        )}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
