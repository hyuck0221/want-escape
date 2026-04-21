import { Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import ThemeDetail from './pages/ThemeDetail';
import Cafe from './pages/Cafe';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import Invite from './pages/Invite';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/theme/:id" element={<ThemeDetail />} />
          <Route path="/cafe/:branch" element={<Cafe />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/invite/:code" element={<Invite />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
