// The shared feedback board, read and written straight from Supabase (not part of study sync).
import { supabase } from './supabase';

export type FeedbackCategory = 'idea' | 'bug' | 'etc';

export const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  idea: '기능 제안',
  bug: '문제 신고',
  etc: '기타',
};

export const MAX_FEEDBACK_LENGTH = 1000;

export interface FeedbackNote {
  id: number;
  user_id: string;
  author: string;
  category: FeedbackCategory;
  body: string;
  created_at: string;
}

const NOT_READY = '피드백 게시판이 아직 준비되지 않았어요. 관리자가 Supabase에서 feedback 표를 만들어야 해요.';
const FAILED = '피드백을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.';

/** PostgREST answers like this when the table has not been created yet. */
function isMissingTable(code: string | undefined) {
  return code === '42P01' || code === 'PGRST205';
}

export async function listFeedback(): Promise<FeedbackNote[]> {
  if (!supabase) throw new Error(NOT_READY);
  const { data, error } = await supabase
    .from('feedback')
    .select('id, user_id, author, category, body, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(isMissingTable(error.code) ? NOT_READY : FAILED);
  return data as FeedbackNote[];
}

export async function addFeedback(category: FeedbackCategory, body: string): Promise<void> {
  if (!supabase) throw new Error(NOT_READY);
  const { error } = await supabase.from('feedback').insert({ category, body: body.trim() });
  if (error) throw new Error(isMissingTable(error.code) ? NOT_READY : '남기지 못했어요. 다시 시도해 주세요.');
}

export async function deleteFeedback(id: number): Promise<void> {
  if (!supabase) throw new Error(NOT_READY);
  const { error } = await supabase.from('feedback').delete().eq('id', id);
  if (error) throw new Error('지우지 못했어요. 다시 시도해 주세요.');
}
