import type { ReactNode } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/AppDialog";
import { HStack, VStack } from "@astryxdesign/core/Stack";

type Props = {
  open: boolean;
  title: string;
  confirmText: string;
  cancelText?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  leftContent: ReactNode;
  rightContent: ReactNode;
};

export function ConfirmBillActionModal({
  open,
  title,
  confirmText,
  cancelText = "Hủy",
  busy = false,
  onClose,
  onConfirm,
  leftContent,
  rightContent,
}: Props) {
  return (
    <Dialog
      isOpen={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
      width={980}
      maxHeight="92dvh"
      purpose="form"
      padding={0}
    >
      <DialogHeader
        title={title}
        onOpenChange={(next) => {
          if (!next && !busy) onClose();
        }}
      />
      <DialogBody>
        <HStack gap={5} padding={5} vAlign="start" wrap="wrap">
          <VStack gap={3} width={420} maxWidth="100%">
            {leftContent}
          </VStack>
          <VStack gap={2} width={360} maxWidth="100%">
            {rightContent}
          </VStack>
        </HStack>
      </DialogBody>
      <DialogFooter>
        <Button label={cancelText} variant="ghost" isDisabled={busy} onClick={onClose} />
        <Button
          label={confirmText}
          variant="primary"
          isLoading={busy}
          isDisabled={busy}
          onClick={onConfirm}
        />
      </DialogFooter>
    </Dialog>
  );
}
