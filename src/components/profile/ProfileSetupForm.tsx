import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { User, CreditCard, Save, CheckCircle } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import RegionSelector from "./RegionSelector";

const profileFormSchema = z.object({
  fullName: z.string().min(2, {
    message: "Full name must be at least 2 characters.",
  }),
  idNumber: z.string().min(5, {
    message: "ID number must be at least 5 characters.",
  }),
});

interface ProfileSetupFormProps {
  onProfileComplete?: (profileData: ProfileData) => void;
  initialData?: ProfileData;
  isLoading?: boolean;
}

interface ProfileData {
  fullName: string;
  idNumber: string;
  primaryRegion: string;
  backupRegions: string[];
}

const ProfileSetupForm = ({
  onProfileComplete = () => {},
  initialData = {
    fullName: "",
    idNumber: "",
    primaryRegion: "",
    backupRegions: [],
  },
  isLoading = false,
}: ProfileSetupFormProps) => {
  const [primaryRegion, setPrimaryRegion] = useState<string>(
    initialData.primaryRegion,
  );
  const [backupRegions, setBackupRegions] = useState<string[]>(
    initialData.backupRegions,
  );
  const [formStep, setFormStep] = useState<"details" | "regions">("details");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: initialData.fullName,
      idNumber: initialData.idNumber,
    },
  });

  const handleDetailsSubmit = (values: z.infer<typeof profileFormSchema>) => {
    setFormStep("regions");
  };

  const handleRegionsSubmit = async () => {
    if (!primaryRegion) {
      // Show error - primary region is required
      return;
    }

    setIsSubmitting(true);

    try {
      const savedUser = localStorage.getItem("authenticatedUser");
      if (!savedUser) {
        alert("Usuário não autenticado");
        setIsSubmitting(false);
        return;
      }

      const userData = JSON.parse(savedUser);
      const profileData: ProfileData = {
        fullName: form.getValues().fullName,
        idNumber: form.getValues().idNumber,
        primaryRegion,
        backupRegions,
      };

      // Buscar o ID do usuário pelo email
      const { data: userData2, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("email", userData.email || userData.phoneNumber) // Support both old and new format
        .single();

      if (userError || !userData2) {
        console.error("Erro ao buscar usuário:", userError);
        alert("Erro ao buscar usuário. Tente novamente.");
        setIsSubmitting(false);
        return;
      }

      // Atualizar os dados do usuário
      const { error: updateError } = await supabase
        .from("users")
        .update({
          full_name: profileData.fullName,
          id_number: profileData.idNumber,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userData2.id);

      if (updateError) {
        console.error("Erro ao atualizar perfil:", updateError);
        alert("Erro ao atualizar perfil. Tente novamente.");
        setIsSubmitting(false);
        return;
      }

      // Inserir as regiões
      const { error: regionsError } = await supabase.from("regions").insert([
        {
          user_id: userData2.id,
          primary_region: primaryRegion,
          backup_regions: backupRegions,
        },
      ]);

      if (regionsError) {
        console.error("Erro ao salvar regiões:", regionsError);
        alert("Erro ao salvar regiões. Tente novamente.");
        setIsSubmitting(false);
        return;
      }

      // Salvar no localStorage para uso offline
      localStorage.setItem("profileData", JSON.stringify(profileData));
      localStorage.setItem(
        "userRegions",
        JSON.stringify({
          primaryRegion: primaryRegion,
          backupRegions: backupRegions,
        }),
      );

      onProfileComplete(profileData);
      setIsSubmitting(false);
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      alert("Ocorreu um erro ao salvar o perfil. Tente novamente.");
      setIsSubmitting(false);
    }
  };

  const handlePrimaryRegionChange = (region: string) => {
    setPrimaryRegion(region);
  };

  const handleBackupRegionsChange = (regions: string[]) => {
    setBackupRegions(regions);
  };

  return (
    <Card className="w-full max-w-[600px] mx-auto bg-white">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-center">
          {formStep === "details"
            ? "Configuração de Perfil"
            : "Seleção de Região"}
        </CardTitle>
        <CardDescription className="text-center">
          {formStep === "details"
            ? "Por favor, forneça suas informações pessoais para completar seu perfil de motorista"
            : "Selecione sua região principal e até 3 regiões de backup para atribuições de entrega"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {formStep === "details" ? (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleDetailsSubmit)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          placeholder="Digite seu nome completo"
                          {...field}
                          className="pl-10"
                        />
                      </FormControl>
                      <User className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                    </div>
                    <FormDescription>
                      Digite seu nome completo como aparece em seu documento de
                      identidade
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="idNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Identificação</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          placeholder="Digite seu número de identificação"
                          {...field}
                          className="pl-10"
                        />
                      </FormControl>
                      <CreditCard className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                    </div>
                    <FormDescription>
                      Digite seu número de identificação emitido pelo governo
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !form.formState.isValid}
              >
                Continuar para Seleção de Região
              </Button>
            </form>
          </Form>
        ) : (
          <div className="space-y-6">
            <RegionSelector
              primaryRegion={primaryRegion}
              backupRegions={backupRegions}
              onPrimaryRegionChange={handlePrimaryRegionChange}
              onBackupRegionsChange={handleBackupRegionsChange}
              disabled={isSubmitting}
            />

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setFormStep("details")}
                disabled={isSubmitting}
                className="sm:flex-1"
              >
                Voltar para Detalhes
              </Button>
              <Button
                onClick={handleRegionsSubmit}
                disabled={!primaryRegion || isSubmitting}
                className="sm:flex-1"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Completando Perfil...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <Save className="mr-2 h-4 w-4" /> Completar Configuração de
                    Perfil
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {formStep === "details" && (
        <CardFooter className="flex justify-center text-sm text-gray-500">
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
            Suas informações são armazenadas com segurança
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default ProfileSetupForm;
