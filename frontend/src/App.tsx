import Auth from "./components/pages/Auth";
import Dashboard from "./components/pages/Dashboard";
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PublicRoute from "./components/auth/PublicRoute";
import "./index.css";

import { BrowserRouter, Route, Routes } from "react-router";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/c/:conversationId" element={<Dashboard />} />
        </Route>
        <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
