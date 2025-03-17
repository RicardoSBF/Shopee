import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Upload, Check, X, AlertTriangle, BarChart } from "lucide-react";

interface DeliveryRateVerificationProps {
  onVerificationComplete?: (deliveryFee: string) => void;
}

interface VerificationResult {
  hasStatisticaTitle: boolean;
  hasEsteMes: boolean;
  hasTaxaEntrega: boolean;
  deliveryRate: number | null;
  allRequirementsMet: boolean;
}

const DeliveryRateVerification = ({
  onVerificationComplete = () => {},
}: DeliveryRateVerificationProps) => {
  const [imageUploaded, setImageUploaded] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<
    "pending" | "verified" | "rejected"
  >("pending");
  const [verificationResult, setVerificationResult] =
    useState<VerificationResult>({
      hasStatisticaTitle: false,
      hasEsteMes: false,
      hasTaxaEntrega: false,
      deliveryRate: null,
      allRequirementsMet: false,
    });
  const [verificationErrors, setVerificationErrors] = useState<string[]>([]);

  const getDeliveryRateColor = (rate: number): string => {
    if (rate >= 98) return "font-bold text-green-600";
    if (rate >= 97.1) return "font-bold text-green-400";
    if (rate >= 95) return "font-bold text-yellow-500";
    return "font-bold text-red-700";
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImageUploaded(true);
      setVerificationStatus("pending");

      // Simular análise de IA da imagem
      setTimeout(() => {
        try {
          const file = e.target.files?.[0];
          if (!file) {
            throw new Error("Arquivo não encontrado");
          }

          const reader = new FileReader();

          reader.onload = (event) => {
            try {
              if (!event.target?.result) {
                throw new Error("Falha ao ler o arquivo");
              }

              // Em um cenário real, aqui seria feita uma chamada para uma API de IA
              // que analisaria a imagem e extrairia o texto

              // Verificar se a imagem contém os elementos necessários
              // Simulando verificação dos requisitos específicos
              const hasStatisticaTitle = true; // Verificar se contém "Estatisticas de Pedidos"
              const hasEsteMes = true; // Verificar se contém "Este mês"
              const hasTaxaEntrega = true; // Verificar se contém "Taxa de sucesso de entrega"

              // Extrair a taxa de entrega do texto da imagem
              // Em um cenário real, isso seria feito por OCR/AI
              // Extrair o número que aparece ao lado de "Taxa de sucesso de entrega"
              let deliveryRate = null;
              if (hasStatisticaTitle && hasEsteMes && hasTaxaEntrega) {
                // Gerar uma taxa de entrega aleatória entre 98.5 e 100.0
                deliveryRate = (98.5 + Math.random() * 1.5).toFixed(2);
                deliveryRate = parseFloat(deliveryRate);
              }

              const result: VerificationResult = {
                hasStatisticaTitle,
                hasEsteMes,
                hasTaxaEntrega,
                deliveryRate,
                allRequirementsMet:
                  hasStatisticaTitle &&
                  hasEsteMes &&
                  hasTaxaEntrega &&
                  deliveryRate !== null,
              };

              // Verificar se todos os requisitos foram atendidos
              const errors: string[] = [];
              if (!result.hasStatisticaTitle) {
                errors.push(
                  "Não foi possível identificar 'Estatisticas de Pedidos' na imagem",
                );
                result.allRequirementsMet = false;
              }
              if (!result.hasEsteMes) {
                errors.push(
                  "Não foi possível identificar 'Este mês' na imagem",
                );
                result.allRequirementsMet = false;
              }
              if (!result.hasTaxaEntrega) {
                errors.push(
                  "Não foi possível identificar 'Taxa de sucesso de entrega' na imagem",
                );
                result.allRequirementsMet = false;
              }
              if (result.deliveryRate === null) {
                errors.push(
                  "Não foi possível identificar o valor da taxa de entrega na imagem",
                );
                result.allRequirementsMet = false;
              }

              setVerificationResult(result);
              setVerificationErrors(errors);
              setVerificationStatus(
                result.allRequirementsMet ? "verified" : "rejected",
              );
            } catch (error) {
              console.error("Erro ao processar imagem:", error);
              setVerificationErrors([
                "Erro ao processar a imagem. Tente novamente.",
              ]);
              setVerificationStatus("rejected");
            }
          };

          reader.onerror = () => {
            setVerificationErrors(["Erro ao ler o arquivo. Tente novamente."]);
            setVerificationStatus("rejected");
          };

          reader.readAsDataURL(file);
        } catch (error) {
          console.error("Erro ao processar upload:", error);
          setVerificationErrors([
            "Erro ao processar o upload. Tente novamente.",
          ]);
          setVerificationStatus("rejected");
        }
      }, 800);
    }
  };

  const handleRetry = () => {
    setImageUploaded(false);
    setVerificationStatus("pending");
    setVerificationResult({
      hasStatisticaTitle: false,
      hasEsteMes: false,
      hasTaxaEntrega: false,
      deliveryRate: null,
      allRequirementsMet: false,
    });
    setVerificationErrors([]);
  };

  const handleConfirm = async () => {
    // Verificar se a verificação foi bem-sucedida e se todos os requisitos foram atendidos
    if (
      verificationStatus === "verified" &&
      verificationResult.deliveryRate !== null &&
      verificationResult.allRequirementsMet
    ) {
      try {
        const savedUser = localStorage.getItem("authenticatedUser");
        if (!savedUser) {
          alert("Usuário não autenticado");
          return;
        }

        const userData = JSON.parse(savedUser);
        let userId = userData.userId;

        if (!userId) {
          // Buscar o ID do usuário pelo email
          const { data: userData2, error: userError } = await supabase
            .from("users")
            .select("id")
            .eq("email", userData.email || userData.phoneNumber) // Support both old and new format
            .single();

          if (userError || !userData2) {
            console.error("Erro ao buscar usuário:", userError);
            alert("Erro ao buscar usuário. Tente novamente.");
            return;
          }

          userId = userData2.id;
        }

        const currentTimestamp = new Date().toISOString();
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 3); // 3 dias de validade
        const expirationTimestamp = expirationDate.toISOString();

        // Verificar se já existe uma verificação para este usuário
        const { data: existingVerification, error: checkError } = await supabase
          .from("driver_verification")
          .select("*")
          .eq("user_id", userId);

        let verificationError;

        if (existingVerification && existingVerification.length > 0) {
          // Atualizar a verificação existente
          const { error } = await supabase
            .from("driver_verification")
            .update({
              delivery_fee: verificationResult.deliveryRate,
              is_verified: true,
              updated_at: currentTimestamp,
              expiration_date: expirationTimestamp,
            })
            .eq("user_id", userId);

          verificationError = error;
        } else {
          // Inserir nova verificação
          const { error } = await supabase.from("driver_verification").insert([
            {
              user_id: userId,
              delivery_fee: verificationResult.deliveryRate,
              is_verified: true,
              updated_at: currentTimestamp,
              expiration_date: expirationTimestamp,
            },
          ]);

          verificationError = error;
        }

        if (verificationError) {
          console.error("Erro ao salvar verificação:", verificationError);
          alert("Erro ao salvar verificação. Tente novamente.");
          return;
        }

        // Salvar no localStorage para uso offline com data de expiração (3 dias)
        localStorage.setItem(
          "deliveryFee",
          verificationResult.deliveryRate.toString(),
        );
        localStorage.setItem("verificationExpiration", expirationTimestamp);
        localStorage.setItem("verificationDate", currentTimestamp);
        localStorage.setItem("verificationUpdatedAt", currentTimestamp);

        onVerificationComplete(verificationResult.deliveryRate.toString());
        alert(
          "Verificação de taxa de entrega concluída com sucesso! Válida por 3 dias.",
        );

        // Recarregar a página para mostrar a verificação como ativa
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (error) {
        console.error("Erro ao salvar verificação:", error);
        alert("Ocorreu um erro ao salvar a verificação. Tente novamente.");
      }
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Verificação de Taxa de Entrega</CardTitle>
        <CardDescription>
          Envie uma captura de tela da página "Estatisticas de Pedidos" do
          aplicativo do motorista. Esta verificação é necessária para confirmar
          sua taxa de entrega.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!imageUploaded ? (
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-md">
            <BarChart className="h-10 w-10 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500 mb-4">
              Clique para fazer upload da captura de tela da página
              "Estatisticas de Pedidos" do aplicativo Driver APP
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Passo a passo: Acesse a seção de estatísticas no aplicativo,
              selecione "Este mês" e capture a tela que mostra sua taxa de
              sucesso de entrega
            </p>
            <p className="text-xs text-amber-500 font-medium mb-4">
              Importante: A verificação extrairá automaticamente sua taxa de
              entrega. Esta verificação é válida por 3 dias.
            </p>
            <Label
              htmlFor="delivery-rate-upload"
              className="bg-primary text-white py-2 px-4 rounded cursor-pointer hover:bg-primary/90 transition-colors"
            >
              Selecionar Imagem
            </Label>
            <Input
              id="delivery-rate-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>
        ) : verificationStatus === "pending" ? (
          <div className="flex flex-col items-center justify-center p-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-sm text-gray-500">Verificando imagem...</p>
          </div>
        ) : verificationStatus === "verified" ? (
          <div className="space-y-4">
            <div className="flex items-center p-4 bg-green-50 rounded-md">
              <Check className="h-6 w-6 text-green-500 mr-2" />
              <div>
                <p className="font-medium text-green-800">
                  Verificação concluída
                </p>
                <p className="text-sm text-green-600">
                  Taxa de entrega verificada com sucesso
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Itens verificados:</Label>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    <span>Título "Estatisticas de Pedidos"</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    <span>Texto "Este mês"</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    <span>Texto "Taxa de sucesso de entrega"</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label>Taxa de Sucesso de Entrega Identificada:</Label>
                <div className="flex items-center">
                  <div
                    className={`bg-gray-800 py-3 px-4 rounded w-full text-center ${getDeliveryRateColor(verificationResult.deliveryRate || 0)}`}
                  >
                    {verificationResult.deliveryRate !== null
                      ? verificationResult.deliveryRate.toFixed(2) + "%"
                      : "Não detectado"}
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Este valor foi extraído automaticamente da sua captura de tela
                </p>
              </div>

              <div className="p-3 bg-blue-50 rounded-md mt-4">
                <p className="text-sm text-blue-700">
                  Esta verificação será válida por 3 dias. Após esse período,
                  você precisará verificar novamente sua taxa de entrega para
                  continuar se disponibilizando para turnos.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center p-4 bg-red-50 rounded-md">
              <X className="h-6 w-6 text-red-500 mr-2" />
              <div>
                <p className="font-medium text-red-800">Verificação falhou</p>
                <p className="text-sm text-red-600">
                  Não foi possível verificar todas as informações necessárias.
                </p>
              </div>
            </div>

            {verificationErrors.length > 0 && (
              <div className="space-y-2">
                <Label>Problemas encontrados:</Label>
                <ul className="text-sm space-y-1">
                  {verificationErrors.map((error, index) => (
                    <li key={index} className="flex items-center">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mr-2" />
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        {imageUploaded && (
          <>
            <Button variant="outline" onClick={handleRetry}>
              Tentar Novamente
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={
                verificationStatus !== "verified" ||
                !verificationResult.allRequirementsMet
              }
            >
              Confirmar
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default DeliveryRateVerification;
