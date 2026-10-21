import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { AuthLayout } from '../components/AuthLayout';
import { authErrorMessage } from '../lib/authErrors';
import { supabase } from '../lib/supabase';

const MIN_PASSWORD = 8;

export default function Signup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < MIN_PASSWORD) return setError(`비밀번호는 ${MIN_PASSWORD}자 이상으로 만들어 주세요.`);
    if (password !== confirm) return setError('비밀번호가 서로 달라요.');
    setBusy(true);
    setError(null);
    const address = email.trim();
    const { data, error } = await supabase.auth.signUp({
      email: address,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) return setError(authErrorMessage(error));
    // With email confirmation on, an existing address comes back as a user with no identities.
    if (data.user && data.user.identities?.length === 0) return setError('이미 가입된 이메일이에요. 로그인해 주세요.');
    if (data.session) navigate('/', { replace: true });
    else setSentTo(address);
  }

  if (sentTo) {
    return (
      <AuthLayout title="메일을 확인해 주세요" subtitle={`${sentTo}로 인증 메일을 보냈어요.`}>
        <p className="muted small">메일의 링크를 누르면 가입이 끝나고 바로 로그인돼요. 메일이 안 보이면 스팸함도 확인해 주세요.</p>
        <Link to="/login" className="btn btn--ghost btn--block">
          로그인 화면으로
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="회원가입" subtitle="이메일로 가입하고 어느 기기에서든 이어서 학습하세요.">
      <form className="auth-form" onSubmit={submit}>
        <label className="form-field">
          <span>이메일</span>
          <input
            className="text-input text-input--block"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
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
      <p className="muted small">지금 이 기기에 쌓인 학습 기록은 가입하면 계정으로 옮겨져요.</p>
      <p className="muted small center">
        이미 계정이 있나요? <Link to="/login">로그인</Link>
      </p>
    </AuthLayout>
  );
}
