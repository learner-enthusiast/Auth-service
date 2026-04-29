import { Route, Routes } from "react-router-dom";

import { Home } from "./pages/Home";
import Login from "./pages/Login";

import { ProtectedRoute } from "./routes/ProtectedRoute";
import { AppLayout } from "./layouts/AppLayout";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

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
