import React, { useState, useEffect } from "react";
import {
  MapPin,
  Truck,
  Info,
  Clock,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Navigation,
  Bell,
  Package,
  BarChart,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/lib/supabaseClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface HomeTabProps {
  userName?: string;
  logisticsCenter?: {
    name: string;
    address: string;
    coordinates: { lat: number; lng: number };
  };
  upcomingShifts?: Array<{
    id: string;
    date: string;
    time: "AM" | "PM" | "OUROBOROS";
    status: "confirmed" | "pending" | "completed";
  }>;
  announcements?: Array<{
    id: string;
    title: string;
    content: string;
    date: string;
    important: boolean;
  }>;
  className?: string;
  handleTabChange?: (tab: string) => void;
}

const HomeTab = ({
  userName = "Driver",
  logisticsCenter = {
    name: "Centro Logístico Shopee",
    address:
      "Rodovia RS 239 , km 23, nº 9730 Distrito Industrial Norte, Campo Bom - RS, 93700-000",
    coordinates: { lat: -29.6731111, lng: -51.0435431 },
  },
  upcomingShifts = [
    { id: "1", date: "2023-06-15", time: "AM", status: "confirmed" },
    { id: "2", date: "2023-06-16", time: "PM", status: "pending" },
    { id: "3", date: "2023-06-17", time: "OUROBOROS", status: "confirmed" },
  ],
  announcements = [
    {
      id: "1",
      title: "Novo Sistema de Planejamento de Rotas",
      content:
        "Atualizamos nosso sistema de planejamento de rotas. Confira as novas funcionalidades no aplicativo.",
      date: "2023-06-10",
      important: true,
    },
    {
      id: "2",
      title: "Cronograma de Feriados",
      content:
        "Observe o cronograma modificado para a próxima temporada de feriados.",
      date: "2023-06-08",
      important: false,
    },
  ],
  className,
  handleTabChange,
}: HomeTabProps) => {
  const [mapView, setMapView] = useState<"satellite" | "standard">("standard");
  const [currentAvailability, setCurrentAvailability] = useState<{
    shift: "AM" | "PM" | "OUROBOROS" | null;
    date: string | null;
  }>({ shift: null, date: null });
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [stats, setStats] = useState({
    deliveriesCompleted: 128,
    deliveryRate: 99.2,
    totalDistance: 1243,
  });

  // Carregar disponibilidade do localStorage ao montar o componente - otimizado
  React.useEffect(() => {
    // Verificar se há disponibilidade para o dia seguinte
    const tomorrow = addDays(new Date(), 1);
    const formattedNextDay = format(tomorrow, "yyyy-MM-dd");

    // Primeiro verificar no localStorage para resposta imediata
    const savedAvailability = localStorage.getItem("driverAvailability");
    if (savedAvailability) {
      try {
        const availabilityData = JSON.parse(savedAvailability);
        // Verificar se a data salva é para o dia seguinte
        const savedDate = new Date(availabilityData.date);
        const tomorrowDate = new Date(tomorrow);
        // Comparar apenas as datas (sem horas)
        if (savedDate.toDateString() === tomorrowDate.toDateString()) {
          setCurrentAvailability({
            shift: availabilityData.shift,
            date: availabilityData.date,
          });
        }
      } catch (error) {
        console.error("Erro ao carregar disponibilidade:", error);
      }
    }

    const savedUser = localStorage.getItem("authenticatedUser");
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      const userId = userData.userId;

      // Buscar disponibilidade para o dia seguinte no Supabase
      const fetchNextDayAvailability = async () => {
        try {
          const { data, error } = await supabase
            .from("availability")
            .select("shift, date")
            .eq("user_id", userId)
            .eq("date", formattedNextDay)
            .single();

          if (!error && data) {
            setCurrentAvailability({
              shift: data.shift,
              date: data.date,
            });
          }
        } catch (error) {
          console.error("Erro ao buscar disponibilidade:", error);
        }
      };

      fetchNextDayAvailability();
    }

    // Verificar se as verificações estão ativas
    const checkVerifications = () => {
      const driverAppVerified = localStorage.getItem("driverAppVerified");
      const deliveryFee = localStorage.getItem("deliveryFee");

      // Se não estiverem ativas, redirecionar para a aba de configuração
      if (!driverAppVerified || !deliveryFee) {
        if (handleTabChange) {
          setTimeout(() => {
            handleTabChange("configuration");
            localStorage.setItem("configActiveTab", "verification");
          }, 1000);
        }
      }
    };

    checkVerifications();
  }, [handleTabChange]);

  const formatDateInPortuguese = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
    } catch (error) {
      return "Data inválida";
    }
  };

  // Check for configuration issues and verification status
  const [configIssues, setConfigIssues] = useState<string[]>([]);

  useEffect(() => {
    const checkConfigurationIssues = () => {
      const issues: string[] = [];

      // Check if regions are configured
      const userRegions = localStorage.getItem("userRegions");
      if (!userRegions) {
        issues.push("Regiões não configuradas");
      }

      // Check Driver APP verification status (identity verification)
      const driverAppVerified = localStorage.getItem("driverAppVerified");
      const driverVerificationExpiration = localStorage.getItem(
        "driverVerificationExpiration",
      );

      if (driverAppVerified !== "true") {
        issues.push("Verificação de identidade pendente");
      } else if (driverVerificationExpiration) {
        // Check if verification is expired
        const expirationDate = new Date(driverVerificationExpiration);
        const now = new Date();
        if (now > expirationDate) {
          issues.push("Verificação de identidade expirada");
        }
      }

      // Check delivery rate verification status (separate verification)
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

  return (
    <div
      className={`w-full h-full p-6 bg-background dark:bg-gray-900 transition-colors duration-300 ${className}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6 flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Bem-vindo,{" "}
            {localStorage.getItem("profileData")
              ? JSON.parse(localStorage.getItem("profileData") || "{}")
                  .fullName || userName
              : userName}
            !
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", {
              locale: ptBR,
            })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 relative"
          onClick={() => setShowAnnouncements(!showAnnouncements)}
        >
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">Avisos</span>
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </Button>
      </motion.div>
      {/* Stats Cards */}
      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Map */}
        <div className="lg:col-span-2">
          <Card className="bg-white dark:bg-gray-800 shadow-md h-full">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>HUB CAMPO BOM</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0 aspect-video relative overflow-hidden rounded-b-lg">
              <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <iframe
                  src={`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1733.4791381874742!2d-51.04354307532683!3d-29.673111182012!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95193f0a1a7d6f5f%3A0x8a1b3a07b0b6a90!2sShopee%20Express%20-%20Centro%20Log%C3%ADstico!5e1!3m2!1spt-BR!2sbr!4v1716232057346!5m2!1spt-BR!2sbr`}
                  className="w-full h-full border-0"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
                <div className="absolute bottom-4 right-4">
                  <a
                    href="https://g.co/kgs/A3gPfKE"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-md shadow-md flex items-center gap-2 text-sm font-medium transition-colors duration-200"
                  >
                    <Navigation className="h-4 w-4" />
                    <span>Obter Rotas</span>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Upcoming Shifts & Announcements */}
        <div className="space-y-6">
          {/* Upcoming Shifts */}
          <Card className="bg-white dark:bg-gray-800 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-500" />
                <span>Próximos Turnos</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentAvailability.shift ? (
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-md border border-orange-100 dark:border-orange-800/30">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-medium text-orange-800 dark:text-orange-300">
                      Amanhã - {currentAvailability.shift}
                    </h3>
                    <Badge
                      variant="outline"
                      className="bg-orange-100 dark:bg-orange-800/30 text-orange-800 dark:text-orange-300"
                    >
                      Confirmado
                    </Badge>
                  </div>
                  <p className="text-sm text-orange-700 dark:text-orange-400">
                    {currentAvailability.date &&
                      formatDateInPortuguese(currentAvailability.date)}
                  </p>
                </div>
              ) : (
                <div className="p-4 text-center border border-dashed border-gray-300 dark:border-gray-600 rounded-md">
                  <p className="text-gray-500 dark:text-gray-400">
                    Nenhum turno agendado para amanhã
                  </p>
                  <Button
                    onClick={() => {
                      if (typeof handleTabChange === "function") {
                        handleTabChange("schedule");
                      }
                    }}
                    className="mt-3 bg-orange-500 hover:bg-orange-600 text-white"
                    size="sm"
                  >
                    Agendar Turno
                  </Button>
                </div>
              )}

              {configIssues.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-100 dark:border-amber-800/30">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-amber-800 dark:text-amber-300">
                        Atenção Necessária
                      </h3>
                      <ul className="mt-1 space-y-1 text-sm text-amber-700 dark:text-amber-400">
                        {configIssues.map((issue, index) => (
                          <li key={index} className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Announcements */}
          <Card className="bg-white dark:bg-gray-800 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-orange-500" />
                <span>Avisos</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {showAnnouncements ? (
                <>
                  <div className="p-3 rounded-md border bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-red-800 dark:text-red-300">
                          Atualização do Sistema
                        </h3>
                        <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                          Haverá uma manutenção programada no sistema no próximo
                          domingo, das 02:00 às 04:00.
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {formatDateInPortuguese(new Date().toISOString())}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 rounded-md border bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30">
                    <div className="flex items-start gap-2">
                      <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-blue-800 dark:text-blue-300">
                          Nova Funcionalidade
                        </h3>
                        <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
                          Agora você pode verificar seu histórico de entregas
                          diretamente no aplicativo.
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {formatDateInPortuguese(new Date().toISOString())}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-4 text-center border border-dashed border-gray-300 dark:border-gray-600 rounded-md">
                  <p className="text-gray-500 dark:text-gray-400">
                    Clique no ícone de sino para ver os avisos
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default HomeTab;
