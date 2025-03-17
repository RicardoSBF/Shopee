import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import MainDashboard from "../dashboard/MainDashboard";
import AdminDashboard from "../admin/AdminDashboard";
import ModernLoginForm from "../auth/ModernLoginForm";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

function ModernHome() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState("");

  // Verificar se já existe um usuário autenticado no localStorage
  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      const savedUser = localStorage.getItem("authenticatedUser");
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        const userEmail = userData.email || userData.phoneNumber; // Support both old and new format

        // Verificar se o usuário existe no Supabase
        const { data, error } = await supabase
          .from("users")
          .select("is_admin, full_name")
          .eq("email", userEmail)
          .eq("password", userData.password)
          .single();

        if (error || !data) {
          // Usuário não encontrado ou erro, limpar localStorage
          localStorage.removeItem("authenticatedUser");
          setIsLoading(false);
          return;
        }

        setUserName(data.full_name || "Motorista");
        setIsAuthenticated(true);
        setIsAdmin(data.is_admin || false);
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const handleAuthComplete = async (userData: {
    email: string;
    password: string;
  }) => {
    try {
      setIsLoading(true);
      // Verificar se o usuário existe no Supabase
      const { data, error } = await supabase
        .from("users")
        .select("is_admin, email, id, full_name")
        .eq("email", userData.email)
        .eq("password", userData.password);

      if (error || !data || data.length === 0) {
        console.error("Erro ao autenticar:", error);
        alert("Email ou senha incorretos. Por favor, tente novamente.");
        setIsLoading(false);
        return;
      }

      const userInfo = data[0];
      setUserName(userInfo.full_name || "Motorista");

      // Verificar se é admin
      const isAdminUser =
        userInfo.is_admin || userData.email === "admincb@shopee.com" || false;

      // Salvar no localStorage para manter o login
      localStorage.setItem(
        "authenticatedUser",
        JSON.stringify({
          ...userData,
          email: userInfo.email,
          isAdmin: isAdminUser,
          userId: userInfo.id,
          fullName: userInfo.full_name,
        }),
      );

      setIsAuthenticated(true);
      setIsAdmin(isAdminUser);
      setIsLoading(false);
    } catch (error) {
      console.error("Erro ao autenticar:", error);
      alert("Ocorreu um erro ao autenticar. Tente novamente.");
      setIsLoading(false);
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
    <div className="w-screen h-screen bg-background dark:bg-gray-900 transition-colors duration-300">
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center h-full"
          >
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">Carregando...</p>
            </div>
          </motion.div>
        ) : isAuthenticated ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <div className="absolute top-4 right-4 z-50">
              <Button
                onClick={handleLogout}
                variant="destructive"
                size="sm"
                className="flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-300"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
            {isAdmin ? (
              <AdminDashboard userName="Administrador" />
            ) : (
              <MainDashboard userName={userName} />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <ModernLoginForm onAuthComplete={handleAuthComplete} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ModernHome;
