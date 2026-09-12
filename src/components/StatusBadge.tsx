import type { ComplaintStatus } from '@/lib/supabase';
import { STATUS_LABELS, STATUS_BG_COLORS } from '@/lib/supabase';

interface StatusBadgeProps {
  status: ComplaintStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_BG_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
