import { toast } from 'sonner';
import { trpc } from '@/lib/trpc-client';

function toastError(err: { message: string }) {
  toast.error(err.message);
}

export function useBillMutations(billId: string) {
  const utils = trpc.useUtils();

  function invalidate() {
    utils.bill.get.invalidate(billId);
    utils.bill.list.invalidate();
  }

  return {
    submit: trpc.bill.submit.useMutation({
      onSuccess: () => { invalidate(); toast.success('Bill submitted'); },
      onError: toastError,
    }),
    approve: trpc.bill.approve.useMutation({
      onSuccess: () => { invalidate(); toast.success('Bill approved'); },
      onError: toastError,
    }),
    reject: trpc.bill.reject.useMutation({
      onSuccess: () => { invalidate(); toast.success('Bill rejected'); },
      onError: toastError,
    }),
    schedule: trpc.bill.schedule.useMutation({
      onSuccess: () => { invalidate(); toast.success('Payment scheduled'); },
      onError: toastError,
    }),
    pay: trpc.bill.pay.useMutation({
      onSuccess: () => { invalidate(); toast.success('Payment sent'); },
      onError: toastError,
    }),
  };
}
