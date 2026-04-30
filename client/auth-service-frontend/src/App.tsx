import { Route, Routes } from "react-router-dom";

import { Home } from "./pages/Home";
import Login from "./pages/Login";

import { ProtectedRoute } from "./routes/ProtectedRoute";
import { AppLayout } from "./layouts/AppLayout";
import OauthLogin from "./pages/OauthLogin";
import { Clients } from "./pages/Clients.tsx";
import { Client } from "./pages/Client.tsx";
import { Docs } from "./pages/Docs.tsx";

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
        <Route path="/clients" element={<Clients />} />
        <Route path="/client/:id" element={<Client />} />
        {/* <Route path="/docs" element={<Docs />} /> */}
      </Route>
    </Routes>
  );
}

export default App;
