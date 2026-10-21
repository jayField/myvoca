import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import DeckDetail from './pages/DeckDetail';
import Decks from './pages/Decks';
import Home from './pages/Home';
import Quiz from './pages/Quiz';
import Stats from './pages/Stats';
import Study from './pages/Study';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Home />} />
          <Route path="study" element={<Study />} />
          <Route path="decks" element={<Decks />} />
          <Route path="decks/:deckId" element={<DeckDetail />} />
          <Route path="quiz" element={<Quiz />} />
          <Route path="stats" element={<Stats />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
