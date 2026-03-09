import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";

import Timeseries from "./pages/timeseries";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Portfolio from "./pages/Portfolio";
import PortfolioHome from "./pages/PortfolioHome";
import SectorStocks from "./pages/SectorStocks";
import Signup from "./pages/Signup";
import Stocks from "./pages/stocks";
import { isLoggedIn } from "./utils/auth";

function PortfolioGate() {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();

  if (loggedIn) return <PortfolioHome />;

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body py-5 text-center">
        <h4 className="mb-2">Login required</h4>
        <p className="text-secondary mb-4">Please log in to view your portfolio analytics.</p>
        <div className="d-flex justify-content-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              navigate("/login", {
                state: { redirectTo: "/portfolio", message: "Please log in to view your portfolio." },
              })
            }
          >
            Login
          </button>
          <button type="button" className="btn btn-outline-primary" onClick={() => navigate("/signup")}>
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}

function TimeseriesGate() {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();

  if (loggedIn) return <Timeseries />;

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body py-5 text-center">
        <h4 className="mb-2">Login required</h4>
        <p className="text-secondary mb-4">Please log in to access the timeseries page.</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            navigate("/login", {
              state: { redirectTo: "/timeseries", message: "Please log in to access timeseries." },
            })
          }
        >
          Login
        </button>
      </div>
    </div>
  );
}

function App() {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();

  function handleLogout() {
    try {
      localStorage.removeItem("current_user");
    } catch {
      // ignore
    }
    navigate("/home", { replace: true });
  }

  return (
    <>
      <nav className="navbar navbar-expand-lg app-navbar">
        <div className="container">
          <Link to="/home" className="navbar-brand app-brand text-decoration-none">
            TradeAnalytics
          </Link>
          <div className="d-flex gap-1 gap-md-2 align-items-center flex-wrap ms-auto app-nav">
            <Link to="/home" className="nav-link app-nav-link">
              Home
            </Link>
            <Link to="/sectors" className="nav-link app-nav-link">
              Sectors
            </Link>
            <Link to="/portfolio" className="nav-link app-nav-link">
              Portfolio
            </Link>
            <Link to="/stock/banking" className="nav-link app-nav-link">
              Stock
            </Link>
            <Link to="/timeseries" className="nav-link app-nav-link">
              Timeseries
            </Link>
            {loggedIn ? (
              <button type="button" className="btn btn-sm btn-outline-primary ms-md-2" onClick={handleLogout}>
                Logout
              </button>
            ) : (
              <>
                <Link to="/login" className="btn btn-sm btn-outline-primary ms-md-2">
                  Login
                </Link>
                <Link to="/signup" className="btn btn-sm btn-primary ms-2">
                  Signup
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="container-fluid px-4 px-md-5 py-4 py-md-5">
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/sectors" element={<Portfolio />} />
          <Route path="/portfolio" element={<PortfolioGate />} />
          <Route path="/stock" element={<SectorStocks />} />
          <Route path="/stock/:sectorName" element={<SectorStocks />} />
          <Route path="/stocks" element={<Stocks />} />
          <Route path="/timeseries" element={<TimeseriesGate />} />
          <Route path="/builtin" element={<Navigate to="/timeseries" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
