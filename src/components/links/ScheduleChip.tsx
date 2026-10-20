import React from 'react';
import { Clock } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { useNow, getScheduleState, formatScheduleTime, SchedulableBlock } from '../../lib/time';

interface ScheduleChipProps {
  block: SchedulableBlock;
  isActive: boolean;
}

export const ScheduleChip: React.FC<ScheduleChipProps> = ({ block, isActive }) => {
  const now = useNow(30000);

  if (!isActive) {
    return <Badge variant="default">Hidden</Badge>;
  }

  const state = getScheduleState(block, now);

  if (state === 'upcoming' && block.startAt) {
    return (
      <Badge variant="default" className="flex items-center gap-1">
        <Clock size={12} strokeWidth={1.5} />
        <span>Starts {formatScheduleTime(block.startAt)}</span>
      </Badge>
    );
  }

  if (state === 'live' && block.endAt) {
    return (
      <Badge variant="default" className="flex items-center gap-1">
        <Clock size={12} strokeWidth={1.5} />
        <span>Until {formatScheduleTime(block.endAt)}</span>
      </Badge>
    );
  }

  if (state === 'ended') {
    return (
      <Badge variant="default" className="flex items-center gap-1">
        <Clock size={12} strokeWidth={1.5} />
        <span>Ended</span>
      </Badge>
    );
  }

  return null;
};
