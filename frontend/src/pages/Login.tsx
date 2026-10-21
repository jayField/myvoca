import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { AuthLayout } from '../components/AuthLayout';
import { authErrorMessage } from '../lib/authErrors';
import { supabase } from '../lib/supabase';
import { toAuthEmail } from '../lib/username';

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: toAuthEmail(id), password });
    setBusy(false);
    if (error) setError(authErrorMessage(error));
    else navigate('/', { replace: true });
  }

  return (
    <AuthLayout title="로그인" subtitle="학습 기록은 계정에 저장돼서 폰과 PC에서 이어서 할 수 있어요.">
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
          />
        </label>
        <label className="form-field">
          <span>비밀번호</span>
          <input
            className="text-input text-input--block"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? '로그인 중…' : '로그인'}
        </button>
      </form>
      <p className="muted small center">
        처음이신가요?{' '}
        <Link to="/signup">회원가입</Link>
      </p>
    </AuthLayout>
  );
}
