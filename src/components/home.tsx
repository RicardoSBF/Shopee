import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import MainDashboard from "./dashboard/MainDashboard";
import AdminDashboard from "./admin/AdminDashboard";
import AuthenticationForm from "./auth/AuthenticationForm";

function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(true);

  // Verificar se já existe um usuário autenticado no localStorage
  useEffect(() => {
    const checkAuth = async () => {
      const savedUser = localStorage.getItem("authenticatedUser");
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        const userEmail = userData.email || userData.phoneNumber; // Support both old and new format

        // Verificar se o usuário existe no Supabase
        const { data, error } = await supabase
          .from("users")
          .select("is_admin")
          .eq("email", userEmail)
          .eq("password", userData.password)
          .single();

        if (error || !data) {
          // Usuário não encontrado ou erro, limpar localStorage
          localStorage.removeItem("authenticatedUser");
          return;
        }

        setIsAuthenticated(true);
        setIsAdmin(data.is_admin || false);
      }
    };

    checkAuth();
  }, []);

  const handleAuthComplete = async (userData: {
    phoneNumber: string; // This is actually the email now
    password: string;
  }) => {
    console.log("Autenticação completa com:", userData);

    try {
      // Verificar se o usuário existe no Supabase
      const { data, error } = await supabase
        .from("users")
        .select("is_admin, email, id")
        .eq("email", userData.phoneNumber) // phoneNumber field contains email
        .eq("password", userData.password);

      if (error || !data || data.length === 0) {
        console.error("Erro ao autenticar:", error);
        alert("Email ou senha incorretos. Por favor, tente novamente.");
        return;
      }

      const userInfo = data[0];

      // Verificar se é admin
      const isAdminUser =
        userInfo.is_admin ||
        userData.phoneNumber === "admin@shopee.com" ||
        false;

      // Salvar no localStorage para manter o login
      localStorage.setItem(
        "authenticatedUser",
        JSON.stringify({
          ...userData,
          email: userInfo.email,
          isAdmin: isAdminUser,
          userId: userInfo.id,
        }),
      );

      setIsAuthenticated(true);
      setIsAdmin(isAdminUser);
    } catch (error) {
      console.error("Erro ao autenticar:", error);
      alert("Ocorreu um erro ao autenticar. Tente novamente.");
    }
  };

  const handleLogout = () => {
    // Limpar todos os dados do localStorage ao fazer logout
    localStorage.removeItem("authenticatedUser");
    localStorage.removeItem("profileData");
    localStorage.removeItem("userRegions");
    localStorage.removeItem("driverAvailability");
    localStorage.removeItem("extractedName");
    localStorage.removeItem("extractedID");
    localStorage.removeItem("extractedVehicleType");
    localStorage.removeItem("extractedPlate");
    localStorage.removeItem("driverAppVerified");
    localStorage.removeItem("driverVerificationExpiration");
    localStorage.removeItem("verificationDate");
    localStorage.removeItem("driverInfoUpdatedAt");
    localStorage.removeItem("vehicleType");
    localStorage.removeItem("vehiclePlate");
    localStorage.removeItem("deliveryFee");
    localStorage.removeItem("verificationExpiration");
    localStorage.removeItem("verificationUpdatedAt");
    localStorage.removeItem("availabilityUpdatedAt");
    localStorage.removeItem("profileUpdatedAt");
    localStorage.removeItem("passwordUpdatedAt");
    localStorage.removeItem("regionsUpdatedAt");
    localStorage.removeItem("configActiveTab");

    setIsAuthenticated(false);
    setIsAdmin(false);
  };

  return (
    <div className="w-screen h-screen bg-background">
      {isAuthenticated ? (
        <>
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
            >
              Sair
            </button>
          </div>
          {isAdmin ? (
            <AdminDashboard userName="Administrador" />
          ) : (
            <MainDashboard />
          )}
        </>
      ) : (
        <div className="container mx-auto py-8 flex flex-col items-center justify-center h-full">
          <div className="mb-8 flex gap-4">
            <button
              onClick={() => setShowLogin(true)}
              className={`px-6 py-2 rounded-md transition-colors ${showLogin ? "bg-primary text-white" : "bg-gray-200 text-gray-700"}`}
            >
              Login
            </button>
            <button
              onClick={() => setShowLogin(false)}
              className={`px-6 py-2 rounded-md transition-colors ${!showLogin ? "bg-primary text-white" : "bg-gray-200 text-gray-700"}`}
            >
              Registro
            </button>
          </div>
          <AuthenticationForm
            onAuthComplete={handleAuthComplete}
            isLogin={showLogin}
          />
        </div>
      )}
    </div>
  );
}

export default Home;
