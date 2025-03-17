import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import MainDashboard from "../dashboard/MainDashboard";
import AdminDashboard from "../admin/AdminDashboard";
import NewLoginForm from "../auth/NewLoginForm";

function NewHome() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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
    email: string;
    password: string;
  }) => {
    try {
      // Verificar se o usuário existe no Supabase
      const { data, error } = await supabase
        .from("users")
        .select("is_admin, email, id")
        .eq("email", userData.email)
        .eq("password", userData.password);

      if (error || !data || data.length === 0) {
        console.error("Erro ao autenticar:", error);
        alert("Email ou senha incorretos. Por favor, tente novamente.");
        return;
      }

      const userInfo = data[0];

      // Verificar se é admin
      const isAdminUser =
        userInfo.is_admin || userData.email === "admin@shopee.com" || false;

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
        <NewLoginForm onAuthComplete={handleAuthComplete} />
      )}
    </div>
  );
}

export default NewHome;
