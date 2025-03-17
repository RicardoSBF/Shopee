import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Calendar, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../ui/card";
import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Badge } from "../ui/badge";

interface ScheduleTabProps {
  currentDate?: Date;
  selectedShift?: "AM" | "PM" | "OUROBOROS" | null;
  onShiftSelect?: (shift: "AM" | "PM" | "OUROBOROS") => void;
}

interface AvailabilityData {
  shift: "AM" | "PM" | "OUROBOROS" | null;
  date: string | null;
}

const ScheduleTab = ({
  currentDate = new Date(),
  selectedShift = null,
  onShiftSelect = () => {},
}: ScheduleTabProps) => {
  const [activeTab, setActiveTab] = useState("current");
  const [localSelectedShift, setLocalSelectedShift] = useState<
    "AM" | "PM" | "OUROBOROS" | null
  >(selectedShift);
  const [configComplete, setConfigComplete] = useState(false);
  const [currentAvailability, setCurrentAvailability] =
    useState<AvailabilityData>({
      shift: null,
      date: null,
    });
  const [nextDayAvailability, setNextDayAvailability] =
    useState<AvailabilityData>({
      shift: null,
      date: null,
    });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState<string | null>(
    null,
  );

  const [configIssues, setConfigIssues] = useState<string[]>([]);

  // Verificar se as configurações foram preenchidas - ambas verificações são obrigatórias
  useEffect(() => {
    const userRegions = localStorage.getItem("userRegions");
    const driverAppVerified = localStorage.getItem("driverAppVerified"); // Verificação de identidade
    const driverInfoUpdatedAt = localStorage.getItem("driverInfoUpdatedAt");
    const driverVerificationExpiration = localStorage.getItem(
      "driverVerificationExpiration",
    );
    const deliveryFee = localStorage.getItem("deliveryFee"); // Verificação de taxa de entrega
    const verificationExpiration = localStorage.getItem(
      "verificationExpiration",
    );
    const verificationUpdatedAt = localStorage.getItem("verificationUpdatedAt");

    // Usar o timestamp mais recente entre as duas verificações
    if (verificationUpdatedAt) {
      setLastUpdateTimestamp(verificationUpdatedAt);
    } else if (driverInfoUpdatedAt) {
      setLastUpdateTimestamp(driverInfoUpdatedAt);
    }

    let isDriverVerificationValid = false;
    let isDeliveryRateValid = false;
    const issues: string[] = [];

    // Verificar validade da verificação de identidade
    if (driverAppVerified === "true" && driverVerificationExpiration) {
      const expirationDate = new Date(driverVerificationExpiration);
      const currentDate = new Date();
      isDriverVerificationValid = currentDate < expirationDate;

      if (!isDriverVerificationValid) {
        // Verificação de identidade expirou
        localStorage.removeItem("driverAppVerified");
        issues.push("Verificação de identidade expirada");
      }
    } else if (driverAppVerified !== "true") {
      issues.push("Verificação de identidade pendente");
    }

    // Verificar validade da verificação de taxa de entrega
    if (deliveryFee && verificationExpiration) {
      const expirationDate = new Date(verificationExpiration);
      const currentDate = new Date();
      isDeliveryRateValid = currentDate < expirationDate;

      if (!isDeliveryRateValid) {
        // Verificação de taxa expirou
        localStorage.removeItem("deliveryFee");
        issues.push("Verificação de taxa de entrega expirada");
      }
    } else {
      issues.push("Verificação de taxa de entrega pendente");
    }

    // Verificar se as regiões foram configuradas
    if (!userRegions) {
      issues.push("Regiões não configuradas");
    }

    setConfigIssues(issues);

    // Verificar se AMBAS verificações foram feitas (identidade E taxa de entrega) e estão válidas
    if (
      userRegions &&
      driverAppVerified === "true" &&
      isDriverVerificationValid &&
      deliveryFee &&
      isDeliveryRateValid
    ) {
      setConfigComplete(true);
    } else {
      setConfigComplete(false);
    }

    // Carregar disponibilidade atual do localStorage
    const savedAvailability = localStorage.getItem("driverAvailability");
    if (savedAvailability) {
      try {
        const availabilityData = JSON.parse(savedAvailability);
        setCurrentAvailability({
          shift: availabilityData.shift,
          date: availabilityData.date,
        });
      } catch (error) {
        console.error("Erro ao carregar disponibilidade:", error);
      }
    }

    // Também verificar no Supabase
    const checkAvailability = async () => {
      try {
        setIsLoading(true);
        const savedUser = localStorage.getItem("authenticatedUser");
        if (!savedUser) {
          setIsLoading(false);
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
            setIsLoading(false);
            return;
          }

          userId = userData2.id;
        }

        // Calcular datas usando Date.now() para garantir precisão
        const today = new Date();
        const tomorrow = addDays(today, 1);
        const formattedToday = format(today, "yyyy-MM-dd");
        const formattedTomorrow = format(tomorrow, "yyyy-MM-dd");

        // Buscar disponibilidade para hoje
        const { data: todayData, error: todayError } = await supabase
          .from("availability")
          .select("*")
          .eq("user_id", userId)
          .eq("date", formattedToday);

        if (!todayError && todayData && todayData.length > 0) {
          setCurrentAvailability({
            shift: todayData[0].shift,
            date: todayData[0].date,
          });
        }

        // Buscar disponibilidade para amanhã
        const { data: tomorrowData, error: tomorrowError } = await supabase
          .from("availability")
          .select("*")
          .eq("user_id", userId)
          .eq("date", formattedTomorrow);

        if (!tomorrowError && tomorrowData && tomorrowData.length > 0) {
          setNextDayAvailability({
            shift: tomorrowData[0].shift,
            date: tomorrowData[0].date,
          });
          setLocalSelectedShift(tomorrowData[0].shift);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Erro ao verificar disponibilidade:", error);
        setIsLoading(false);
      }
    };

    checkAvailability();

    // Configurar verificação periódica para atualizações em tempo real com intervalo otimizado
    const intervalId = setInterval(checkAvailability, 180000); // Verificar a cada 3 minutos para reduzir carga
    return () => clearInterval(intervalId);
  }, []);

  // Next day is calculated based on current date
  const nextDay = addDays(new Date(), 1); // Usar addDays para garantir cálculo correto

  const handleShiftSelect = (shift: "AM" | "PM" | "OUROBOROS") => {
    setLocalSelectedShift(shift);
    onShiftSelect(shift);
  };

  const getShiftTimes = (shift: "AM" | "PM" | "OUROBOROS") => {
    switch (shift) {
      case "AM":
        return "3:30 - 7:30";
      case "PM":
        return "11:00 - 13:30";
      case "OUROBOROS":
        return "15:00 - 17:30";
      default:
        return "";
    }
  };

  const formatDateInPortuguese = (date: Date) => {
    return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  const renderAvailabilityCard = (
    availability: AvailabilityData,
    title: string,
    date: Date,
  ) => {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
          <CardDescription>{formatDateInPortuguese(date)}</CardDescription>
        </CardHeader>
        <CardContent>
          {availability.shift ? (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="font-medium">
                    Turno {availability.shift}
                  </span>
                </div>
                <Badge variant="outline">
                  {getShiftTimes(availability.shift)}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-600 mt-2">
                <CheckCircle className="h-4 w-4" />
                <span>Confirmado</span>
              </div>
              {lastUpdateTimestamp && (
                <div className="text-xs text-gray-500 mt-2">
                  Última atualização:{" "}
                  {new Date(lastUpdateTimestamp).toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-muted-foreground flex items-center justify-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Nenhum turno agendado
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="w-full h-full p-6 bg-background">
      {(!configComplete || configIssues.length > 0) && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-800 font-bold">
            ATENÇÃO: Verificação Obrigatória
          </p>
          <p className="text-sm text-yellow-700 mt-1">
            É necessário completar todas as verificações e configuração de
            regiões para poder se disponibilizar para turnos.
          </p>
          {configIssues.length > 0 && (
            <ul className="mt-2 space-y-1">
              {configIssues.map((issue, index) => (
                <li
                  key={index}
                  className="text-yellow-700 flex items-center gap-2 font-medium"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                  {issue}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Gerenciamento de Agenda</h1>
        <p className="text-muted-foreground">
          Visualize sua agenda atual e selecione disponibilidade para próximos
          turnos
        </p>
      </div>
      <Tabs
        defaultValue="current"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
        disabled={!configComplete}
      >
        <TabsList className="grid w-full grid-cols-2 mb-8 bg-orange-100 p-1 rounded-lg">
          <TabsTrigger
            value="current"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white rounded-md transition-all duration-200"
          >
            Agenda Atual
          </TabsTrigger>
          <TabsTrigger
            value="next-day"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white rounded-md transition-all duration-200"
          >
            Disponibilidade para Amanhã
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3">Carregando agendas...</span>
            </div>
          ) : (
            <div>
              {renderAvailabilityCard(
                currentAvailability,
                "Agenda de Hoje",
                new Date(),
              )}
              {renderAvailabilityCard(
                nextDayAvailability,
                "Agenda de Amanhã",
                nextDay,
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="next-day" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <span>Selecione Disponibilidade para Amanhã</span>
              </CardTitle>
              <CardDescription>
                {formatDateInPortuguese(nextDay)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">
                    Escolha sua preferência de turno:
                  </h3>
                  <RadioGroup
                    value={localSelectedShift || ""}
                    onValueChange={(value) =>
                      handleShiftSelect(value as "AM" | "PM" | "OUROBOROS")
                    }
                    className="space-y-4"
                  >
                    <div className="flex items-center space-x-2 p-4 rounded-lg border hover:bg-orange-50 cursor-pointer transition-all duration-200 hover:shadow-md">
                      <RadioGroupItem
                        value="AM"
                        id="am"
                        className="text-orange-500"
                      />
                      <div className="grid gap-1.5 leading-none w-full">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="am"
                            className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            Turno AM
                          </label>
                          <span className="text-sm font-medium text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                            {getShiftTimes("AM")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Turno da manhã cobrindo entregas e coletas matinais
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 p-4 rounded-lg border hover:bg-orange-50 cursor-pointer transition-all duration-200 hover:shadow-md">
                      <RadioGroupItem
                        value="PM"
                        id="pm"
                        className="text-orange-500"
                      />
                      <div className="grid gap-1.5 leading-none w-full">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="pm"
                            className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            Turno PM
                          </label>
                          <span className="text-sm font-medium text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                            {getShiftTimes("PM")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Turno da tarde cobrindo entregas do meio-dia e da
                          noite
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 p-4 rounded-lg border hover:bg-orange-50 cursor-pointer transition-all duration-200 hover:shadow-md">
                      <RadioGroupItem
                        value="OUROBOROS"
                        id="ouroboros"
                        className="text-orange-500"
                      />
                      <div className="grid gap-1.5 leading-none w-full">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="ouroboros"
                            className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            Turno OUROBOROS
                          </label>
                          <span className="text-sm font-medium text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                            {getShiftTimes("OUROBOROS")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Turno noturno cobrindo entregas de madrugada e
                          preparações para o início da manhã
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setLocalSelectedShift(null)}
              >
                Limpar Seleção
              </Button>
              <Button
                disabled={
                  !localSelectedShift ||
                  !configComplete ||
                  isLoading ||
                  configIssues.length > 0
                }
                className="bg-orange-500 hover:bg-orange-600 text-white transition-all duration-200 hover:shadow-md"
                onClick={async () => {
                  if (localSelectedShift) {
                    try {
                      setIsLoading(true);
                      const savedUser =
                        localStorage.getItem("authenticatedUser");
                      if (!savedUser) {
                        alert("Usuário não autenticado");
                        setIsLoading(false);
                        return;
                      }

                      const userData = JSON.parse(savedUser);
                      const userRegions = localStorage.getItem("userRegions");
                      const regions = userRegions
                        ? JSON.parse(userRegions)
                        : null;

                      // Buscar o ID do usuário pelo email
                      const { data: userData2, error: userError } =
                        await supabase
                          .from("users")
                          .select("id")
                          .eq("email", userData.email || userData.phoneNumber) // Support both old and new format
                          .single();

                      if (userError || !userData2) {
                        console.error("Erro ao buscar usuário:", userError);
                        alert("Erro ao buscar usuário. Tente novamente.");
                        setIsLoading(false);
                        return;
                      }

                      // Calcular a data de amanhã com precisão
                      const tomorrow = addDays(new Date(), 1);
                      const formattedTomorrow = format(tomorrow, "yyyy-MM-dd");

                      // Verificar se já existe uma disponibilidade para amanhã
                      const { data: existingAvailability, error: checkError } =
                        await supabase
                          .from("availability")
                          .select("id")
                          .eq("user_id", userData2.id)
                          .eq("date", formattedTomorrow);

                      let availabilityError;
                      const currentTimestamp = new Date().toISOString();

                      if (
                        existingAvailability &&
                        existingAvailability.length > 0
                      ) {
                        // Atualizar a disponibilidade existente
                        const { error } = await supabase
                          .from("availability")
                          .update({
                            shift: localSelectedShift,
                            updated_at: currentTimestamp,
                          })
                          .eq("id", existingAvailability[0].id);

                        availabilityError = error;
                      } else {
                        // Inserir a disponibilidade
                        const { error } = await supabase
                          .from("availability")
                          .insert([
                            {
                              user_id: userData2.id,
                              shift: localSelectedShift,
                              date: formattedTomorrow,
                              updated_at: currentTimestamp,
                            },
                          ]);

                        availabilityError = error;
                      }

                      if (availabilityError) {
                        console.error(
                          "Erro ao salvar disponibilidade:",
                          availabilityError,
                        );
                        alert(
                          "Erro ao salvar disponibilidade. Tente novamente.",
                        );
                        setIsLoading(false);
                        return;
                      }

                      // Salvar no localStorage para uso offline com timestamp
                      localStorage.setItem(
                        "driverAvailability",
                        JSON.stringify({
                          shift: localSelectedShift,
                          date: tomorrow.toISOString(),
                          primaryRegion: regions?.primaryRegion || "",
                          backupRegions: regions?.backupRegions || [],
                          updatedAt: currentTimestamp,
                        }),
                      );

                      // Atualizar o timestamp da última atualização
                      localStorage.setItem(
                        "availabilityUpdatedAt",
                        currentTimestamp,
                      );
                      setLastUpdateTimestamp(currentTimestamp);

                      // Atualizar o estado para refletir a nova disponibilidade
                      setNextDayAvailability({
                        shift: localSelectedShift,
                        date: formattedTomorrow,
                      });

                      alert(
                        `Disponibilidade definida para o turno ${localSelectedShift} em ${formatDateInPortuguese(tomorrow)}`,
                      );
                      setActiveTab("current");
                      setIsLoading(false);
                    } catch (error) {
                      console.error("Erro ao salvar disponibilidade:", error);
                      alert(
                        "Ocorreu um erro ao salvar a disponibilidade. Tente novamente.",
                      );
                      setIsLoading(false);
                    }
                  }
                }}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processando...
                  </span>
                ) : (
                  "Confirmar Disponibilidade"
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScheduleTab;
