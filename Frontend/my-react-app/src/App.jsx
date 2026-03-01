import { Navigate, Route, Routes } from "react-router-dom";

import Portfolio from "./pages/Portfolio";
import Stocks from "./pages/stocks";


function App() {
  return (
    <>
      <nav className="navbar navbar-expand-lg bg-white border-bottom shadow-sm">
        <div className="container">
          <span className="navbar-brand fw-semibold text-primary">Stock Portfolio</span>
        </div>
      </nav>

      <main className="container-fluid px-4 px-md-5 py-4 py-md-5">
        <Routes>
          <Route path="/" element={<Navigate to="/portfolio" replace />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/stocks" element={<Stocks />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
