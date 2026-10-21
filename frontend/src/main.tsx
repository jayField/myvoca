import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import Account from './pages/Account';
import DeckDetail from './pages/DeckDetail';
import Decks from './pages/Decks';
import Home from './pages/Home';
import Login from './pages/Login';
import Quiz from './pages/Quiz';
import Signup from './pages/Signup';
import Stats from './pages/Stats';
import Study from './pages/Study';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route element={<App />}>
            <Route index element={<Home />} />
            <Route path="study" element={<Study />} />
            <Route path="decks" element={<Decks />} />
            <Route path="decks/:deckId" element={<DeckDetail />} />
            <Route path="quiz" element={<Quiz />} />
            <Route path="stats" element={<Stats />} />
            <Route path="account" element={<Account />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
