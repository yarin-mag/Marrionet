import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const Sheet: React.FC<SheetProps> = ({ open: _open, onOpenChange: _onOpenChange, children }) => {
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
  onClose?: () => void;
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ side = "right", className, children, onClick, onClose, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);

    React.useEffect(() => {
      setIsOpen(true);
    }, []);

    return (
      <>
        {/* Backdrop */}
        <div
          className={cn(
            "fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm transition-opacity",
            isOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => onClick?.(null as any) ?? onClose?.()}
        />

        {/* Sheet */}
        <div
          ref={ref}
          className={cn(
            "fixed z-[101] gap-4 p-8 transition-all ease-in-out duration-300 overflow-y-auto",
            "bg-white text-gray-900",
            "dark:!bg-slate-900 dark:!text-gray-100",
            "shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_20px_60px_-15px_rgba(0,0,0,0.5),0_0_80px_-20px_rgba(59,130,246,0.3)]",
            "dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_20px_60px_-15px_rgba(0,0,0,0.9),0_0_60px_-15px_rgba(99,102,241,0.2)]",
            "border border-border/50 dark:border-gray-700/50",
            "before:absolute before:inset-0 before:bg-gradient-to-br before:from-primary/3 before:to-transparent before:pointer-events-none",
            "dark:before:from-transparent dark:before:to-transparent",
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
          {onClose && (
            <button
              onClick={onClose}
              className={cn(
                "absolute right-6 top-6 rounded-lg z-10",
                "opacity-70 transition-all duration-200",
                "hover:opacity-100 hover:bg-accent hover:scale-110 hover:rotate-90",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                "disabled:pointer-events-none p-2",
                "hover:shadow-lg hover:shadow-primary/20",
                "dark:hover:shadow-primary/10"
              )}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          )}
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
  <button
    className={cn(
      "absolute right-6 top-6 rounded-lg",
      "opacity-70 transition-all duration-200",
      "hover:opacity-100 hover:bg-accent hover:scale-110 hover:rotate-90",
      "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
      "disabled:pointer-events-none p-2",
      "hover:shadow-lg hover:shadow-primary/20",
      "dark:hover:shadow-primary/10",
      className
    )}
    {...props}
  >
    <X className="h-4 w-4" />
    <span className="sr-only">Close</span>
  </button>
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
