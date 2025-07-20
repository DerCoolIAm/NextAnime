// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainPage from "./pages/MainPage";
import Calendar from "./pages/Calendar";
import CacheViewer from "./pages/CacheViewer";

function App() {
  return (
    <Router basename="/NextAnime">
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/cache" element={<CacheViewer />} />
      </Routes>
    </Router>
  );
}

export default App;
