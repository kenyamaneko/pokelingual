import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { DevAuthProvider } from "./contexts/DevAuthContext";
import { UsageProvider } from "./contexts/UsageContext";
import { isDevMode } from "./config/firebase";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { Header } from "./components/layout/Header";
import { HomePage } from "./pages/HomePage";
import { QuestPage } from "./pages/QuestPage";
import { CollectionPage } from "./pages/CollectionPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";

const Provider = isDevMode ? DevAuthProvider : AuthProvider;

function App() {
  return (
    <Provider>
      <UsageProvider>
        <BrowserRouter>
          <Header />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quest"
              element={
                <ProtectedRoute>
                  <QuestPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/collection"
              element={
                <ProtectedRoute>
                  <CollectionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </UsageProvider>
    </Provider>
  );
}

export default App;
