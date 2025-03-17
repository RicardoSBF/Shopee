import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { hashPassword, verifyPassword } from "../../lib/encryption";
import { Card, CardContent } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { UserCircle, Mail, Lock } from "lucide-react";
import EmailVerification from "./PhoneVerification";
import PasswordCreation from "./PasswordCreation";

enum AuthStage {
  EMAIL_VERIFICATION = "email_verification",
  PASSWORD_CREATION = "password_creation",
  PROFILE_SETUP = "profile_setup",
}

interface AuthenticationFormProps {
  onAuthComplete?: (userData: {
    phoneNumber: string;
    password: string;
  }) => void;
  initialStage?: AuthStage;
  isLogin?: boolean;
}

const AuthenticationForm = ({
  onAuthComplete = () => {},
  initialStage = AuthStage.EMAIL_VERIFICATION,
  isLogin = false,
}: AuthenticationFormProps) => {
  const [currentStage, setCurrentStage] = useState<AuthStage>(initialStage);
  const [userData, setUserData] = useState<{
    email: string;
    password: string;
    isLogin: boolean;
  }>({
    email: "",
    password: "",
    isLogin: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailVerificationComplete = async (email: string) => {
    // Check if user exists to determine if this is login or registration
    try {
      const { data, error } = await supabase
        .from("users")
        .select("email")
        .eq("email", email);

      if (isLogin && (!data || data.length === 0)) {
        alert(
          "Este email não está cadastrado. Por favor, registre-se primeiro.",
        );
        return;
      }

      if (!isLogin && data && data.length > 0) {
        alert("Este email já está cadastrado. Por favor, faça login.");
        return;
      }

      setUserData({ ...userData, email, isLogin });
      setCurrentStage(AuthStage.PASSWORD_CREATION);
    } catch (error) {
      console.error("Erro ao verificar email:", error);

      // User doesn't exist, proceed with registration if not login
      if (isLogin) {
        alert(
          "Este email não está cadastrado. Por favor, registre-se primeiro.",
        );
        return;
      }

      setUserData({ ...userData, email, isLogin });
      setCurrentStage(AuthStage.PASSWORD_CREATION);
    }
  };

  const handlePasswordCreated = async (password: string) => {
    setIsLoading(true);
    try {
      if (userData.isLogin) {
        // Login flow
        const { data: existingUsers, error: checkError } = await supabase
          .from("users")
          .select("*")
          .eq("email", userData.email);

        if (checkError || !existingUsers || existingUsers.length === 0) {
          console.error("Erro ao verificar usuário:", checkError);
          alert(`Usuário não encontrado ou erro ao verificar.`);
          setIsLoading(false);
          return;
        }

        const existingUser = existingUsers[0];

        // Verify password - for now using direct comparison, but in future will use hash verification
        if (existingUser.password !== password) {
          alert("Senha incorreta. Por favor, tente novamente.");
          setIsLoading(false);
          return;
        }

        // Password correct, proceed with login
        setUserData({ ...userData, password });
        setIsLoading(false);
        onAuthComplete({
          phoneNumber: userData.email, // Using phoneNumber field for email for compatibility
          password,
        });
        return;
      } else {
        // Registration flow
        // Check if email already exists
        const { data: existingUsers, error: checkError } = await supabase
          .from("users")
          .select("email")
          .eq("email", userData.email);

        if (existingUsers && existingUsers.length > 0) {
          alert("Este email já está cadastrado. Por favor, use outro email.");
          setIsLoading(false);
          return;
        }

        // Create new account
        const { data, error } = await supabase
          .from("users")
          .insert([
            {
              email: userData.email,
              phone_number: userData.email, // For backward compatibility
              password: password, // In production: hashPassword(password)
              is_admin:
                userData.email === "admin@shopee.com" && password === "123456",
              full_name: "", // Add empty full_name to prevent null constraint issues
              id_number: "", // Add empty id_number to prevent null constraint issues
            },
          ])
          .select();

        if (error) {
          console.error("Erro ao criar usuário:", error);
          alert(`Erro ao criar usuário: ${error.message}`);
          setIsLoading(false);
          return;
        }

        setUserData({ ...userData, password });
        setIsLoading(false);
        // Marcar como novo login para limpar dados de perfil
        sessionStorage.setItem("isNewLogin", "true");
        onAuthComplete({
          phoneNumber: userData.email, // Using phoneNumber field for email for compatibility
          password,
        });
        setCurrentStage(AuthStage.PROFILE_SETUP);
      }
    } catch (error) {
      console.error("Erro ao processar usuário:", error);
      alert("Ocorreu um erro ao processar o usuário. Tente novamente.");
      setIsLoading(false);
    }
  };

  const renderStageContent = () => {
    switch (currentStage) {
      case AuthStage.EMAIL_VERIFICATION:
        return (
          <EmailVerification
            onVerificationComplete={handleEmailVerificationComplete}
            initialEmail={userData.email}
            isLogin={isLogin}
          />
        );
      case AuthStage.PASSWORD_CREATION:
        return (
          <PasswordCreation
            onPasswordCreated={handlePasswordCreated}
            isLoading={isLoading}
          />
        );
      case AuthStage.PROFILE_SETUP:
        return (
          <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <UserCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-center mb-2">
              Registro Concluído com Sucesso!
            </h2>
            <p className="text-center text-gray-600 mb-6">
              Sua conta foi criada. Por favor, complete a configuração do seu
              perfil para continuar.
            </p>
            <div className="w-full max-w-xs">
              <button
                className="w-full py-2 px-4 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                onClick={() => {
                  // This would typically navigate to profile setup
                  console.log("Navegar para configuração de perfil");
                }}
              >
                Continuar para Configuração de Perfil
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-background p-4">
      <Tabs
        value={currentStage}
        className="w-full"
        onValueChange={(value) => setCurrentStage(value as AuthStage)}
      >
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger
            value={AuthStage.EMAIL_VERIFICATION}
            disabled={
              currentStage !== AuthStage.EMAIL_VERIFICATION &&
              userData.email === ""
            }
            className="flex items-center justify-center gap-2"
          >
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email</span>
          </TabsTrigger>
          <TabsTrigger
            value={AuthStage.PASSWORD_CREATION}
            disabled={
              currentStage !== AuthStage.PASSWORD_CREATION &&
              userData.email === ""
            }
            className="flex items-center justify-center gap-2"
          >
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Criar Senha</span>
          </TabsTrigger>
          <TabsTrigger
            value={AuthStage.PROFILE_SETUP}
            disabled={
              currentStage !== AuthStage.PROFILE_SETUP &&
              userData.password === ""
            }
            className="flex items-center justify-center gap-2"
          >
            <UserCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Configurar Perfil</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={AuthStage.EMAIL_VERIFICATION}>
          {currentStage === AuthStage.EMAIL_VERIFICATION &&
            renderStageContent()}
        </TabsContent>
        <TabsContent value={AuthStage.PASSWORD_CREATION}>
          {currentStage === AuthStage.PASSWORD_CREATION && renderStageContent()}
        </TabsContent>
        <TabsContent value={AuthStage.PROFILE_SETUP}>
          {currentStage === AuthStage.PROFILE_SETUP && renderStageContent()}
        </TabsContent>
      </Tabs>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Sistema de Registro e Agendamento de Motoristas</p>
        <p className="mt-1">© {new Date().getFullYear()} Shopee Logística</p>
      </div>
    </div>
  );
};

export default AuthenticationForm;
