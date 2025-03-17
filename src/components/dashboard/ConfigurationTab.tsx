import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Save,
  Lock,
  User,
  MapPin,
  Upload,
  Clock,
  AlertTriangle,
} from "lucide-react";
import DriverAppVerification from "./DriverAppVerification";
import DeliveryRateVerification from "./DeliveryRateVerification";

interface ConfigurationTabProps {
  userName?: string;
  userID?: string;
  primaryRegion?: string;
  backupRegions?: string[];
}

const profileFormSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Nome deve ter pelo menos 2 caracteres." }),
  id: z.string().min(5, { message: "ID deve ter pelo menos 5 caracteres." }),
  vehicleType: z.string().optional(),
  vehiclePlate: z.string().optional(),
});

const passwordFormSchema = z
  .object({
    currentPassword: z
      .string()
      .min(5, { message: "A senha deve ter pelo menos 5 dígitos." }),
    newPassword: z
      .string()
      .min(5, { message: "A senha deve ter pelo menos 5 dígitos." }),
    confirmPassword: z
      .string()
      .min(5, { message: "A senha deve ter pelo menos 5 dígitos." }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

const ConfigurationTab = ({
  userName = "John Driver",
  userID = "DRV12345",
  primaryRegion = "",
  backupRegions = [],
}: ConfigurationTabProps) => {
  const [activeTab, setActiveTab] = useState(() => {
    // Try to get the saved tab from localStorage
    const savedTab = localStorage.getItem("configActiveTab");
    return savedTab || "profile";
  });

  const [selectedPrimaryRegion, setSelectedPrimaryRegion] = useState("");
  const [selectedBackupRegions, setSelectedBackupRegions] = useState<string[]>(
    [],
  );
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState<string | null>(
    null,
  );
  const [configIssues, setConfigIssues] = useState<string[]>([]);

  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: userName,
      id: userID,
      vehicleType: "",
      vehiclePlate: "",
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Verificar se as configurações foram preenchidas e se a verificação não expirou
  useEffect(() => {
    // Limpar dados de usuário anterior se for um novo login
    const isNewLogin = sessionStorage.getItem("isNewLogin");
    if (isNewLogin === "true") {
      // Limpar todos os dados do localStorage para o novo usuário
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

      profileForm.reset({
        name: "",
        id: "",
        vehicleType: "",
        vehiclePlate: "",
      });
      sessionStorage.removeItem("isNewLogin");
    }
    const checkConfigurationIssues = () => {
      const issues: string[] = [];

      // Check if regions are configured
      const userRegions = localStorage.getItem("userRegions");
      if (!userRegions) {
        issues.push("Regiões não configuradas");
      }

      // Verificar status da verificação de identidade - agora é obrigatório
      const driverAppVerified = localStorage.getItem("driverAppVerified");
      const driverVerificationExpiration = localStorage.getItem(
        "driverVerificationExpiration",
      );

      if (driverAppVerified !== "true") {
        issues.push("Verificação de identidade pendente");
      } else if (driverVerificationExpiration) {
        const expirationDate = new Date(driverVerificationExpiration);
        const now = new Date();
        const daysUntilExpiration = Math.ceil(
          (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (now > expirationDate) {
          issues.push("Verificação de identidade expirada");
          // Remover verificação expirada
          localStorage.removeItem("driverAppVerified");
        } else if (daysUntilExpiration <= 3) {
          issues.push(
            `Verificação de identidade expira em ${daysUntilExpiration} dia(s)`,
          );
        }
      }

      // Verificar status da verificação de taxa de entrega
      const deliveryFee = localStorage.getItem("deliveryFee");
      const verificationExpiration = localStorage.getItem(
        "verificationExpiration",
      );

      if (!deliveryFee) {
        issues.push("Verificação de taxa de entrega pendente");
      } else if (verificationExpiration) {
        const expirationDate = new Date(verificationExpiration);
        const now = new Date();
        const daysUntilExpiration = Math.ceil(
          (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (now > expirationDate) {
          issues.push("Verificação de taxa de entrega expirada");
          // Remover verificação expirada
          localStorage.removeItem("deliveryFee");
        } else if (daysUntilExpiration <= 1) {
          issues.push(
            `Verificação de taxa expira em ${daysUntilExpiration} dia`,
          );
        }
      }

      setConfigIssues(issues);
    };

    checkConfigurationIssues();

    // Check less frequently for changes to improve performance
    const interval = setInterval(checkConfigurationIssues, 300000); // Check every 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("configActiveTab", activeTab);
  }, [activeTab]);

  // Check for updates to verification status
  useEffect(() => {
    const checkVerificationUpdates = () => {
      const verificationUpdatedAt = localStorage.getItem(
        "verificationUpdatedAt",
      );
      if (
        verificationUpdatedAt &&
        verificationUpdatedAt !== lastUpdateTimestamp
      ) {
        setLastUpdateTimestamp(verificationUpdatedAt);
      }
    };

    // Check immediately and then set up interval
    checkVerificationUpdates();
    const intervalId = setInterval(checkVerificationUpdates, 30000); // Check every 30 seconds

    return () => clearInterval(intervalId);
  }, [lastUpdateTimestamp]);

  // Função mantida apenas para compatibilidade, mas não é mais usada
  const onProfileSubmit = async (data: z.infer<typeof profileFormSchema>) => {
    alert(
      "Os dados do perfil só podem ser atualizados via verificação do Driver APP na aba Verificação.",
    );
  };

  const onPasswordSubmit = async (data: z.infer<typeof passwordFormSchema>) => {
    try {
      const savedUser = localStorage.getItem("authenticatedUser");
      if (!savedUser) {
        alert("Usuário não autenticado");
        return;
      }

      const userData = JSON.parse(savedUser);
      const userEmail = userData.email || userData.phoneNumber;

      // Verificar senha atual
      const { data: userCheck, error: checkError } = await supabase
        .from("users")
        .select("id, password")
        .eq("email", userEmail)
        .eq("password", data.currentPassword)
        .single();

      if (checkError || !userCheck) {
        alert("Senha atual incorreta. Por favor, tente novamente.");
        return;
      }

      const currentTimestamp = new Date().toISOString();

      // Atualizar a senha
      const { error: updateError } = await supabase
        .from("users")
        .update({
          password: data.newPassword,
          updated_at: currentTimestamp,
        })
        .eq("id", userCheck.id);

      if (updateError) {
        console.error("Erro ao atualizar senha:", updateError);
        alert("Erro ao atualizar senha. Tente novamente.");
        return;
      }

      // Atualizar no localStorage
      userData.password = data.newPassword;
      userData.updatedAt = currentTimestamp;
      localStorage.setItem("authenticatedUser", JSON.stringify(userData));
      localStorage.setItem("passwordUpdatedAt", currentTimestamp);
      setLastUpdateTimestamp(currentTimestamp);

      alert("Senha atualizada com sucesso!");
      passwordForm.reset();
    } catch (error) {
      console.error("Erro ao atualizar senha:", error);
      alert("Ocorreu um erro ao atualizar a senha. Tente novamente.");
    }
  };

  // Carregar dados do usuário e regiões do Supabase
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const savedUser = localStorage.getItem("authenticatedUser");
        if (!savedUser) return;

        const userData = JSON.parse(savedUser);
        const userEmail = userData.email || userData.phoneNumber;

        // Primeiro verificar se há dados no localStorage para resposta imediata
        const savedProfileData = localStorage.getItem("profileData");
        if (savedProfileData) {
          const profileData = JSON.parse(savedProfileData);
          if (profileData.fullName)
            profileForm.setValue("name", profileData.fullName);
          if (profileData.idNumber)
            profileForm.setValue("id", profileData.idNumber);
          if (profileData.vehicleType)
            profileForm.setValue("vehicleType", profileData.vehicleType);
          if (profileData.vehiclePlate)
            profileForm.setValue("vehiclePlate", profileData.vehiclePlate);
          if (profileData.updatedAt)
            setLastUpdateTimestamp(profileData.updatedAt);
        }

        // Carregar dados do veículo do localStorage
        const vehicleType = localStorage.getItem("vehicleType");
        const vehiclePlate = localStorage.getItem("vehiclePlate");
        const extractedName = localStorage.getItem("extractedName");
        const extractedID = localStorage.getItem("extractedID");

        if (extractedName) profileForm.setValue("name", extractedName);
        if (extractedID) profileForm.setValue("id", extractedID);
        if (vehicleType) profileForm.setValue("vehicleType", vehicleType);
        if (vehiclePlate) profileForm.setValue("vehiclePlate", vehiclePlate);

        // Buscar dados do usuário do Supabase como backup
        const { data: userProfile, error: userError } = await supabase
          .from("users")
          .select("full_name, id_number, updated_at")
          .eq("email", userEmail)
          .single();

        if (!userError && userProfile) {
          // Só atualizar se não tiver dados no localStorage
          if (!extractedName && userProfile.full_name) {
            profileForm.setValue("name", userProfile.full_name);
          }
          if (!extractedID && userProfile.id_number) {
            profileForm.setValue("id", userProfile.id_number);
          }

          if (
            userProfile.updated_at &&
            (!lastUpdateTimestamp ||
              new Date(userProfile.updated_at) > new Date(lastUpdateTimestamp))
          ) {
            setLastUpdateTimestamp(userProfile.updated_at);
          }
        }

        // Buscar regiões do usuário
        const { data: userData2, error: idError } = await supabase
          .from("users")
          .select("id")
          .eq("email", userEmail)
          .single();

        if (idError || !userData2) return;

        // Verificar primeiro se há dados no localStorage
        const savedRegions = localStorage.getItem("userRegions");
        if (savedRegions) {
          const regions = JSON.parse(savedRegions);
          setSelectedPrimaryRegion(regions.primaryRegion || "");
          setSelectedBackupRegions(regions.backupRegions || []);

          if (
            regions.updatedAt &&
            (!lastUpdateTimestamp ||
              new Date(regions.updatedAt) > new Date(lastUpdateTimestamp))
          ) {
            setLastUpdateTimestamp(regions.updatedAt);
          }
        }

        // Buscar do Supabase como backup
        const { data: regionsData, error: regionsError } = await supabase
          .from("regions")
          .select("primary_region, backup_regions, updated_at")
          .eq("user_id", userData2.id)
          .single();

        if (!regionsError && regionsData) {
          // Só atualizar se não tiver dados no localStorage
          if (!savedRegions) {
            setSelectedPrimaryRegion(regionsData.primary_region || "");
            setSelectedBackupRegions(regionsData.backup_regions || []);

            // Salvar no localStorage para uso offline
            localStorage.setItem(
              "userRegions",
              JSON.stringify({
                primaryRegion: regionsData.primary_region || "",
                backupRegions: regionsData.backup_regions || [],
                updatedAt: regionsData.updated_at || new Date().toISOString(),
              }),
            );
          }

          if (
            regionsData.updated_at &&
            (!lastUpdateTimestamp ||
              new Date(regionsData.updated_at) > new Date(lastUpdateTimestamp))
          ) {
            setLastUpdateTimestamp(regionsData.updated_at);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados do usuário:", error);
      }
    };

    loadUserData();

    // Configurar verificação periódica para atualizações em tempo real - otimizado
    const intervalId = setInterval(loadUserData, 180000); // Verificar a cada 3 minutos para reduzir carga
    return () => clearInterval(intervalId);
  }, [profileForm]);

  const onRegionsSubmit = async () => {
    try {
      if (!selectedPrimaryRegion) {
        alert("Por favor, selecione uma região principal.");
        return;
      }

      if (selectedBackupRegions.length < 3) {
        alert("Por favor, selecione 3 regiões de backup.");
        return;
      }

      const savedUser = localStorage.getItem("authenticatedUser");
      if (!savedUser) {
        alert("Usuário não autenticado");
        return;
      }

      const userData = JSON.parse(savedUser);
      const userEmail = userData.email || userData.phoneNumber;

      // Mostrar indicador de carregamento
      const saveButton = document.querySelector("#save-regions-button");
      if (saveButton) {
        saveButton.setAttribute("disabled", "true");
        saveButton.textContent = "Salvando...";
      }

      try {
        // Buscar o ID do usuário pelo email
        const { data: userData2, error: userError } = await supabase
          .from("users")
          .select("id")
          .eq("email", userEmail)
          .single();

        if (userError || !userData2) {
          throw new Error(
            "Erro ao buscar usuário: " +
              (userError?.message || "Usuário não encontrado"),
          );
        }

        // Verificar se já existe um registro de regiões para este usuário
        const { data: existingRegions, error: checkError } = await supabase
          .from("regions")
          .select("id")
          .eq("user_id", userData2.id);

        if (checkError) {
          throw new Error(
            "Erro ao verificar regiões existentes: " + checkError.message,
          );
        }

        let regionsError;
        const currentTimestamp = new Date().toISOString();

        if (existingRegions && existingRegions.length > 0) {
          // Atualizar as regiões existentes
          const { error } = await supabase
            .from("regions")
            .update({
              primary_region: selectedPrimaryRegion,
              backup_regions: selectedBackupRegions,
              updated_at: currentTimestamp,
            })
            .eq("user_id", userData2.id);

          regionsError = error;
        } else {
          // Inserir novas regiões
          const { error } = await supabase.from("regions").insert([
            {
              user_id: userData2.id,
              primary_region: selectedPrimaryRegion,
              backup_regions: selectedBackupRegions,
              updated_at: currentTimestamp,
            },
          ]);

          regionsError = error;
        }

        if (regionsError) {
          throw new Error("Erro ao salvar regiões: " + regionsError.message);
        }

        // Salvar no localStorage para persistência
        localStorage.setItem(
          "userRegions",
          JSON.stringify({
            primaryRegion: selectedPrimaryRegion,
            backupRegions: selectedBackupRegions,
            updatedAt: currentTimestamp,
          }),
        );

        // Atualizar o timestamp da última atualização
        localStorage.setItem("regionsUpdatedAt", currentTimestamp);
        setLastUpdateTimestamp(currentTimestamp);

        alert("Configurações de região salvas com sucesso!");

        // Restaurar o botão
        if (saveButton) {
          saveButton.removeAttribute("disabled");
          saveButton.innerHTML =
            '<svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Salvar Preferências de Região';
        }

        // Atualizar a interface sem recarregar a página
        setActiveTab("regions");
      } catch (dbError) {
        console.error("Erro de banco de dados:", dbError);
        alert(
          dbError instanceof Error
            ? dbError.message
            : "Erro ao salvar regiões. Tente novamente.",
        );

        // Restaurar o botão em caso de erro
        if (saveButton) {
          saveButton.removeAttribute("disabled");
          saveButton.innerHTML =
            '<svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Salvar Preferências de Região';
        }
      }
    } catch (error) {
      console.error("Erro ao salvar regiões:", error);
      alert("Ocorreu um erro ao salvar as regiões. Tente novamente.");
    }
  };

  return (
    <div className="w-full h-full p-6 bg-background">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Configuração</h1>

        {lastUpdateTimestamp && (
          <div className="mb-4 p-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600 flex items-center">
            <Clock className="h-4 w-4 mr-2 text-gray-500" />
            Última atualização: {new Date(lastUpdateTimestamp).toLocaleString()}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Informações do Perfil
            </TabsTrigger>
            <TabsTrigger value="password" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Alterar Senha
            </TabsTrigger>
            <TabsTrigger value="regions" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Atualizar Regiões
            </TabsTrigger>
            <TabsTrigger
              value="verification"
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Verificação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Perfil</CardTitle>
                <CardDescription>
                  Atualize suas informações de forma correta para ser escalado!
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <div className="space-y-6">
                    <FormField
                      control={profileForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Completo</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Digite seu nome completo"
                              {...field}
                              disabled={true}
                            />
                          </FormControl>
                          <FormDescription>
                            Este é seu nome completo como aparece em seu
                            documento de identidade. Este campo só pode ser
                            atualizado via verificação do Driver APP.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Identificação</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Digite seu número de identificação"
                              {...field}
                              disabled={true}
                            />
                          </FormControl>
                          <FormDescription>
                            Seu número de identificação oficial. Este campo só
                            pode ser atualizado via verificação do Driver APP.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="vehicleType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Veículo</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Tipo de veículo"
                              {...field}
                              disabled={true}
                            />
                          </FormControl>
                          <FormDescription>
                            Tipo do seu veículo. Este campo só pode ser
                            atualizado via verificação do Driver APP.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="vehiclePlate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Placa do Veículo</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Placa do veículo"
                              {...field}
                              disabled={true}
                            />
                          </FormControl>
                          <FormDescription>
                            Placa do seu veículo. Este campo só pode ser
                            atualizado via verificação do Driver APP.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-md mb-4">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      <p className="text-sm text-amber-700">
                        Para atualizar seus dados de identificação e veículo,
                        utilize a verificação via Driver APP na aba Verificação.
                      </p>
                    </div>
                  </div>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Alterar Senha</CardTitle>
                <CardDescription>
                  Atualize sua senha. A senha deve ter pelo menos 5 dígitos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form
                    onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
                    className="space-y-6"
                  >
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha Atual</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Digite a senha atual"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nova Senha</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Digite a nova senha"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            A senha deve ter pelo menos 5 dígitos.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmar Nova Senha</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Confirme a nova senha"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full sm:w-auto">
                      <Save className="mr-2 h-4 w-4" />
                      Atualizar Senha
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="regions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Atualizar Regiões</CardTitle>
                <CardDescription>
                  Selecione sua região principal e até 3 regiões de backup onde
                  você está disponível para trabalhar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Região Principal
                    </label>
                    <Select
                      value={selectedPrimaryRegion}
                      onValueChange={(value) => {
                        setSelectedPrimaryRegion(value);

                        // Se a região principal estiver nas regiões de backup, remova-a
                        if (selectedBackupRegions.includes(value)) {
                          setSelectedBackupRegions(
                            selectedBackupRegions.filter((r) => r !== value),
                          );
                        }
                      }}
                    >
                      <SelectTrigger
                        id="primary-region-select"
                        className="w-full"
                      >
                        <SelectValue placeholder="Selecione a região principal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ARARICA">ARARICA</SelectItem>
                        <SelectItem value="BOM PRINCIPIO">
                          BOM PRINCIPIO
                        </SelectItem>
                        <SelectItem value="CAMPO BOM">CAMPO BOM</SelectItem>
                        <SelectItem value="CAPELA DE SANTANA">
                          CAPELA DE SANTANA
                        </SelectItem>
                        <SelectItem value="DOIS IRMAOS">DOIS IRMAOS</SelectItem>
                        <SelectItem value="ESTANCIA VELHA">
                          ESTANCIA VELHA
                        </SelectItem>
                        <SelectItem value="ESTEIO">ESTEIO</SelectItem>
                        <SelectItem value="HARMONIA">HARMONIA</SelectItem>
                        <SelectItem value="IGREJINHA">IGREJINHA</SelectItem>
                        <SelectItem value="IVOTI">IVOTI</SelectItem>
                        <SelectItem value="LINDOLFO COLLOR">
                          LINDOLFO COLLOR
                        </SelectItem>
                        <SelectItem value="MONTENEGRO">MONTENEGRO</SelectItem>
                        <SelectItem value="MORRO REUTER">
                          MORRO REUTER
                        </SelectItem>
                        <SelectItem value="NOVA HARTZ">NOVA HARTZ</SelectItem>
                        <SelectItem value="NOVO HAMBURGO">
                          NOVO HAMBURGO
                        </SelectItem>
                        <SelectItem value="PARECI NOVO">PARECI NOVO</SelectItem>
                        <SelectItem value="PAROBE">PAROBE</SelectItem>
                        <SelectItem value="PICADA CAFE">PICADA CAFE</SelectItem>
                        <SelectItem value="PORTAO">PORTAO</SelectItem>
                        <SelectItem value="PRESIDENTE LUCENA">
                          PRESIDENTE LUCENA
                        </SelectItem>
                        <SelectItem value="RIOZINHO">RIOZINHO</SelectItem>
                        <SelectItem value="ROLANTE">ROLANTE</SelectItem>
                        <SelectItem value="SANTA MARIA DO HERVAL">
                          SANTA MARIA DO HERVAL
                        </SelectItem>
                        <SelectItem value="SAO JOSE DO HORTENCIO">
                          SAO JOSE DO HORTENCIO
                        </SelectItem>
                        <SelectItem value="SAO LEOPOLDO">
                          SAO LEOPOLDO
                        </SelectItem>
                        <SelectItem value="SAO SEBASTIAO DO CAI">
                          SAO SEBASTIAO DO CAI
                        </SelectItem>
                        <SelectItem value="SAPIRANGA">SAPIRANGA</SelectItem>
                        <SelectItem value="SAPUCAIA DO SUL">
                          SAPUCAIA DO SUL
                        </SelectItem>
                        <SelectItem value="TAQUARA">TAQUARA</SelectItem>
                        <SelectItem value="TRES COROAS">TRES COROAS</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-2">
                      Esta é sua principal região de trabalho.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Regiões de Backup
                    </label>
                    <div className="mt-2">
                      {/* This would be replaced with the actual RegionSelector component */}
                      <div className="p-4 border rounded-md bg-muted/50">
                        <p className="text-sm text-muted-foreground mb-2">
                          Selecione até 3 regiões de backup:
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {[
                            "ARARICA",
                            "BOM PRINCIPIO",
                            "CAMPO BOM",
                            "CAPELA DE SANTANA",
                            "DOIS IRMAOS",
                            "ESTANCIA VELHA",
                            "ESTEIO",
                            "HARMONIA",
                            "IGREJINHA",
                            "IVOTI",
                            "LINDOLFO COLLOR",
                            "MONTENEGRO",
                            "MORRO REUTER",
                            "NOVA HARTZ",
                            "NOVO HAMBURGO",
                            "PARECI NOVO",
                            "PAROBE",
                            "PICADA CAFE",
                            "PORTAO",
                            "PRESIDENTE LUCENA",
                            "RIOZINHO",
                            "ROLANTE",
                            "SANTA MARIA DO HERVAL",
                            "SAO JOSE DO HORTENCIO",
                            "SAO LEOPOLDO",
                            "SAO SEBASTIAO DO CAI",
                            "SAPIRANGA",
                            "SAPUCAIA DO SUL",
                            "TAQUARA",
                            "TRES COROAS",
                          ].map((region) => {
                            const isDisabled = region === selectedPrimaryRegion;
                            const isChecked =
                              selectedBackupRegions.includes(region);

                            return (
                              <div
                                key={region}
                                className="flex items-center space-x-2"
                              >
                                <input
                                  type="checkbox"
                                  id={`region-${region}`}
                                  checked={selectedBackupRegions.includes(
                                    region,
                                  )}
                                  disabled={region === selectedPrimaryRegion}
                                  className={`rounded border-gray-300 text-primary focus:ring-primary ${region === selectedPrimaryRegion ? "opacity-50" : ""}`}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      // Adicionar à lista se não estiver cheia
                                      if (selectedBackupRegions.length < 3) {
                                        setSelectedBackupRegions([
                                          ...selectedBackupRegions,
                                          region,
                                        ]);
                                      } else {
                                        e.preventDefault();
                                        e.target.checked = false;
                                        alert(
                                          "Você só pode selecionar até 3 regiões de backup.",
                                        );
                                      }
                                    } else {
                                      // Remover da lista
                                      setSelectedBackupRegions(
                                        selectedBackupRegions.filter(
                                          (r) => r !== region,
                                        ),
                                      );
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`region-${region}`}
                                  className={`text-sm ${isDisabled ? "opacity-50" : ""}`}
                                >
                                  {region}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    id="save-regions-button"
                    onClick={onRegionsSubmit}
                    className="w-full sm:w-auto"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Preferências de Região
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verification" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Verificação de Identidade</CardTitle>
                <CardDescription>
                  Verifique sua identidade para ativar sua conta e poder se
                  disponibilizar para turnos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="mb-4">
                    {/* Status da verificação de identidade */}
                    {(() => {
                      const driverAppVerified =
                        localStorage.getItem("driverAppVerified");
                      const extractedName =
                        localStorage.getItem("extractedName");
                      const driverInfoUpdatedAt = localStorage.getItem(
                        "driverInfoUpdatedAt",
                      );
                      const driverVerificationExpiration = localStorage.getItem(
                        "driverVerificationExpiration",
                      );

                      if (driverAppVerified !== "true" || !extractedName) {
                        return (
                          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md mb-4">
                            <p className="text-yellow-800 font-medium">
                              Verificação de Identidade Pendente
                            </p>
                            <p className="text-sm text-yellow-700 mt-1">
                              Você precisa verificar sua identidade para ativar
                              sua conta.
                            </p>
                          </div>
                        );
                      } else {
                        // Verificar se a verificação está expirada
                        let isExpired = false;
                        let daysUntilExpiration = 0;

                        if (driverVerificationExpiration) {
                          const expirationDate = new Date(
                            driverVerificationExpiration,
                          );
                          const now = new Date();
                          isExpired = now > expirationDate;
                          daysUntilExpiration = Math.ceil(
                            (expirationDate.getTime() - now.getTime()) /
                              (1000 * 60 * 60 * 24),
                          );
                        }

                        if (isExpired) {
                          return (
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md mb-4">
                              <p className="text-yellow-800 font-medium">
                                Verificação de Identidade Expirada
                              </p>
                              <p className="text-sm text-yellow-700 mt-1">
                                Sua verificação expirou. Por favor, verifique
                                novamente.
                              </p>
                              {driverInfoUpdatedAt && (
                                <p className="text-xs text-yellow-600 mt-2">
                                  Última verificação:{" "}
                                  {new Date(
                                    driverInfoUpdatedAt,
                                  ).toLocaleString()}
                                </p>
                              )}
                            </div>
                          );
                        } else {
                          return (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-md mb-4">
                              <p className="text-green-800 font-medium">
                                Verificação de Identidade Ativa
                              </p>
                              <p className="text-sm text-green-700 mt-1">
                                Sua identidade foi verificada com sucesso.
                                {driverVerificationExpiration &&
                                  daysUntilExpiration <= 3 && (
                                    <span className="font-bold">
                                      {" "}
                                      Expira em {daysUntilExpiration} dia(s).
                                    </span>
                                  )}
                              </p>
                              {driverInfoUpdatedAt && (
                                <p className="text-xs text-green-600 mt-2">
                                  Última verificação:{" "}
                                  {new Date(
                                    driverInfoUpdatedAt,
                                  ).toLocaleString()}
                                </p>
                              )}
                              {driverVerificationExpiration && (
                                <p className="text-xs text-green-600 mt-1">
                                  Válida até:{" "}
                                  {new Date(
                                    driverVerificationExpiration,
                                  ).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          );
                        }
                      }
                    })()}

                    {/* Status da verificação de taxa de entrega */}
                    {(() => {
                      const deliveryFee = localStorage.getItem("deliveryFee");
                      const verificationExpiration = localStorage.getItem(
                        "verificationExpiration",
                      );
                      const verificationUpdatedAt = localStorage.getItem(
                        "verificationUpdatedAt",
                      );

                      if (!deliveryFee) {
                        return (
                          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md mb-4">
                            <p className="text-yellow-800 font-medium">
                              Verificação de Taxa de Entrega Pendente
                            </p>
                            <p className="text-sm text-yellow-700 mt-1">
                              Você precisa verificar sua taxa de entrega para
                              ativar sua conta.
                            </p>
                          </div>
                        );
                      }

                      const now = new Date();
                      const expirationDate = verificationExpiration
                        ? new Date(verificationExpiration)
                        : null;

                      if (expirationDate && now < expirationDate) {
                        return (
                          <div className="p-4 bg-green-50 border border-green-200 rounded-md mb-4">
                            <p className="text-green-800 font-medium">
                              Verificação de Taxa de Entrega Ativa
                            </p>
                            <p className="text-sm text-green-700 mt-1">
                              Sua verificação é válida até{" "}
                              {expirationDate.toLocaleDateString()}. Porcentagem
                              de entrega: {deliveryFee}%
                            </p>
                            {verificationUpdatedAt && (
                              <p className="text-xs text-green-600 mt-2">
                                Última verificação:{" "}
                                {new Date(
                                  verificationUpdatedAt,
                                ).toLocaleString()}
                              </p>
                            )}
                          </div>
                        );
                      } else if (expirationDate) {
                        return (
                          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md mb-4">
                            <p className="text-yellow-800 font-medium">
                              Verificação de Taxa de Entrega Expirada
                            </p>
                            <p className="text-sm text-yellow-700 mt-1">
                              Sua verificação expirou. Por favor, verifique
                              novamente.
                            </p>
                            {verificationUpdatedAt && (
                              <p className="text-xs text-yellow-600 mt-2">
                                Última verificação:{" "}
                                {new Date(
                                  verificationUpdatedAt,
                                ).toLocaleString()}
                              </p>
                            )}
                          </div>
                        );
                      } else {
                        return (
                          <div className="p-4 bg-red-50 border border-red-200 rounded-md mb-4">
                            <p className="text-red-800 font-medium">
                              Verificação de Taxa de Entrega Pendente
                            </p>
                            <p className="text-sm text-red-700 mt-1">
                              Você precisa verificar sua taxa de entrega para
                              poder se disponibilizar para turnos.
                            </p>
                          </div>
                        );
                      }
                    })()}
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-lg font-medium mb-4">
                      Verificação de Identidade via Driver APP
                    </h3>
                    <DriverAppVerification
                      onVerificationComplete={(driverInfo) => {
                        console.log(
                          "Informações do motorista verificadas:",
                          driverInfo,
                        );
                        // Atualizar o timestamp da última verificação
                        const currentTimestamp = new Date().toISOString();
                        localStorage.setItem(
                          "driverInfoUpdatedAt",
                          currentTimestamp,
                        );
                        setLastUpdateTimestamp(currentTimestamp);
                        // Forçar atualização da página para refletir a nova verificação
                        window.location.reload();
                      }}
                    />
                  </div>

                  <div className="border-t pt-4 mt-6">
                    <h3 className="text-lg font-medium mb-4">
                      Verificação de Taxa de Entrega
                    </h3>
                    <DeliveryRateVerification
                      onVerificationComplete={(deliveryFee) => {
                        console.log("Taxa de entrega verificada:", deliveryFee);
                        // Atualizar o timestamp da última verificação
                        const currentTimestamp = new Date().toISOString();
                        localStorage.setItem(
                          "verificationUpdatedAt",
                          currentTimestamp,
                        );
                        setLastUpdateTimestamp(currentTimestamp);
                        // Forçar atualização da página para refletir a nova verificação
                        window.location.reload();
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ConfigurationTab;
