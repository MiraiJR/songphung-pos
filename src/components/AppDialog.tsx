import { createContext, useContext, useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

type OpenChange = (open: boolean) => void;

type DialogProps = {
  isOpen: boolean;
  onOpenChange: OpenChange;
  children: ReactNode;
  width?: number | string;
  maxHeight?: number | string;
  padding?: number;
  /** Kept so existing call sites compile. The custom dialog always allows dismiss. */
  purpose?: string;
};

type DialogHeaderProps = {
  title: string;
  subtitle?: string;
  onOpenChange: OpenChange;
};

const DialogTitleContext = createContext<string | undefined>(undefined);

function toCssSize(value: number | string | undefined, fallback: string): string {
  if (value == null) return fallback;
  return typeof value === "number" ? `${value}px` : value;
}

export function Dialog({
  isOpen,
  onOpenChange,
  children,
  width,
  maxHeight,
  padding = 0,
}: DialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onOpenChange]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="app-dialog-backdrop"
      role="presentation"
      onMouseDown={() => onOpenChange(false)}
    >
      <DialogTitleContext.Provider value={titleId}>
        <section
          className="app-dialog-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          style={{
            width: toCssSize(width, "480px"),
            maxHeight: toCssSize(maxHeight, "92dvh"),
            padding: padding ? `${padding}px` : undefined,
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {children}
        </section>
      </DialogTitleContext.Provider>
    </div>,
    document.body,
  );
}

export function DialogHeader({ title, subtitle, onOpenChange }: DialogHeaderProps) {
  const titleId = useContext(DialogTitleContext);
  return (
    <HStack gap={3} vAlign="start" hAlign="between" padding={4}>
      <VStack gap={0.5}>
        <Heading level={2} id={titleId}>
          {title}
        </Heading>
        {subtitle ? <Text color="secondary">{subtitle}</Text> : null}
      </VStack>
      <IconButton
        label="Đóng"
        icon={<Icon icon={X} />}
        variant="ghost"
        size="sm"
        onClick={() => onOpenChange(false)}
      />
    </HStack>
  );
}
