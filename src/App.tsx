import { useRoutes, Routes, Route } from "react-router-dom";
import ModernHome from "./components/home/ModernHome";
import routes from "tempo-routes";

function App() {
  return (
    <div className="bg-background">
      {import.meta.env.VITE_TEMPO === "true" && useRoutes(routes)}
      <Routes>
        <Route path="/" element={<ModernHome />} />
      </Routes>
    </div>
  );
}

export default App;
