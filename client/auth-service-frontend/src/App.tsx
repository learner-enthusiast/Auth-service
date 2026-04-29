import { Route, Routes } from "react-router-dom";

import { Home } from "./pages/Home";
import Login from "./pages/Login";

import { ProtectedRoute } from "./routes/ProtectedRoute";
import { AppLayout } from "./layouts/AppLayout";
import OauthLogin from "./pages/OauthLogin";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/oauth/login" element={<OauthLogin />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Home />} />
      </Route>
    </Routes>
  );
}

export default App;
