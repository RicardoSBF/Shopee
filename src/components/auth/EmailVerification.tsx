import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { AlertCircle, CheckCircle, Clock, Mail, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { parseISO } from "date-fns";

const EmailVerification = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Extrair email da URL se disponível
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [location]);

  // Contador regressivo para reenvio
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timerId = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearTimeout(timerId);
  }, [timeLeft]);

  // Enviar código de verificação
  const sendVerificationCode = async (emailToVerify: string) => {
    if (!emailToVerify) {
      setError("Por favor, informe um email válido.");
      return;
    }

    setIsResending(true);
    setError(null);

    try {
      // Verificar se o email já existe
      const { data: existingUsers, error: checkError } = await supabase
        .from("users")
        .select("email")
        .eq("email", emailToVerify);

      if (checkError) throw checkError;

      if (existingUsers && existingUsers.length > 0) {
        setError("Este email já está cadastrado. Tente fazer login.");
        setIsResending(false);
        return;
      }

      // Gerar código de 6 dígitos
      const verificationCode = Math.floor(
        100000 + Math.random() * 900000,
      ).toString();

      // Salvar código no banco com expiração de 10 minutos
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      const { error: insertError } = await supabase
        .from("email_verifications")
        .upsert([
          {
            email: emailToVerify,
            code: verificationCode,
            expires_at: expiresAt.toISOString(),
          },
        ]);

      if (insertError) throw insertError;

      // Em um ambiente real, enviaríamos um email aqui
      // Para fins de demonstração, mostraremos o código no console
      console.log(
        `Código de verificação para ${emailToVerify}: ${verificationCode}`,
      );

      // Mostrar toast com o código (apenas para demonstração)
      toast({
        title: "Código enviado",
        description: `Código: ${verificationCode} (apenas para demonstração)`,
        duration: 10000,
      });

      // Definir tempo para reenvio
      setTimeLeft(60);

      // Mostrar mensagem de sucesso
      toast({
        title: "Código enviado",
        description: "Um código de verificação foi enviado para seu email.",
      });
    } catch (error) {
      console.error("Erro ao enviar código:", error);
      setError(
        "Não foi possível enviar o código de verificação. Tente novamente.",
      );
    } finally {
      setIsResending(false);
    }
  };

  // Verificar código
  const verifyCode = async () => {
    if (!email || !code) {
      setError("Por favor, preencha todos os campos.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Buscar o código de verificação no banco
      const { data, error } = await supabase
        .from("email_verifications")
        .select("*")
        .eq("email", email)
        .eq("code", code)
        .single();

      if (error) throw error;

      if (!data) {
        setError("Código inválido. Verifique e tente novamente.");
        return;
      }

      // Verificar se o código expirou
      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        setError("Este código expirou. Solicite um novo código.");
        return;
      }

      // Código válido, marcar como verificado
      setSuccess(true);

      // Mostrar mensagem de sucesso
      toast({
        title: "Email verificado",
        description: "Seu email foi verificado com sucesso!",
        variant: "default",
      });

      // Redirecionar para a próxima etapa (criação de senha)
      setTimeout(() => {
        navigate(`/password-creation?email=${encodeURIComponent(email)}`);
      }, 1500);
    } catch (error) {
      console.error("Erro ao verificar código:", error);
      setError("Não foi possível verificar o código. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Verificação de Email
          </CardTitle>
          <CardDescription className="text-center">
            Digite o código de verificação enviado para seu email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                className="pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || success}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="code">Código de Verificação</Label>
              <Button
                variant="link"
                size="sm"
                className="px-0 h-auto font-normal text-xs"
                disabled={
                  isResending || timeLeft > 0 || !email || isLoading || success
                }
                onClick={() => sendVerificationCode(email)}
              >
                {timeLeft > 0 ? (
                  <span className="flex items-center">
                    <Clock className="mr-1 h-3 w-3" />
                    Reenviar em {timeLeft}s
                  </span>
                ) : (
                  <span className="flex items-center">
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Enviar código
                  </span>
                )}
              </Button>
            </div>
            <Input
              id="code"
              placeholder="Digite o código de 6 dígitos"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              maxLength={6}
              disabled={isLoading || success}
              className="text-center text-lg tracking-widest font-mono"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-3 rounded-md flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-3 rounded-md flex items-start">
              <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm">
                Email verificado com sucesso! Redirecionando...
              </span>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            className="w-full bg-orange-500 hover:bg-orange-600"
            onClick={verifyCode}
            disabled={
              !email || !code || code.length < 6 || isLoading || success
            }
          >
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              "Verificar Email"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default EmailVerification;
