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
import { useToast } from "@/components/ui/use-toast";

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
  const { toast } = useToast();
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

  const onProfileSubmit = async (data: z.infer<typeof profileFormSchema>) => {
    try {
      const savedUser = localStorage.getItem("authenticatedUser");
      if (!savedUser) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      const userData = JSON.parse(savedUser);
      const userId = userData.userId;

      if (!userId) {
        toast({
          title: "Erro",
          description: "ID do usuário não encontrado",
          variant: "destructive",
        });
        return;
      }

      // Atualizar no Supabase
      const currentTimestamp = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("users")
        .update({
          full_name: data.name,
          id_number: data.id,
          vehicle_type: data.vehicleType,
          vehicle_plate: data.vehiclePlate,
          updated_at: currentTimestamp,
        })
        .eq("id", userId);

      // Log the update operation for debugging
      console.log("Profile update operation:", { userId, data, updateError });

      if (updateError) {
        console.error("Erro ao atualizar perfil:", updateError);
        toast({
          title: "Erro",
          description: "Erro ao atualizar perfil. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      // Atualizar no localStorage
      localStorage.setItem("extractedName", data.name);
      localStorage.setItem("extractedID", data.id);
      localStorage.setItem("vehicleType", data.vehicleType || "");
      localStorage.setItem("vehiclePlate", data.vehiclePlate || "");
      localStorage.setItem("profileUpdatedAt", currentTimestamp);
      setLastUpdateTimestamp(currentTimestamp);

      // Atualizar dados do usuário autenticado
      userData.fullName = data.name;
      userData.idNumber = data.id;
      userData.vehicleType = data.vehicleType || "";
      userData.vehiclePlate = data.vehiclePlate || "";
      userData.updatedAt = currentTimestamp;
      localStorage.setItem("authenticatedUser", JSON.stringify(userData));

      // Salvar dados completos do perfil
      localStorage.setItem(
        "profileData",
        JSON.stringify({
          fullName: data.name,
          idNumber: data.id,
          vehicleType: data.vehicleType,
          vehiclePlate: data.vehiclePlate,
          updatedAt: currentTimestamp,
        }),
      );

      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao atualizar o perfil. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const onPasswordSubmit = async (data: z.infer<typeof passwordFormSchema>) => {
    try {
      const savedUser = localStorage.getItem("authenticatedUser");
      if (!savedUser) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      const userData = JSON.parse(savedUser);
      const userId = userData.userId;

      // Verificar senha atual
      const { data: userCheck, error: checkError } = await supabase
        .from("users")
        .select("id, password")
        .eq("id", userId)
        .eq("password", data.currentPassword)
        .single();

      if (checkError || !userCheck) {
        toast({
          title: "Erro",
          description: "Senha atual incorreta. Por favor, tente novamente.",
          variant: "destructive",
        });
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
        toast({
          title: "Erro",
          description: "Erro ao atualizar senha. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      // Atualizar no localStorage
      userData.password = data.newPassword;
      userData.updatedAt = currentTimestamp;
      localStorage.setItem("authenticatedUser", JSON.stringify(userData));
      localStorage.setItem("passwordUpdatedAt", currentTimestamp);
      setLastUpdateTimestamp(currentTimestamp);

      toast({
        title: "Sucesso",
        description: "Senha atualizada com sucesso!",
      });
      passwordForm.reset();
    } catch (error) {
      console.error("Erro ao atualizar senha:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao atualizar a senha. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Carregar dados do usuário e regiões do Supabase
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const savedUser = localStorage.getItem("authenticatedUser");
        if (!savedUser) return;

        const userData = JSON.parse(savedUser);
        const userId = userData.userId;

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
          .select(
            "full_name, id_number, vehicle_type, vehicle_plate, updated_at",
          )
          .eq("id", userId)
          .single();

        if (!userError && userProfile) {
          // Só atualizar se não tiver dados no localStorage
          if (!extractedName && userProfile.full_name) {
            profileForm.setValue("name", userProfile.full_name);
          }
          if (!extractedID && userProfile.id_number) {
            profileForm.setValue("id", userProfile.id_number);
          }
          if (!vehicleType && userProfile.vehicle_type) {
            profileForm.setValue("vehicleType", userProfile.vehicle_type);
          }
          if (!vehiclePlate && userProfile.vehicle_plate) {
            profileForm.setValue("vehiclePlate", userProfile.vehicle_plate);
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
        const { data: regionsData, error: regionsError } = await supabase
          .from("regions")
          .select("primary_region, backup_regions, updated_at")
          .eq("user_id", userId)
          .single();

        if (!regionsError && regionsData) {
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
          } else {
            // Só atualizar se não tiver dados no localStorage
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
        toast({
          title: "Erro",
          description: "Por favor, selecione uma região principal.",
          variant: "destructive",
        });
        return;
      }

      if (selectedBackupRegions.length < 3) {
        toast({
          title: "Erro",
          description: "Por favor, selecione 3 regiões de backup.",
          variant: "destructive",
        });
        return;
      }

      const savedUser = localStorage.getItem("authenticatedUser");
      if (!savedUser) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      const userData = JSON.parse(savedUser);
      const userId = userData.userId;

      // Mostrar indicador de carregamento
      const saveButton = document.querySelector("#save-regions-button");
      if (saveButton) {
        saveButton.setAttribute("disabled", "true");
        saveButton.textContent = "Salvando...";
      }

      try {
        // Verificar se já existe um registro de regiões para este usuário
        const { data: existingRegions, error: checkError } = await supabase
          .from("regions")
          .select("id")
          .eq("user_id", userId);

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
            .eq("user_id", userId);

          regionsError = error;
        } else {
          // Inserir novas regiões
          const { error } = await supabase.from("regions").insert([
            {
              user_id: userId,
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

        toast({
          title: "Sucesso",
          description: "Configurações de região salvas com sucesso!",
        });

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
        toast({
          title: "Erro",
          description:
            dbError instanceof Error
              ? dbError.message
              : "Erro ao salvar regiões. Tente novamente.",
          variant: "destructive",
        });

        // Restaurar o botão em caso de erro
        if (saveButton) {
          saveButton.removeAttribute("disabled");
          saveButton.innerHTML =
            '<svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Salvar Preferências de Região';
        }
      }
    } catch (error) {
      console.error("Erro ao salvar regiões:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar as regiões. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full h-full p-6 bg-gradient-to-br from-white to-orange-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-orange-700 dark:text-orange-400 flex items-center">
          <User className="h-6 w-6 mr-2" />
          Configuração
        </h1>

        {lastUpdateTimestamp && (
          <div className="mb-4 p-2 bg-orange-50 border border-orange-200 rounded-md text-sm text-orange-700 flex items-center">
            <Clock className="h-4 w-4 mr-2 text-orange-500" />
            Última atualização: {new Date(lastUpdateTimestamp).toLocaleString()}
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full bg-white dark:bg-gray-900 rounded-lg shadow-md overflow-hidden border border-orange-100 dark:border-orange-900"
        >
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-orange-100 dark:bg-orange-900/30 p-1">
            <TabsTrigger
              value="profile"
              className="flex items-center gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white"
            >
              <User className="h-4 w-4" />
              Informações do Perfil
            </TabsTrigger>
            <TabsTrigger
              value="password"
              className="flex items-center gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white"
            >
              <Lock className="h-4 w-4" />
              Alterar Senha
            </TabsTrigger>
            <TabsTrigger
              value="regions"
              className="flex items-center gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white"
            >
              <MapPin className="h-4 w-4" />
              Atualizar Regiões
            </TabsTrigger>
            <TabsTrigger
              value="verification"
              className="flex items-center gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white"
            >
              <Upload className="h-4 w-4" />
              Verificação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card className="border-orange-100 dark:border-orange-900 shadow-md">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/50 border-b border-orange-100 dark:border-orange-900">
                <CardTitle className="text-orange-700 dark:text-orange-400">
                  Informações do Perfil
                </CardTitle>
                <CardDescription>
                  Atualize suas informações de forma correta para ser escalado!
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form
                    onSubmit={profileForm.handleSubmit(onProfileSubmit)}
                    className="space-y-6"
                  >
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
                              disabled={false}
                            />
                          </FormControl>
                          <FormDescription>
                            Este é seu nome completo como aparece em seu
                            documento de identidade.
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
                              disabled={false}
                            />
                          </FormControl>
                          <FormDescription>
                            Seu número de identificação oficial.
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
                              disabled={false}
                            />
                          </FormControl>
                          <FormDescription>
                            Tipo do seu veículo.
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
                              disabled={false}
                            />
                          </FormControl>
                          <FormDescription>
                            Placa do seu veículo.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Atualizar Perfil
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password" className="space-y-4">
            <Card className="border-orange-100 dark:border-orange-900 shadow-md">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/50 border-b border-orange-100 dark:border-orange-900">
                <CardTitle className="text-orange-700 dark:text-orange-400">
                  Alterar Senha
                </CardTitle>
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
                    <Button
                      type="submit"
                      className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Atualizar Senha
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="regions" className="space-y-4">
            <Card className="border-orange-100 dark:border-orange-900 shadow-md">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/50 border-b border-orange-100 dark:border-orange-900">
                <CardTitle className="text-orange-700 dark:text-orange-400">
                  Atualizar Regiões
                </CardTitle>
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
                                  checked={isChecked}
                                  disabled={isDisabled}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      // Adicionar à lista se não estiver lá
                                      if (
                                        selectedBackupRegions.length < 3 &&
                                        !selectedBackupRegions.includes(region)
                                      ) {
                                        setSelectedBackupRegions([
                                          ...selectedBackupRegions,
                                          region,
                                        ]);
                                      } else if (
                                        selectedBackupRegions.length >= 3
                                      ) {
                                        alert(
                                          "Você só pode selecionar até 3 regiões de backup.",
                                        );
                                        e.target.checked = false;
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
                                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-600"
                                />
                                <label
                                  htmlFor={`region-${region}`}
                                  className={`text-sm ${isDisabled ? "text-gray-400" : "text-gray-700"}`}
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
                    className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Preferências de Região
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verification" className="space-y-4">
            <Card className="border-orange-100 dark:border-orange-900 shadow-md">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/50 border-b border-orange-100 dark:border-orange-900">
                <CardTitle className="text-orange-700 dark:text-orange-400">
                  Verificação de Taxa de Entrega
                </CardTitle>
                <CardDescription>
                  Verifique sua taxa de entrega para garantir que você receba o
                  valor correto por suas entregas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DeliveryRateVerification />
              </CardContent>
            </Card>

            {configIssues.length > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-orange-700 flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    Atenção
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {configIssues.map((issue, index) => (
                      <li
                        key={index}
                        className="text-orange-700 flex items-start"
                      >
                        <span className="mr-2">•</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ConfigurationTab;
