import React, { useState } from "react";
import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";
import { motion } from "framer-motion";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const emailSchema = z.string().email({
  message: "Por favor, insira um email válido",
});

const passwordSchema = z.string().min(5, {
  message: "A senha deve ter pelo menos 5 dígitos",
});

interface ModernLoginFormProps {
  onAuthComplete?: (userData: { email: string; password: string }) => void;
}

const ModernLoginForm = ({
  onAuthComplete = () => {},
}: ModernLoginFormProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateEmail = (email: string) => {
    try {
      emailSchema.parse(email);
      setEmailError("");
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setEmailError(error.errors[0].message);
      }
      return false;
    }
  };

  const validatePassword = (password: string) => {
    try {
      passwordSchema.parse(password);
      setPasswordError("");
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setPasswordError(error.errors[0].message);
      }
      return false;
    }
  };

  const validateConfirmPassword = (
    password: string,
    confirmPassword: string,
  ) => {
    if (password !== confirmPassword) {
      setConfirmPasswordError("As senhas não coincidem");
      return false;
    }
    setConfirmPasswordError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    if (!isLogin) {
      const isConfirmPasswordValid = validateConfirmPassword(
        password,
        confirmPassword,
      );
      if (!isConfirmPasswordValid) {
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        // Login flow
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("email", email)
          .eq("password", password);

        if (error || !data || data.length === 0) {
          setPasswordError("Email ou senha incorretos");
          setIsLoading(false);
          return;
        }

        // Login successful
        onAuthComplete({ email, password });
      } else {
        // Registration flow
        // Check if email exists
        const { data: existingUsers } = await supabase
          .from("users")
          .select("email")
          .eq("email", email);

        if (existingUsers && existingUsers.length > 0) {
          setEmailError("Este email já está cadastrado");
          setIsLoading(false);
          return;
        }

        // Create new user
        const { error } = await supabase.from("users").insert([
          {
            email: email,
            phone_number: email, // For backward compatibility
            password: password,
            is_admin: email === "admincb@shopee.com" && password === "123456",
            full_name: "",
            id_number: "",
          },
        ]);

        if (error) {
          console.error("Erro ao criar usuário:", error);
          setEmailError("Erro ao criar usuário: " + error.message);
          setIsLoading(false);
          return;
        }

        // Registration successful
        sessionStorage.setItem("isNewLogin", "true");
        onAuthComplete({ email, password });
      }
    } catch (error) {
      console.error("Erro:", error);
      setPasswordError("Ocorreu um erro. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600 dark:from-orange-600 dark:to-orange-800 z-50">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl"
      >
        <div className="flex items-center justify-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <h1 className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              Shopee Logística
            </h1>
          </motion.div>
        </div>

        <motion.h2
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-3xl font-bold text-center text-orange-600 dark:text-orange-400 mb-8"
        >
          {isLogin ? "Bem-vindo de volta!" : "Crie sua conta"}
        </motion.h2>

        <div className="flex mb-8 bg-gray-100 dark:bg-gray-700 p-1 rounded-full">
          <button
            className={`flex-1 py-2 px-4 rounded-full transition-all duration-300 ${isLogin ? "bg-orange-500 text-white font-bold shadow-md" : "text-gray-600 dark:text-gray-300"}`}
            onClick={() => setIsLogin(true)}
          >
            Entrar
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-full transition-all duration-300 ${!isLogin ? "bg-orange-500 text-white font-bold shadow-md" : "text-gray-600 dark:text-gray-300"}`}
            onClick={() => setIsLogin(false)}
          >
            Registrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 dark:text-gray-200 font-medium mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-700 outline-none transition-all duration-300"
                placeholder="seu.email@exemplo.com"
              />
            </div>
            {emailError && (
              <p className="text-red-500 dark:text-red-400 text-sm mt-1">
                {emailError}
              </p>
            )}
          </div>

          <div>
            <label className="block text-gray-700 dark:text-gray-200 font-medium mb-2">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-700 outline-none transition-all duration-300"
                placeholder="Sua senha"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            {passwordError && (
              <p className="text-red-500 dark:text-red-400 text-sm mt-1">
                {passwordError}
              </p>
            )}
          </div>

          {!isLogin && (
            <div>
              <label className="block text-gray-700 dark:text-gray-200 font-medium mb-2">
                Confirme sua senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-10 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-700 outline-none transition-all duration-300"
                  placeholder="Confirme sua senha"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {confirmPasswordError && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">
                  {confirmPasswordError}
                </p>
              )}
            </div>
          )}

          {isLogin && (
            <div className="text-right">
              <a
                href="#"
                className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 text-sm font-medium"
              >
                Esqueceu sua senha?
              </a>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full py-6 h-auto bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] duration-300"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processando...
              </span>
            ) : isLogin ? (
              "Entrar"
            ) : (
              "Criar conta"
            )}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>© {new Date().getFullYear()} Shopee Logística</p>
          <p className="mt-1">
            Sistema de Registro e Agendamento de Motoristas
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default ModernLoginForm;
