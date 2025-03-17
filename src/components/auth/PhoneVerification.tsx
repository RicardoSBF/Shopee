import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../ui/card";
import { Mail, Send, ArrowRight, CheckCircle } from "lucide-react";

interface EmailVerificationProps {
  onVerificationComplete?: (email: string) => void;
  initialEmail?: string;
  isLogin?: boolean;
}

const EmailVerification = ({
  onVerificationComplete = () => {},
  initialEmail = "",
  isLogin = false,
}: EmailVerificationProps) => {
  const [email, setEmail] = useState(initialEmail);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user already exists when component mounts or email changes
  useEffect(() => {
    const checkExistingUser = async () => {
      if (!email || !email.includes("@")) return;

      try {
        const { data } = await supabase
          .from("users")
          .select("email")
          .eq("email", email.toLowerCase())
          .single();

        if (data && !isLogin) {
          setError(
            "Este email já está cadastrado. Por favor, use outro email ou faça login.",
          );
        }
      } catch (error) {
        // User doesn't exist, do nothing
      }
    };

    if (email) {
      checkExistingUser();
    }
  }, [email, isLogin]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError(null);
  };

  const handleVerifyEmail = async () => {
    // Validate email (simple validation)
    if (!email || !email.includes("@")) {
      setError("Por favor, insira um email válido");
      return;
    }

    // Check if user already exists in Supabase for registration
    if (!isLogin) {
      try {
        const { data } = await supabase
          .from("users")
          .select("email")
          .eq("email", email.toLowerCase())
          .single();

        if (data) {
          setError(
            "Este email já está cadastrado. Por favor, use outro email ou faça login.",
          );
          return;
        }
      } catch (error) {
        // User doesn't exist, continue with registration
      }
    }

    setIsVerifying(true);

    // In a real implementation, this would verify the email
    // For now, we'll just simulate it
    setTimeout(() => {
      setIsVerifying(false);
      onVerificationComplete(email.toLowerCase());
    }, 1000);
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-white">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-center">
          {isLogin ? "Login" : "Cadastro"}
        </CardTitle>
        <CardDescription className="text-center">
          {isLogin
            ? "Digite seu email para acessar sua conta"
            : "Digite seu email para criar uma nova conta"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Mail className="text-gray-500" size={20} />
            <Input
              type="email"
              placeholder="Digite seu email"
              value={email}
              onChange={handleEmailChange}
              className="flex-1"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button
          onClick={handleVerifyEmail}
          disabled={isVerifying}
          className="w-full"
        >
          {isVerifying ? (
            "Verificando..."
          ) : (
            <>
              Continuar <ArrowRight className="ml-2" size={16} />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default EmailVerification;
