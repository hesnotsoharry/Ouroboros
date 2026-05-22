/**
 * usePermissionRejectFlow — extracted from PermissionCard to keep it under
 * the 300-line cap. Manages the optional deny-reason UI state (ADR D7).
 */

import { useCallback, useState } from 'react';

export interface RejectFlow {
  showRejectInput: boolean;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  handleDenyClick: () => void;
  handleConfirmReject: () => void;
  handleCancelReject: () => void;
}

export function usePermissionRejectFlow(onDeny: (reason?: string) => void): RejectFlow {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const reset = useCallback(() => {
    setShowRejectInput(false);
    setRejectReason('');
  }, []);
  const handleDenyClick = useCallback(() => {
    if (showRejectInput) {
      onDeny(rejectReason || undefined);
      reset();
    } else setShowRejectInput(true);
  }, [showRejectInput, onDeny, rejectReason, reset]);
  const handleConfirmReject = useCallback(() => {
    onDeny(rejectReason || undefined);
    reset();
  }, [onDeny, rejectReason, reset]);
  const handleCancelReject = useCallback(() => {
    reset();
  }, [reset]);
  return {
    showRejectInput,
    rejectReason,
    setRejectReason,
    handleDenyClick,
    handleConfirmReject,
    handleCancelReject,
  };
}
