import type { AuthError } from '@supabase/supabase-js';

const BY_CODE: Record<string, string> = {
  invalid_credentials: '이메일 또는 비밀번호가 맞지 않아요.',
  email_not_confirmed: '메일함에서 인증 링크를 먼저 눌러 주세요.',
  user_already_exists: '이미 가입된 이메일이에요. 로그인해 주세요.',
  email_exists: '이미 가입된 이메일이에요. 로그인해 주세요.',
  weak_password: '비밀번호가 너무 쉬워요. 더 길게 만들어 주세요.',
  email_address_invalid: '이메일 주소를 다시 확인해 주세요.',
  over_email_send_rate_limit: '메일을 너무 자주 보냈어요. 잠시 후 다시 시도해 주세요.',
  over_request_rate_limit: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
  signup_disabled: '지금은 회원가입을 받지 않고 있어요.',
};

export function authErrorMessage(error: AuthError | Error): string {
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  if (BY_CODE[code]) return BY_CODE[code];
  if (error.message.includes('fetch')) return '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.';
  return '문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
}
