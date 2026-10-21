import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { AuthLayout } from '../components/AuthLayout';
import { authErrorMessage } from '../lib/authErrors';
import { supabase } from '../lib/supabase';
import { toAuthEmail, USERNAME_PATTERN, USERNAME_RULE } from '../lib/username';

const MIN_PASSWORD = 8;

export default function Signup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const username = id.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(username)) return setError(`아이디는 ${USERNAME_RULE}로 만들어 주세요.`);
    if (password.length < MIN_PASSWORD) return setError(`비밀번호는 ${MIN_PASSWORD}자 이상으로 만들어 주세요.`);
    if (password !== confirm) return setError('비밀번호가 서로 달라요.');
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: toAuthEmail(username),
      password,
      options: { data: { username } },
    });
    setBusy(false);
    if (error) return setError(authErrorMessage(error));
    // With email confirmation on, an existing account comes back as a user with no identities.
    if (data.user && data.user.identities?.length === 0) return setError('이미 쓰고 있는 아이디예요.');
    if (data.session) navigate('/', { replace: true });
    else setError('가입은 됐지만 바로 로그인되지 않았어요. Supabase에서 Confirm email이 꺼져 있는지 확인해 주세요.');
  }

  return (
    <AuthLayout title="회원가입" subtitle="아이디와 비밀번호만 있으면 바로 시작할 수 있어요.">
      <form className="auth-form" onSubmit={submit}>
        <label className="form-field">
          <span>아이디</span>
          <input
            className="text-input text-input--block"
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            required
            value={id}
            onChange={(e) => setId(e.target.value)}
            aria-describedby="id-hint"
          />
          <span id="id-hint" className="muted xsmall">
            {USERNAME_RULE}
          </span>
        </label>
        <label className="form-field">
          <span>비밀번호</span>
          <input
            className="text-input text-input--block"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-hint"
          />
          <span id="password-hint" className="muted xsmall">
            {MIN_PASSWORD}자 이상
          </span>
        </label>
        <label className="form-field">
          <span>비밀번호 확인</span>
          <input
            className="text-input text-input--block"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? '가입 중…' : '가입하기'}
        </button>
      </form>
      <p className="muted small center">
        이미 계정이 있나요? <Link to="/login">로그인</Link>
      </p>
    </AuthLayout>
  );
}
