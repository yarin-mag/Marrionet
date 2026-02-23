import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const Sheet: React.FC<SheetProps> = ({ open, onOpenChange, children }) => {
  return <>{children}</>;
};

const SheetTrigger: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  ...props
}) => {
  return <button {...props}>{children}</button>;
};

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "left" | "right" | "top" | "bottom";
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ side = "right", className, children, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);

    React.useEffect(() => {
      setIsOpen(true);
    }, []);

    return (
      <>
        {/* Backdrop */}
        <div
          className={cn(
            "fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm transition-opacity",
            isOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => props.onClick?.(null as any)}
        />

        {/* Sheet */}
        <div
          ref={ref}
          className={cn(
            "fixed z-[101] gap-4 bg-card border-border p-8 shadow-2xl transition-all ease-in-out duration-300 overflow-y-auto",
            {
              "inset-y-0 right-0 h-full w-full border-l sm:max-w-2xl lg:max-w-3xl": side === "right",
              "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-md": side === "left",
              "inset-x-0 top-0 border-b": side === "top",
              "inset-x-0 bottom-0 border-t": side === "bottom",
            },
            isOpen
              ? side === "right"
                ? "translate-x-0"
                : side === "left"
                ? "translate-x-0"
                : "translate-y-0"
              : side === "right"
              ? "translate-x-full"
              : side === "left"
              ? "-translate-x-full"
              : side === "bottom"
              ? "translate-y-full"
              : "-translate-y-full",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </>
    );
  }
);
SheetContent.displayName = "SheetContent";

const SheetHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}
    {...props}
  />
);

const SheetTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  ...props
}) => (
  <h2
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
);

const SheetDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  ...props
}) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);

const SheetClose: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  className,
  ...props
}) => (
  <Button
    variant="ghost"
    size="icon"
    className={cn("absolute right-4 top-4 rounded-sm", className)}
    {...props}
  >
    <X className="h-4 w-4" />
    <span className="sr-only">Close</span>
  </Button>
);

export {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
};
