import type { Grade, ItemStatus, OrderMode } from './api';

export const GRADES: { grade: Grade; label: string; key: string }[] = [
  { grade: 'again', label: '몰랐음', key: '1' },
  { grade: 'hard', label: '헷갈림', key: '2' },
  { grade: 'good', label: '알았음', key: '3' },
];

export const ORDER_LABEL: Record<OrderMode, string> = {
  sequential: '순서대로',
  random: '랜덤',
};

export const STATUS_LABEL: Record<ItemStatus, string> = {
  new: '새 단어',
  due: '오늘 복습',
  learning: '학습 중',
  mastered: '외움',
};
